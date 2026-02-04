use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Deno - A secure runtime for JavaScript and TypeScript
///
/// Deno has built-in version management through the `deno upgrade` command.
/// This provider manages Deno versions using dvm (Deno Version Manager) or
/// direct installation from GitHub releases.
pub struct DenoProvider {
    deno_dir: Option<PathBuf>,
    client: Client,
}

impl DenoProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self {
            deno_dir: Self::detect_deno_dir(),
            client,
        }
    }

    fn detect_deno_dir() -> Option<PathBuf> {
        // Check DENO_DIR environment variable first
        if let Ok(dir) = std::env::var("DENO_DIR") {
            return Some(PathBuf::from(dir));
        }

        // Default locations
        if cfg!(windows) {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("deno"))
                .or_else(|| {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".deno"))
                })
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".deno"))
                .or_else(|| {
                    std::env::var("XDG_CACHE_HOME")
                        .ok()
                        .map(|p| PathBuf::from(p).join("deno"))
                })
        }
    }

    fn deno_dir(&self) -> CogniaResult<PathBuf> {
        self.deno_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("Deno directory not found".into()))
    }

    fn dvm_dir() -> Option<PathBuf> {
        // DVM (Deno Version Manager) directory
        if cfg!(windows) {
            std::env::var("USERPROFILE")
                .ok()
                .map(|p| PathBuf::from(p).join(".dvm"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".dvm"))
        }
    }

    fn has_dvm() -> bool {
        if let Some(dvm_dir) = Self::dvm_dir() {
            dvm_dir.exists()
        } else {
            false
        }
    }

    async fn run_deno(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("deno", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn run_dvm(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let output = process::execute("dvm", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn get_deno_version(&self) -> CogniaResult<String> {
        let output = self.run_deno(&["--version"]).await?;
        // Output format: "deno 1.40.0 (release, x86_64-unknown-linux-gnu)"
        for line in output.lines() {
            if line.starts_with("deno ") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    return Ok(parts[1].to_string());
                }
            }
        }
        Err(CogniaError::Provider("Could not parse Deno version".into()))
    }

    async fn fetch_available_versions(&self) -> CogniaResult<Vec<String>> {
        // Fetch from GitHub releases API
        let url = "https://api.github.com/repos/denoland/deno/releases?per_page=50";
        
        let response = self.client
            .get(url)
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "Failed to fetch Deno versions: {}",
                response.status()
            )));
        }

        let releases: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))?;

        let versions: Vec<String> = releases
            .iter()
            .filter_map(|release| {
                let tag = release["tag_name"].as_str()?;
                // Tags are like "v1.40.0"
                Some(tag.strip_prefix('v').unwrap_or(tag).to_string())
            })
            .collect();

        Ok(versions)
    }
}

impl Default for DenoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for DenoProvider {
    fn id(&self) -> &str {
        "deno"
    }

    fn display_name(&self) -> &str {
        "Deno"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        process::which("deno").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let versions = self.fetch_available_versions().await?;

        let results: Vec<PackageSummary> = versions
            .iter()
            .filter(|v| v.contains(query) || query.is_empty())
            .take(20)
            .map(|version| PackageSummary {
                name: format!("deno@{}", version),
                description: Some("Deno - A secure runtime for JavaScript and TypeScript".into()),
                latest_version: Some(version.clone()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(results)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("deno@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Deno {}", version)),
            description: Some("Deno - A secure runtime for JavaScript and TypeScript".into()),
            homepage: Some("https://deno.land".into()),
            license: Some("MIT".into()),
            repository: Some("https://github.com/denoland/deno".into()),
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
        let versions = self.fetch_available_versions().await?;

        Ok(versions
            .into_iter()
            .map(|version| VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req.version.as_deref().unwrap_or("latest");

        if Self::has_dvm() {
            // Use DVM if available
            self.run_dvm(&["install", version]).await?;
        } else {
            // Use deno upgrade for specific version
            if version == "latest" {
                self.run_deno(&["upgrade"]).await?;
            } else {
                self.run_deno(&["upgrade", "--version", version]).await?;
            }
        }

        let deno_dir = self.deno_dir()?;
        let install_path = if Self::has_dvm() {
            Self::dvm_dir()
                .unwrap_or(deno_dir.clone())
                .join("versions")
                .join(version)
        } else {
            deno_dir.join("bin")
        };

        Ok(InstallReceipt {
            name: "deno".to_string(),
            version: version.to_string(),
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

        if Self::has_dvm() {
            self.run_dvm(&["uninstall", &version]).await?;
        } else {
            return Err(CogniaError::Provider(
                "DVM is required to uninstall specific Deno versions. Install DVM or manually remove the Deno installation.".into()
            ));
        }

        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let mut packages = Vec::new();

        if Self::has_dvm() {
            // List versions from DVM
            let output = self.run_dvm(&["list"]).await?;
            let dvm_dir = Self::dvm_dir().unwrap_or_default();

            for line in output.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                // Parse DVM output - may have markers like "*" for current
                let version = line
                    .trim_start_matches('*')
                    .trim_start_matches('-')
                    .trim();

                if version.is_empty() {
                    continue;
                }

                let name = format!("deno@{}", version);

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        continue;
                    }
                }

                packages.push(InstalledPackage {
                    name,
                    version: version.to_string(),
                    provider: self.id().into(),
                    install_path: dvm_dir.join("versions").join(version),
                    installed_at: String::new(),
                    is_global: true,
                });
            }
        } else {
            // Only current version is available without DVM
            if let Ok(version) = self.get_deno_version().await {
                let name = format!("deno@{}", version);

                if filter.name_filter.as_ref().map_or(true, |f| name.contains(f)) {
                    let deno_dir = self.deno_dir().unwrap_or_default();
                    packages.push(InstalledPackage {
                        name,
                        version: version.clone(),
                        provider: self.id().into(),
                        install_path: deno_dir.join("bin"),
                        installed_at: String::new(),
                        is_global: true,
                    });
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
impl EnvironmentProvider for DenoProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let current = self.get_current_version().await?.unwrap_or_default();

        if Self::has_dvm() {
            let output = self.run_dvm(&["list"]).await?;
            let dvm_dir = Self::dvm_dir().unwrap_or_default();

            let versions: Vec<InstalledVersion> = output
                .lines()
                .filter_map(|line| {
                    let line = line.trim();
                    if line.is_empty() {
                        return None;
                    }

                    let is_current = line.starts_with('*');
                    let version = line
                        .trim_start_matches('*')
                        .trim_start_matches('-')
                        .trim()
                        .to_string();

                    if version.is_empty() {
                        return None;
                    }

                    Some(InstalledVersion {
                        version: version.clone(),
                        install_path: dvm_dir.join("versions").join(&version),
                        size: None,
                        installed_at: None,
                        is_current: is_current || version == current,
                    })
                })
                .collect();

            Ok(versions)
        } else {
            // Without DVM, only the current version is available
            if let Ok(version) = self.get_deno_version().await {
                let deno_dir = self.deno_dir().unwrap_or_default();
                Ok(vec![InstalledVersion {
                    version: version.clone(),
                    install_path: deno_dir.join("bin"),
                    size: None,
                    installed_at: None,
                    is_current: true,
                }])
            } else {
                Ok(vec![])
            }
        }
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        match self.get_deno_version().await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        if Self::has_dvm() {
            self.run_dvm(&["use", version]).await?;
        } else {
            // Without DVM, upgrade to the specific version
            self.run_deno(&["upgrade", "--version", version]).await?;
        }
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check for .deno-version file
        let version_files = [".deno-version", ".dvmrc"];

        let mut current = start_path.to_path_buf();
        loop {
            // 1. Check version files (highest priority)
            for file_name in &version_files {
                let version_file = current.join(file_name);
                if version_file.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await
                    {
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
            }

            // 2. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("deno ") {
                            let version = line
                                .strip_prefix("deno ")
                                .unwrap_or("")
                                .trim();
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

        // 3. Check deno.json or deno.jsonc for version hints
        for config_name in &["deno.json", "deno.jsonc"] {
            let config_file = start_path.join(config_name);
            if config_file.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&config_file).await {
                    // Try to parse as JSON (ignoring comments for .jsonc)
                    let clean_content: String = content
                        .lines()
                        .filter(|line| !line.trim().starts_with("//"))
                        .collect::<Vec<_>>()
                        .join("\n");
                    
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&clean_content) {
                        // Check for "deno" version field if it exists
                        if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
                            return Ok(Some(VersionDetection {
                                version: version.to_string(),
                                source: VersionSource::Manifest,
                                source_path: Some(config_file),
                            }));
                        }
                    }
                }
            }
        }

        // 4. Fall back to current version
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
        if Self::has_dvm() {
            let dvm_dir = Self::dvm_dir()
                .ok_or_else(|| CogniaError::Provider("DVM directory not found".into()))?;
            let bin_path = dvm_dir.join("versions").join(version).join("bin");
            Ok(EnvModifications::new().prepend_path(bin_path))
        } else {
            let deno_dir = self.deno_dir()?;
            let bin_path = deno_dir.join("bin");
            Ok(EnvModifications::new().prepend_path(bin_path))
        }
    }

    fn version_file_name(&self) -> &str {
        ".deno-version"
    }
}

#[async_trait]
impl SystemPackageProvider for DenoProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.list_installed_versions().await?;
        Ok(versions.iter().any(|v| v.version == name))
    }
}
