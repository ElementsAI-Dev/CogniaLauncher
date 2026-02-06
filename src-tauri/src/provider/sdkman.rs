use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// SDKMAN! - Software Development Kit Manager
/// Manages multiple Java SDKs and related tools
pub struct SdkmanProvider {
    sdkman_dir: Option<PathBuf>,
}

impl SdkmanProvider {
    pub fn new() -> Self {
        Self {
            sdkman_dir: Self::detect_sdkman_dir(),
        }
    }

    fn detect_sdkman_dir() -> Option<PathBuf> {
        // Check SDKMAN_DIR environment variable first
        if let Ok(dir) = std::env::var("SDKMAN_DIR") {
            return Some(PathBuf::from(dir));
        }

        // Default location
        dirs_home().map(|h| h.join(".sdkman"))
    }

    fn sdkman_dir(&self) -> CogniaResult<PathBuf> {
        self.sdkman_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("SDKMAN_DIR not found".into()))
    }

    async fn run_sdk(&self, args: &[&str]) -> CogniaResult<String> {
        let sdkman_dir = self.sdkman_dir()?;
        let init_script = sdkman_dir.join("bin").join("sdkman-init.sh");
        
        // SDK must be sourced before use
        let cmd = format!(
            "source \"{}\" && sdk {}",
            init_script.display(),
            args.join(" ")
        );
        
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute_shell(&cmd, Some(opts)).await?;
        
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    fn list_candidates_dir(&self) -> CogniaResult<PathBuf> {
        Ok(self.sdkman_dir()?.join("candidates").join("java"))
    }
}

impl Default for SdkmanProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for SdkmanProvider {
    fn id(&self) -> &str {
        "sdkman"
    }

    fn display_name(&self) -> &str {
        "SDKMAN! (Java SDK Manager)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        let Some(sdkman_dir) = &self.sdkman_dir else {
            return false;
        };
        // Check init script exists
        if !sdkman_dir.join("bin").join("sdkman-init.sh").exists() {
            return false;
        }
        // Verify sdk command actually works
        match self.run_sdk(&["version"]).await {
            Ok(out) => !out.is_empty(),
            Err(_) => {
                // Fallback: if run_sdk fails but init script exists, it's still available
                true
            }
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_sdk(&["list", "java"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                !trimmed.is_empty() 
                    && !trimmed.starts_with("=")
                    && !trimmed.starts_with("Available")
                    && !trimmed.starts_with("Vendor")
                    && !trimmed.starts_with("Use")
                    && (trimmed.contains(query) || query.is_empty())
            })
            .filter_map(|line| {
                // Parse SDKMAN output format: " Vendor | Use | Version | Dist | Status | Identifier"
                let parts: Vec<&str> = line.split('|').map(|s| s.trim()).collect();
                if parts.len() >= 6 {
                    let identifier = parts[5];
                    Some(PackageSummary {
                        name: format!("java@{}", identifier),
                        description: Some(format!("{} Java", parts[0])),
                        latest_version: Some(identifier.to_string()),
                        provider: self.id().to_string(),
                    })
                } else {
                    None
                }
            })
            .take(20)
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("java@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Java {}", version)),
            description: Some("Java Development Kit".into()),
            homepage: Some("https://sdkman.io".into()),
            license: Some("Various".into()),
            repository: None,
            versions: vec![VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // List installed versions from filesystem for faster response
        let java_dir = self.list_candidates_dir()?;
        
        if !java_dir.exists() {
            return Ok(vec![]);
        }

        let mut versions = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&java_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name != "current" {
                            versions.push(VersionInfo {
                                version: name.to_string(),
                                release_date: None,
                                deprecated: false,
                                yanked: false,
                            });
                        }
                    }
                }
            }
        }

        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for install".into()))?;

        self.run_sdk(&["install", "java", &version]).await?;

        let java_dir = self.list_candidates_dir()?;
        let install_path = java_dir.join(&version);

        Ok(InstallReceipt {
            name: "java".to_string(),
            version,
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for uninstall".into()))?;

        self.run_sdk(&["uninstall", "java", &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let java_dir = self.list_candidates_dir()?;
        
        if !java_dir.exists() {
            return Ok(vec![]);
        }

        let mut packages = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&java_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(version) = entry.file_name().to_str() {
                        if version == "current" {
                            continue;
                        }
                        
                        let name = format!("java@{}", version);
                        
                        if let Some(ref name_filter) = filter.name_filter {
                            if !name.contains(name_filter) {
                                continue;
                            }
                        }

                        packages.push(InstalledPackage {
                            name,
                            version: version.to_string(),
                            provider: self.id().into(),
                            install_path: entry.path(),
                            installed_at: String::new(),
                            is_global: true,
                        });
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for SdkmanProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let java_dir = self.list_candidates_dir()?;
        let current = self.get_current_version().await?.unwrap_or_default();

        if !java_dir.exists() {
            return Ok(vec![]);
        }

        let mut versions = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&java_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(version) = entry.file_name().to_str() {
                        if version == "current" {
                            continue;
                        }
                        versions.push(InstalledVersion {
                            version: version.to_string(),
                            install_path: entry.path(),
                            size: None,
                            installed_at: None,
                            is_current: version == current,
                        });
                    }
                }
            }
        }

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let java_dir = self.list_candidates_dir()?;
        let current_link = java_dir.join("current");
        
        if current_link.exists() {
            if let Ok(target) = std::fs::read_link(&current_link) {
                if let Some(version) = target.file_name().and_then(|n| n.to_str()) {
                    return Ok(Some(version.to_string()));
                }
            }
        }

        Ok(None)
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_sdk(&["default", "java", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        // Write .sdkmanrc file
        let sdkmanrc = project_path.join(".sdkmanrc");
        let content = format!("java={}\n", version);
        crate::platform::fs::write_file_string(&sdkmanrc, &content).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        // Walk up directory tree looking for version files
        loop {
            // 1. Check .java-version file (highest priority)
            let version_file = current.join(".java-version");
            if version_file.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await {
                    let version = content.trim().to_string();
                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(version_file),
                        }));
                    }
                }
            }

            // 2. Check .sdkmanrc file
            let sdkmanrc = current.join(".sdkmanrc");
            if sdkmanrc.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&sdkmanrc).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("java=") {
                            let version = line.strip_prefix("java=").unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(sdkmanrc),
                                }));
                            }
                        }
                    }
                }
            }

            // 3. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("java ") {
                            let version = line.strip_prefix("java ").unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 4. Check pom.xml for java.version property
        let pom_xml = start_path.join("pom.xml");
        if pom_xml.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&pom_xml).await {
                // Simple regex-free parsing for <java.version>XX</java.version>
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with("<java.version>") && line.ends_with("</java.version>") {
                        let version = line
                            .strip_prefix("<java.version>")
                            .and_then(|s| s.strip_suffix("</java.version>"))
                            .unwrap_or("")
                            .trim();
                        if !version.is_empty() {
                            return Ok(Some(VersionDetection {
                                version: version.to_string(),
                                source: VersionSource::Manifest,
                                source_path: Some(pom_xml),
                            }));
                        }
                    }
                }
            }
        }

        // 5. Fall back to current SDKMAN version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let java_dir = self.list_candidates_dir()?;
        let java_home = java_dir.join(version);
        let bin_path = java_home.join("bin");

        Ok(EnvModifications::new()
            .prepend_path(bin_path)
            .set_var("JAVA_HOME", java_home.to_string_lossy().to_string()))
    }

    fn version_file_name(&self) -> &str {
        ".java-version"
    }
}
