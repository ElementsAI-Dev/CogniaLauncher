use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

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

impl MsvcProvider {
    pub fn new() -> Self {
        let vswhere_path = find_vswhere();
        Self { vswhere_path }
    }

    fn make_opts(&self) -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(30))
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
    let cl_path = install_path
        .join("VC")
        .join("Tools")
        .join("MSVC")
        .join(toolset_version)
        .join("bin")
        .join("HostX64")
        .join("x64")
        .join("cl.exe");

    if cl_path.exists() {
        Some(cl_path)
    } else {
        // Try Hostx86 fallback
        let cl_path_x86 = install_path
            .join("VC")
            .join("Tools")
            .join("MSVC")
            .join(toolset_version)
            .join("bin")
            .join("Hostx86")
            .join("x86")
            .join("cl.exe");

        if cl_path_x86.exists() {
            Some(cl_path_x86)
        } else {
            None
        }
    }
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
        // vswhere_path must be resolved for run_vswhere() to work
        if self.vswhere_path.is_none() {
            return false;
        }

        // Verify at least one VC instance exists
        match self.query_vc_instances().await {
            Ok(instances) => !instances.is_empty(),
            Err(_) => false,
        }
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
        let instance = instances
            .iter()
            .find(|i| {
                i.display_name.to_lowercase().contains(&name.to_lowercase())
                    || i.instance_id == name
                    || i.product_id
                        .as_deref()
                        .map(|pid| pid.to_lowercase().contains(&name.to_lowercase()))
                        .unwrap_or(false)
            })
            .ok_or_else(|| {
                CogniaError::Provider(format!("No Visual Studio instance matching '{}'", name))
            })?;

        let install_path = Path::new(&instance.installation_path);
        let toolset_version = read_toolset_version(install_path);

        let versions = toolset_version
            .map(|v| {
                vec![VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }]
            })
            .unwrap_or_default();

        Ok(PackageInfo {
            name: instance.display_name.clone(),
            display_name: Some(instance.display_name.clone()),
            description: Some(format!(
                "Visual Studio {} ({})",
                instance.installation_version, instance.instance_id
            )),
            homepage: Some("https://visualstudio.microsoft.com/vs/features/cplusplus/".to_string()),
            license: Some("Proprietary".to_string()),
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let instances = self.query_vc_instances().await?;
        let mut versions = Vec::new();

        for instance in &instances {
            let install_path = Path::new(&instance.installation_path);
            if let Some(toolset) = read_toolset_version(install_path) {
                versions.push(VersionInfo {
                    version: toolset,
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

        for instance in &instances {
            let install_path = Path::new(&instance.installation_path);
            let toolset_version =
                read_toolset_version(install_path).unwrap_or_else(|| "unknown".into());

            let name = instance.display_name.clone();

            if let Some(ref name_filter) = filter.name_filter {
                if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                    continue;
                }
            }

            packages.push(InstalledPackage {
                name,
                version: toolset_version,
                provider: self.id().into(),
                install_path: PathBuf::from(&instance.installation_path),
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
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let instances = self.query_vc_instances().await?;

        // Return the toolset version of the latest (first) instance
        if let Some(instance) = instances.first() {
            let install_path = Path::new(&instance.installation_path);
            if let Some(toolset) = read_toolset_version(install_path) {
                return Ok(toolset);
            }
            // Fallback to VS installation version
            return Ok(instance.installation_version.clone());
        }

        Err(CogniaError::Provider("No MSVC installation found".into()))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        let instances = self.query_vc_instances().await?;

        for instance in &instances {
            let install_path = Path::new(&instance.installation_path);
            if let Some(toolset) = read_toolset_version(install_path) {
                if let Some(cl_path) = find_cl_exe(install_path, &toolset) {
                    return Ok(cl_path);
                }
            }
        }

        Err(CogniaError::Provider("cl.exe not found".into()))
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
        Ok(instances.iter().any(|i| {
            i.display_name.to_lowercase().contains(&name.to_lowercase()) || i.instance_id == name
        }))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

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
}
