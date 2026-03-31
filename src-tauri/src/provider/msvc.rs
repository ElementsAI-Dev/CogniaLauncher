use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::provider::cpp_compiler::{
    build_msvc_compiler_metadata, infer_msvc_host_target, CppCompilerMetadata,
};
use crate::provider::support::SupportReason;
use async_trait::async_trait;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// MSVC / Visual Studio Build Tools Provider
///
/// Detection-oriented provider that uses `vswhere.exe` to discover installed
/// Visual Studio and Build Tools instances with MSVC toolsets.
///
/// Key commands:
///   - `vswhere -all -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json -utf8`
///   - Toolset version from `{installPath}\VC\Auxiliary\Build\Microsoft.VCToolsVersion.default.txt`
///   - cl.exe at `{installPath}\VC\Tools\MSVC\{toolsetVersion}\bin\HostX64\x64\cl.exe`
pub struct MsvcProvider {
    vswhere_path: Option<PathBuf>,
}

const MSVC_SUCCESS_CACHE_TTL: Duration = Duration::from_secs(30);
const MSVC_FAILURE_CACHE_TTL: Duration = Duration::from_secs(10);

#[derive(Clone)]
struct CachedMsvcToolchainResult {
    value: Result<ResolvedMsvcToolchain, MsvcDetectionIssue>,
    cached_at: Instant,
}

static MSVC_TOOLCHAIN_CACHE: Lazy<Mutex<Option<CachedMsvcToolchainResult>>> =
    Lazy::new(|| Mutex::new(None));

/// A Visual Studio instance as reported by vswhere
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VsInstance {
    instance_id: String,
    installation_path: String,
    installation_version: String,
    display_name: String,
    #[serde(default)]
    product_id: Option<String>,
    #[serde(default)]
    is_prerelease: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MsvcDetectionReason {
    VswhereMissing,
    NoVcInstance,
    ToolsetMissing,
    CompilerMissing,
    CompilerNotRunnable,
}

impl MsvcDetectionReason {
    fn code(self) -> &'static str {
        match self {
            Self::VswhereMissing => "vswhere-missing",
            Self::NoVcInstance => "no-vc-instance",
            Self::ToolsetMissing => "toolset-missing",
            Self::CompilerMissing => "compiler-missing",
            Self::CompilerNotRunnable => "compiler-not-runnable",
        }
    }

    fn message(self) -> &'static str {
        match self {
            Self::VswhereMissing => "vswhere.exe not found",
            Self::NoVcInstance => "No Visual Studio instance with VC tools was found",
            Self::ToolsetMissing => "MSVC toolset metadata is missing",
            Self::CompilerMissing => "cl.exe could not be resolved from the discovered toolset",
            Self::CompilerNotRunnable => "Resolved cl.exe exists but failed runtime probe",
        }
    }

    fn severity(self) -> u8 {
        match self {
            Self::VswhereMissing => 100,
            Self::NoVcInstance => 90,
            Self::CompilerNotRunnable => 80,
            Self::CompilerMissing => 70,
            Self::ToolsetMissing => 60,
        }
    }
}

#[derive(Debug, Clone)]
struct MsvcDetectionIssue {
    reason: MsvcDetectionReason,
    instance: Option<String>,
    detail: Option<String>,
}

impl MsvcDetectionIssue {
    fn new(reason: MsvcDetectionReason) -> Self {
        Self {
            reason,
            instance: None,
            detail: None,
        }
    }

    fn with_instance(mut self, instance: impl Into<String>) -> Self {
        self.instance = Some(instance.into());
        self
    }

    fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    fn to_error(&self) -> CogniaError {
        let mut msg = format!("[{}] {}", self.reason.code(), self.reason.message());
        if let Some(instance) = &self.instance {
            msg.push_str(&format!(" (instance: {})", instance));
        }
        if let Some(detail) = &self.detail {
            if !detail.trim().is_empty() {
                msg.push_str(&format!(": {}", detail));
            }
        }
        CogniaError::Provider(msg)
    }
}

#[derive(Debug, Clone)]
struct ResolvedMsvcToolchain {
    instance: VsInstance,
    toolset_version: String,
    cl_exe_path: PathBuf,
    discovery_origin: &'static str,
}

fn choose_more_actionable_issue(
    current: Option<MsvcDetectionIssue>,
    candidate: MsvcDetectionIssue,
) -> Option<MsvcDetectionIssue> {
    match current {
        None => Some(candidate),
        Some(existing) => {
            if candidate.reason.severity() > existing.reason.severity() {
                Some(candidate)
            } else {
                Some(existing)
            }
        }
    }
}

fn probe_output_indicates_usable_compiler(success: bool, stdout: &str, stderr: &str) -> bool {
    if success {
        return true;
    }

    let merged = format!("{}\n{}", stdout, stderr).to_lowercase();
    merged.contains("microsoft")
        && (merged.contains("c/c++") || merged.contains("c++") || merged.contains("compiler"))
}

fn resolve_instance_toolchain(
    instance: &VsInstance,
) -> Result<(String, PathBuf), MsvcDetectionIssue> {
    let install_path = Path::new(&instance.installation_path);
    let instance_name = instance.display_name.clone();
    let toolset = read_toolset_version(install_path).ok_or_else(|| {
        MsvcDetectionIssue::new(MsvcDetectionReason::ToolsetMissing).with_instance(&instance_name)
    })?;
    let cl_path = find_cl_exe(install_path, &toolset).ok_or_else(|| {
        MsvcDetectionIssue::new(MsvcDetectionReason::CompilerMissing).with_instance(&instance_name)
    })?;

    Ok((toolset, cl_path))
}

fn toolchain_cache_ttl(result: &Result<ResolvedMsvcToolchain, MsvcDetectionIssue>) -> Duration {
    if result.is_ok() {
        MSVC_SUCCESS_CACHE_TTL
    } else {
        MSVC_FAILURE_CACHE_TTL
    }
}

fn read_cached_toolchain_result() -> Option<Result<ResolvedMsvcToolchain, MsvcDetectionIssue>> {
    let mut guard = MSVC_TOOLCHAIN_CACHE.lock().ok()?;
    if let Some(cached) = guard.as_ref() {
        if cached.cached_at.elapsed() <= toolchain_cache_ttl(&cached.value) {
            return Some(cached.value.clone());
        }
    }
    *guard = None;
    None
}

fn write_cached_toolchain_result(result: &Result<ResolvedMsvcToolchain, MsvcDetectionIssue>) {
    if let Ok(mut guard) = MSVC_TOOLCHAIN_CACHE.lock() {
        *guard = Some(CachedMsvcToolchainResult {
            value: result.clone(),
            cached_at: Instant::now(),
        });
    }
}

impl MsvcProvider {
    pub fn new() -> Self {
        let vswhere_path = find_vswhere();
        Self { vswhere_path }
    }

    fn make_opts(&self) -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(30))
    }

    fn make_probe_opts(&self) -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(10))
    }

    /// Run vswhere with given arguments and return stdout
    async fn run_vswhere(&self, args: &[&str]) -> CogniaResult<String> {
        let exe = self
            .vswhere_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .ok_or_else(|| CogniaError::Provider("vswhere.exe not found".into()))?;

        let opts = self.make_opts();
        let out = process::execute(&exe, args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Query all VS instances that have MSVC VC.Tools installed
    async fn query_vc_instances(&self) -> CogniaResult<Vec<VsInstance>> {
        let json_str = self
            .run_vswhere(&[
                "-all",
                "-products",
                "*",
                "-requires",
                "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                "-format",
                "json",
                "-utf8",
            ])
            .await?;

        parse_vswhere_json(&json_str)
    }

    async fn probe_cl_executable(&self, cl_path: &Path) -> bool {
        let exe = cl_path.to_string_lossy().to_string();
        let opts = self.make_probe_opts();

        for args in [&["/Bv"][..], &["/?"][..]] {
            if let Ok(out) = process::execute(&exe, args, Some(opts.clone())).await {
                if probe_output_indicates_usable_compiler(out.success, &out.stdout, &out.stderr) {
                    return true;
                }
            }
        }

        false
    }

    async fn validate_instance(
        &self,
        instance: VsInstance,
    ) -> Result<ResolvedMsvcToolchain, MsvcDetectionIssue> {
        let (toolset_version, cl_exe_path) = resolve_instance_toolchain(&instance)?;
        if !self.probe_cl_executable(&cl_exe_path).await {
            return Err(
                MsvcDetectionIssue::new(MsvcDetectionReason::CompilerNotRunnable)
                    .with_instance(&instance.display_name)
                    .with_detail(cl_exe_path.display().to_string()),
            );
        }

        Ok(ResolvedMsvcToolchain {
            instance,
            toolset_version,
            cl_exe_path,
            discovery_origin: "vswhere",
        })
    }

    async fn resolve_usable_toolchain_uncached(
        &self,
    ) -> Result<ResolvedMsvcToolchain, MsvcDetectionIssue> {
        let mut best_issue: Option<MsvcDetectionIssue> = None;

        if self.vswhere_path.is_some() {
            let instances = self.query_vc_instances().await.map_err(|err| {
                MsvcDetectionIssue::new(MsvcDetectionReason::NoVcInstance)
                    .with_detail(err.to_string())
            })?;

            if !instances.is_empty() {
                for instance in instances {
                    match self.validate_instance(instance).await {
                        Ok(validated) => return Ok(validated),
                        Err(issue) => {
                            best_issue = choose_more_actionable_issue(best_issue, issue);
                        }
                    }
                }
            }
        } else {
            best_issue = choose_more_actionable_issue(
                best_issue,
                MsvcDetectionIssue::new(MsvcDetectionReason::VswhereMissing),
            );
        }

        match self.resolve_developer_shell_toolchain().await {
            Ok(toolchain) => return Ok(toolchain),
            Err(issue) => {
                best_issue = choose_more_actionable_issue(best_issue, issue);
            }
        }

        Err(best_issue
            .unwrap_or_else(|| MsvcDetectionIssue::new(MsvcDetectionReason::NoVcInstance)))
    }

    async fn resolve_usable_toolchain(&self) -> Result<ResolvedMsvcToolchain, MsvcDetectionIssue> {
        if let Some(cached) = read_cached_toolchain_result() {
            return cached;
        }

        let resolved = self.resolve_usable_toolchain_uncached().await;
        write_cached_toolchain_result(&resolved);
        resolved
    }

    async fn get_usable_toolchain(&self) -> CogniaResult<ResolvedMsvcToolchain> {
        self.resolve_usable_toolchain()
            .await
            .map_err(|issue| issue.to_error())
    }

    pub async fn current_cpp_compiler_metadata(&self) -> CogniaResult<CppCompilerMetadata> {
        let resolved = self.get_usable_toolchain().await?;
        Ok(build_msvc_compiler_metadata(
            &resolved.cl_exe_path,
            &resolved.toolset_version,
            resolved.discovery_origin,
        ))
    }

    async fn resolve_developer_shell_toolchain(
        &self,
    ) -> Result<ResolvedMsvcToolchain, MsvcDetectionIssue> {
        let mut candidates = Vec::new();

        if let Some(path) = process::which("cl.exe").await {
            candidates.push(PathBuf::from(path));
        }

        if let Ok(path) = std::env::var("VCToolsInstallDir") {
            candidates.extend(candidate_cl_paths_from_vctools_install_dir(Path::new(
                &path,
            )));
        }

        if let Ok(path) = std::env::var("VCINSTALLDIR") {
            candidates.extend(candidate_cl_paths_from_vcinstall_dir(Path::new(&path)));
        }

        candidates.sort();
        candidates.dedup();

        if candidates.is_empty() {
            return Err(
                MsvcDetectionIssue::new(MsvcDetectionReason::CompilerMissing)
                    .with_instance("developer-shell")
                    .with_detail("cl.exe was not found in PATH or developer-shell environment"),
            );
        }

        let mut best_issue: Option<MsvcDetectionIssue> = None;
        for candidate in candidates {
            if !candidate.exists() {
                best_issue = choose_more_actionable_issue(
                    best_issue,
                    MsvcDetectionIssue::new(MsvcDetectionReason::CompilerMissing)
                        .with_instance("developer-shell")
                        .with_detail(candidate.display().to_string()),
                );
                continue;
            }

            if !self.probe_cl_executable(&candidate).await {
                best_issue = choose_more_actionable_issue(
                    best_issue,
                    MsvcDetectionIssue::new(MsvcDetectionReason::CompilerNotRunnable)
                        .with_instance("developer-shell")
                        .with_detail(candidate.display().to_string()),
                );
                continue;
            }

            let toolset_version = infer_toolset_version_from_cl_path(&candidate)
                .unwrap_or_else(|| "developer-shell".to_string());
            return Ok(ResolvedMsvcToolchain {
                instance: VsInstance {
                    instance_id: "developer-shell".to_string(),
                    installation_path: candidate
                        .parent()
                        .unwrap_or_else(|| Path::new(""))
                        .display()
                        .to_string(),
                    installation_version: toolset_version.clone(),
                    display_name: "Developer Command Prompt".to_string(),
                    product_id: Some("developer-shell".to_string()),
                    is_prerelease: None,
                },
                toolset_version,
                cl_exe_path: candidate,
                discovery_origin: "developer-shell",
            });
        }

        Err(best_issue.unwrap_or_else(|| {
            MsvcDetectionIssue::new(MsvcDetectionReason::CompilerMissing)
                .with_instance("developer-shell")
        }))
    }
}

impl Default for MsvcProvider {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helper functions (private, unit-testable)
// ---------------------------------------------------------------------------

/// Locate vswhere.exe on the system
fn find_vswhere() -> Option<PathBuf> {
    // Standard location: %ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe
    if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
        let path = PathBuf::from(pf86)
            .join("Microsoft Visual Studio")
            .join("Installer")
            .join("vswhere.exe");
        if path.exists() {
            return Some(path);
        }
    }

    // Fallback: %ProgramFiles%
    if let Ok(pf) = std::env::var("ProgramFiles") {
        let path = PathBuf::from(pf)
            .join("Microsoft Visual Studio")
            .join("Installer")
            .join("vswhere.exe");
        if path.exists() {
            return Some(path);
        }
    }

    // Last resort: check common PATH locations via `where` on Windows
    if let Ok(output) = std::process::Command::new("where")
        .arg("vswhere.exe")
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = stdout.lines().next() {
                let path = PathBuf::from(line.trim());
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Parse vswhere JSON output into a Vec of VsInstance
fn parse_vswhere_json(json: &str) -> CogniaResult<Vec<VsInstance>> {
    let trimmed = json.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        return Ok(vec![]);
    }

    serde_json::from_str::<Vec<VsInstance>>(trimmed)
        .map_err(|e| CogniaError::Provider(format!("Failed to parse vswhere JSON: {}", e)))
}

/// Read the MSVC toolset version from Microsoft.VCToolsVersion.default.txt
fn read_toolset_version(install_path: &Path) -> Option<String> {
    let version_file = install_path
        .join("VC")
        .join("Auxiliary")
        .join("Build")
        .join("Microsoft.VCToolsVersion.default.txt");

    std::fs::read_to_string(version_file)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Construct the path to cl.exe within a VS installation
fn find_cl_exe(install_path: &Path, toolset_version: &str) -> Option<PathBuf> {
    let root = install_path
        .join("VC")
        .join("Tools")
        .join("MSVC")
        .join(toolset_version);
    let mut candidates = candidate_cl_paths_from_vctools_install_dir(&root);
    sort_msvc_candidates_in_place(&mut candidates);
    candidates.into_iter().find(|candidate| candidate.exists())
}

fn candidate_cl_paths_from_vctools_install_dir(root: &Path) -> Vec<PathBuf> {
    vec![
        root.join("bin").join("HostX64").join("x64").join("cl.exe"),
        root.join("bin")
            .join("HostX64")
            .join("arm64")
            .join("cl.exe"),
        root.join("bin")
            .join("HostArm64")
            .join("arm64")
            .join("cl.exe"),
        root.join("bin").join("Hostx86").join("x86").join("cl.exe"),
        root.join("bin").join("Hostx86").join("x64").join("cl.exe"),
    ]
}

fn candidate_cl_paths_from_vcinstall_dir(root: &Path) -> Vec<PathBuf> {
    let tools_root = root.join("Tools").join("MSVC");
    let mut candidates = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&tools_root) {
        for entry in entries.flatten() {
            let version_root = entry.path();
            candidates.extend(candidate_cl_paths_from_vctools_install_dir(&version_root));
        }
    }
    sort_msvc_candidates_in_place(&mut candidates);
    candidates
}

fn sort_msvc_candidates_in_place(candidates: &mut Vec<PathBuf>) {
    candidates.sort_by(|left, right| {
        score_msvc_candidate_path(left)
            .cmp(&score_msvc_candidate_path(right))
            .then_with(|| left.cmp(right))
    });
    candidates.dedup();
}

fn score_msvc_candidate_path(path: &Path) -> (u8, u8, String) {
    let (host_architecture, target_architecture) = infer_msvc_host_target(path);
    let preferred = preferred_msvc_architecture();
    let host_score = architecture_preference_score(host_architecture.as_deref(), preferred);
    let target_score = architecture_preference_score(target_architecture.as_deref(), preferred);

    (
        target_score,
        host_score,
        path.to_string_lossy().to_string().to_ascii_lowercase(),
    )
}

fn preferred_msvc_architecture() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "x86",
        _ => "x64",
    }
}

fn architecture_preference_score(actual: Option<&str>, preferred: &str) -> u8 {
    match actual {
        Some(value) if value.eq_ignore_ascii_case(preferred) => 0,
        Some("x64") => 1,
        Some("arm64") => 2,
        Some("x86") => 3,
        Some(_) => 4,
        None => 5,
    }
}

fn infer_toolset_version_from_cl_path(path: &Path) -> Option<String> {
    let parts: Vec<String> = path
        .iter()
        .map(|part| part.to_string_lossy().to_string())
        .collect();

    for window in parts.windows(2) {
        if window[0].eq_ignore_ascii_case("MSVC") {
            return Some(window[1].clone());
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Provider + SystemPackageProvider trait implementations
// ---------------------------------------------------------------------------

#[async_trait]
impl Provider for MsvcProvider {
    fn id(&self) -> &str {
        "msvc"
    }

    fn display_name(&self) -> &str {
        "MSVC (Visual Studio Build Tools)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([Capability::List])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows]
    }

    fn priority(&self) -> i32 {
        75
    }

    async fn is_available(&self) -> bool {
        self.resolve_usable_toolchain().await.is_ok()
    }

    async fn unavailable_reason(&self) -> Option<SupportReason> {
        self.resolve_usable_toolchain()
            .await
            .err()
            .map(|issue| SupportReason {
                code: issue.reason.code(),
                message: issue.to_error().to_string(),
            })
    }

    async fn search(
        &self,
        _query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // MSVC is not a remote search provider
        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let instances = self.query_vc_instances().await?;

        // Match by displayName, instanceId, or productId
        let matched: Vec<VsInstance> = instances
            .into_iter()
            .filter(|i| {
                i.display_name.to_lowercase().contains(&name.to_lowercase())
                    || i.instance_id == name
                    || i.product_id
                        .as_deref()
                        .map(|pid| pid.to_lowercase().contains(&name.to_lowercase()))
                        .unwrap_or(false)
            })
            .collect();

        if matched.is_empty() {
            return Err(CogniaError::Provider(format!(
                "No Visual Studio instance matching '{}'",
                name
            )));
        }

        let mut last_issue: Option<MsvcDetectionIssue> = None;
        for instance in matched {
            match self.validate_instance(instance).await {
                Ok(validated) => {
                    let versions = vec![VersionInfo {
                        version: validated.toolset_version.clone(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }];

                    return Ok(PackageInfo {
                        name: validated.instance.display_name.clone(),
                        display_name: Some(validated.instance.display_name.clone()),
                        description: Some(format!(
                            "Visual Studio {} ({})",
                            validated.instance.installation_version, validated.instance.instance_id
                        )),
                        homepage: Some(
                            "https://visualstudio.microsoft.com/vs/features/cplusplus/".to_string(),
                        ),
                        license: Some("Proprietary".to_string()),
                        repository: None,
                        versions,
                        provider: self.id().into(),
                    });
                }
                Err(issue) => {
                    last_issue = choose_more_actionable_issue(last_issue, issue);
                }
            }
        }

        Err(last_issue
            .unwrap_or_else(|| MsvcDetectionIssue::new(MsvcDetectionReason::NoVcInstance))
            .to_error())
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let instances = self.query_vc_instances().await?;
        let mut versions = Vec::new();

        for instance in instances {
            if let Ok(validated) = self.validate_instance(instance).await {
                versions.push(VersionInfo {
                    version: validated.toolset_version,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                });
            }
        }

        Ok(versions)
    }

    async fn install(&self, _request: InstallRequest) -> CogniaResult<InstallReceipt> {
        Err(CogniaError::Provider(
            "MSVC cannot be installed through this tool. Use one of:\n\
             - winget install Microsoft.VisualStudio.2022.BuildTools --override \"--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64\"\n\
             - Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/"
                .into(),
        ))
    }

    async fn uninstall(&self, _request: UninstallRequest) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "MSVC cannot be uninstalled through this tool. Use Visual Studio Installer or \
             Settings > Apps to remove Visual Studio / Build Tools."
                .into(),
        ))
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let instances = self.query_vc_instances().await?;
        let mut packages = Vec::new();

        for instance in instances {
            let name = instance.display_name.clone();

            if let Some(ref name_filter) = filter.name_filter {
                if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                    continue;
                }
            }

            let Ok(validated) = self.validate_instance(instance).await else {
                continue;
            };

            packages.push(InstalledPackage {
                name: validated.instance.display_name.clone(),
                version: validated.toolset_version,
                provider: self.id().into(),
                install_path: PathBuf::from(&validated.instance.installation_path),
                installed_at: String::new(),
                is_global: true,
            });
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Cannot detect remote VS updates from vswhere
        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for MsvcProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.resolve_usable_toolchain().await.is_ok())
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let resolved = self.get_usable_toolchain().await?;
        Ok(resolved.toolset_version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        let resolved = self.get_usable_toolchain().await?;
        Ok(resolved.cl_exe_path)
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "winget install Microsoft.VisualStudio.2022.BuildTools \
             --override \"--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64\""
                .to_string(),
        )
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let instances = self.query_vc_instances().await?;
        let mut matched = instances.into_iter().filter(|i| {
            i.display_name.to_lowercase().contains(&name.to_lowercase()) || i.instance_id == name
        });

        while let Some(instance) = matched.next() {
            if self.validate_instance(instance).await.is_ok() {
                return Ok(true);
            }
        }

        Ok(false)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_instance(install_path: &Path) -> VsInstance {
        VsInstance {
            instance_id: "inst-test".to_string(),
            installation_path: install_path.to_string_lossy().to_string(),
            installation_version: "17.9.0".to_string(),
            display_name: "Visual Studio Build Tools 2022".to_string(),
            product_id: Some("Microsoft.VisualStudio.Product.BuildTools".to_string()),
            is_prerelease: Some(false),
        }
    }

    #[test]
    fn test_find_vswhere_path_construction() {
        // Verify path construction logic (does not require vswhere on disk)
        let pf86 = r"C:\Program Files (x86)";
        let expected = PathBuf::from(pf86)
            .join("Microsoft Visual Studio")
            .join("Installer")
            .join("vswhere.exe");
        assert!(expected.to_string_lossy().contains("vswhere.exe"));
        assert!(expected
            .to_string_lossy()
            .contains("Microsoft Visual Studio"));
    }

    #[test]
    fn test_parse_vswhere_json_single() {
        let json = r#"[
            {
                "instanceId": "abc123",
                "installationPath": "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community",
                "installationVersion": "17.9.34728.123",
                "displayName": "Visual Studio Community 2022",
                "productId": "Microsoft.VisualStudio.Product.Community",
                "isPrerelease": false
            }
        ]"#;

        let instances = parse_vswhere_json(json).unwrap();
        assert_eq!(instances.len(), 1);
        assert_eq!(instances[0].instance_id, "abc123");
        assert_eq!(instances[0].display_name, "Visual Studio Community 2022");
        assert_eq!(instances[0].installation_version, "17.9.34728.123");
        assert_eq!(instances[0].is_prerelease, Some(false));
    }

    #[test]
    fn test_parse_vswhere_json_multiple() {
        let json = r#"[
            {
                "instanceId": "inst1",
                "installationPath": "C:\\VS\\2022\\Community",
                "installationVersion": "17.9.0",
                "displayName": "Visual Studio Community 2022"
            },
            {
                "instanceId": "inst2",
                "installationPath": "C:\\VS\\2022\\BuildTools",
                "installationVersion": "17.9.0",
                "displayName": "Visual Studio Build Tools 2022",
                "productId": "Microsoft.VisualStudio.Product.BuildTools",
                "isPrerelease": false
            }
        ]"#;

        let instances = parse_vswhere_json(json).unwrap();
        assert_eq!(instances.len(), 2);
        assert_eq!(instances[0].instance_id, "inst1");
        assert_eq!(instances[1].instance_id, "inst2");
        assert_eq!(instances[1].display_name, "Visual Studio Build Tools 2022");
    }

    #[test]
    fn test_parse_vswhere_json_empty() {
        assert!(parse_vswhere_json("").unwrap().is_empty());
        assert!(parse_vswhere_json("[]").unwrap().is_empty());
        assert!(parse_vswhere_json("  ").unwrap().is_empty());
    }

    #[test]
    fn test_parse_vswhere_json_malformed() {
        let result = parse_vswhere_json("{not valid json}");
        assert!(result.is_err());
    }

    #[test]
    fn test_detection_reason_codes_are_stable() {
        assert_eq!(
            MsvcDetectionReason::VswhereMissing.code(),
            "vswhere-missing"
        );
        assert_eq!(MsvcDetectionReason::NoVcInstance.code(), "no-vc-instance");
        assert_eq!(
            MsvcDetectionReason::ToolsetMissing.code(),
            "toolset-missing"
        );
        assert_eq!(
            MsvcDetectionReason::CompilerMissing.code(),
            "compiler-missing"
        );
        assert_eq!(
            MsvcDetectionReason::CompilerNotRunnable.code(),
            "compiler-not-runnable"
        );
    }

    #[test]
    fn test_choose_more_actionable_issue_prefers_higher_severity() {
        let low = MsvcDetectionIssue::new(MsvcDetectionReason::ToolsetMissing);
        let high = MsvcDetectionIssue::new(MsvcDetectionReason::CompilerNotRunnable);
        let chosen = choose_more_actionable_issue(Some(low), high).unwrap();
        assert_eq!(chosen.reason, MsvcDetectionReason::CompilerNotRunnable);
    }

    #[test]
    fn test_probe_output_usable_with_success_exit() {
        assert!(probe_output_indicates_usable_compiler(true, "", ""));
    }

    #[test]
    fn test_probe_output_usable_with_compiler_banner() {
        let stderr = "Microsoft (R) C/C++ Optimizing Compiler Version 19.40.33811 for x64";
        assert!(probe_output_indicates_usable_compiler(false, "", stderr));
    }

    #[test]
    fn test_probe_output_rejects_unrelated_failure() {
        let stderr = "The system cannot find the path specified.";
        assert!(!probe_output_indicates_usable_compiler(false, "", stderr));
    }

    #[test]
    fn test_resolve_instance_toolchain_missing_toolset() {
        let dir = tempdir().unwrap();
        let instance = make_instance(dir.path());
        let err = resolve_instance_toolchain(&instance).unwrap_err();
        assert_eq!(err.reason, MsvcDetectionReason::ToolsetMissing);
    }

    #[test]
    fn test_resolve_instance_toolchain_missing_compiler() {
        let dir = tempdir().unwrap();
        let toolset_version = "14.40.33807";
        let version_file = dir
            .path()
            .join("VC")
            .join("Auxiliary")
            .join("Build")
            .join("Microsoft.VCToolsVersion.default.txt");
        std::fs::create_dir_all(version_file.parent().unwrap()).unwrap();
        std::fs::write(&version_file, format!("{}\r\n", toolset_version)).unwrap();

        let instance = make_instance(dir.path());
        let err = resolve_instance_toolchain(&instance).unwrap_err();
        assert_eq!(err.reason, MsvcDetectionReason::CompilerMissing);
    }

    #[test]
    fn test_resolve_instance_toolchain_prefers_x64_compiler() {
        let dir = tempdir().unwrap();
        let toolset_version = "14.40.33807";
        let version_file = dir
            .path()
            .join("VC")
            .join("Auxiliary")
            .join("Build")
            .join("Microsoft.VCToolsVersion.default.txt");
        std::fs::create_dir_all(version_file.parent().unwrap()).unwrap();
        std::fs::write(&version_file, format!("{}\r\n", toolset_version)).unwrap();

        let cl_x64 = dir
            .path()
            .join("VC")
            .join("Tools")
            .join("MSVC")
            .join(toolset_version)
            .join("bin")
            .join("HostX64")
            .join("x64")
            .join("cl.exe");
        std::fs::create_dir_all(cl_x64.parent().unwrap()).unwrap();
        std::fs::write(&cl_x64, "").unwrap();

        let cl_x86 = dir
            .path()
            .join("VC")
            .join("Tools")
            .join("MSVC")
            .join(toolset_version)
            .join("bin")
            .join("Hostx86")
            .join("x86")
            .join("cl.exe");
        std::fs::create_dir_all(cl_x86.parent().unwrap()).unwrap();
        std::fs::write(&cl_x86, "").unwrap();

        let instance = make_instance(dir.path());
        let (toolset, cl_path) = resolve_instance_toolchain(&instance).unwrap();
        assert_eq!(toolset, toolset_version);
        assert_eq!(cl_path, cl_x64);
    }

    #[test]
    fn test_resolve_instance_toolchain_falls_back_to_x86_compiler() {
        let dir = tempdir().unwrap();
        let toolset_version = "14.40.33807";
        let version_file = dir
            .path()
            .join("VC")
            .join("Auxiliary")
            .join("Build")
            .join("Microsoft.VCToolsVersion.default.txt");
        std::fs::create_dir_all(version_file.parent().unwrap()).unwrap();
        std::fs::write(&version_file, format!("{}\r\n", toolset_version)).unwrap();

        let cl_x86 = dir
            .path()
            .join("VC")
            .join("Tools")
            .join("MSVC")
            .join(toolset_version)
            .join("bin")
            .join("Hostx86")
            .join("x86")
            .join("cl.exe");
        std::fs::create_dir_all(cl_x86.parent().unwrap()).unwrap();
        std::fs::write(&cl_x86, "").unwrap();

        let instance = make_instance(dir.path());
        let (toolset, cl_path) = resolve_instance_toolchain(&instance).unwrap();
        assert_eq!(toolset, toolset_version);
        assert_eq!(cl_path, cl_x86);
    }

    #[tokio::test]
    async fn test_is_available_false_when_vswhere_missing() {
        let p = MsvcProvider { vswhere_path: None };
        assert!(!p.is_available().await);
    }

    #[tokio::test]
    async fn test_check_system_requirements_false_when_vswhere_missing() {
        let p = MsvcProvider { vswhere_path: None };
        let ok = p.check_system_requirements().await.unwrap();
        assert!(!ok);
    }

    #[tokio::test]
    async fn test_get_version_error_includes_reason_code() {
        let p = MsvcProvider { vswhere_path: None };
        let err = p.get_version().await.unwrap_err();
        assert!(format!("{}", err).contains("[vswhere-missing]"));
    }

    #[tokio::test]
    async fn test_get_executable_path_error_includes_reason_code() {
        let p = MsvcProvider { vswhere_path: None };
        let err = p.get_executable_path().await.unwrap_err();
        assert!(format!("{}", err).contains("[vswhere-missing]"));
    }

    #[test]
    fn test_read_toolset_version() {
        // Test the parsing logic (version string trimming)
        let raw = "14.39.33519\r\n";
        let version = raw.trim().to_string();
        assert_eq!(version, "14.39.33519");

        let raw2 = "14.40.33807\n";
        let version2 = raw2.trim().to_string();
        assert_eq!(version2, "14.40.33807");
    }

    #[test]
    fn test_provider_metadata() {
        let p = MsvcProvider { vswhere_path: None };
        assert_eq!(p.id(), "msvc");
        assert_eq!(p.display_name(), "MSVC (Visual Studio Build Tools)");
        assert_eq!(p.priority(), 75);
    }

    #[test]
    fn test_capabilities() {
        let p = MsvcProvider { vswhere_path: None };
        let caps = p.capabilities();
        assert!(caps.contains(&Capability::List));
        assert_eq!(caps.len(), 1);
        // Should NOT have Search, Install, Uninstall
        assert!(!caps.contains(&Capability::Install));
        assert!(!caps.contains(&Capability::Search));
    }

    #[test]
    fn test_infer_toolset_version_from_cl_path() {
        let path = PathBuf::from(
            r"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\cl.exe",
        );
        assert_eq!(
            infer_toolset_version_from_cl_path(&path).as_deref(),
            Some("14.44.35207")
        );
    }

    #[test]
    fn test_candidate_cl_paths_include_arm64_variants() {
        let paths = candidate_cl_paths_from_vctools_install_dir(Path::new(
            r"C:\VS\VC\Tools\MSVC\14.42.34433",
        ));
        let as_strings = paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(as_strings
            .iter()
            .any(|path| path.contains(r"HostX64\arm64\cl.exe")));
        assert!(as_strings
            .iter()
            .any(|path| path.contains(r"HostArm64\arm64\cl.exe")));
    }

    #[test]
    fn test_sort_msvc_candidates_prefers_current_host_target_architecture() {
        let preferred = preferred_msvc_architecture().to_string();
        let mut candidates = vec![
            PathBuf::from(r"C:\VS\VC\Tools\MSVC\14.42.34433\bin\Hostx86\x86\cl.exe"),
            PathBuf::from(r"C:\VS\VC\Tools\MSVC\14.42.34433\bin\Hostx64\x64\cl.exe"),
            PathBuf::from(r"C:\VS\VC\Tools\MSVC\14.42.34433\bin\HostArm64\arm64\cl.exe"),
        ];

        sort_msvc_candidates_in_place(&mut candidates);
        let (_, target) = infer_msvc_host_target(&candidates[0]);

        assert_eq!(target.as_deref(), Some(preferred.as_str()));
    }
}
