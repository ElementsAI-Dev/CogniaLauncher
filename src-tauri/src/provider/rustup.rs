use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process,
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub struct RustupProvider {
    rustup_home: Option<PathBuf>,
    cargo_home: Option<PathBuf>,
}

impl RustupProvider {
    pub fn new() -> Self {
        let rustup_home = std::env::var("RUSTUP_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".rustup")));

        let cargo_home = std::env::var("CARGO_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".cargo")));

        Self {
            rustup_home,
            cargo_home,
        }
    }

    fn rustup_home(&self) -> CogniaResult<&PathBuf> {
        self.rustup_home
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("RUSTUP_HOME not found".into()))
    }

    async fn run_rustup(&self, args: &[&str]) -> CogniaResult<String> {
        let output = process::execute("rustup", args, None).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for RustupProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for RustupProvider {
    fn id(&self) -> &str {
        "rustup"
    }

    fn display_name(&self) -> &str {
        "Rust Toolchain Manager"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }

    fn priority(&self) -> i32 {
        100
    }

    async fn is_available(&self) -> bool {
        process::which("rustup").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let toolchains = vec!["stable", "beta", "nightly"];

        let results: Vec<PackageSummary> = toolchains
            .into_iter()
            .filter(|t| t.contains(query) || query.is_empty())
            .map(|toolchain| PackageSummary {
                name: format!("rust@{}", toolchain),
                description: Some("Rust programming language toolchain".into()),
                latest_version: Some(toolchain.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(results)
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions("rust").await?;

        Ok(PackageInfo {
            name: "rust".to_string(),
            display_name: Some("Rust".to_string()),
            description: Some(
                "A language empowering everyone to build reliable and efficient software"
                    .to_string(),
            ),
            homepage: Some("https://rust-lang.org".to_string()),
            license: Some("MIT/Apache-2.0".to_string()),
            repository: Some("https://github.com/rust-lang/rust".to_string()),
            versions,
            provider: self.id().to_string(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self
            .run_rustup(&["toolchain", "list"])
            .await
            .unwrap_or_default();

        let mut versions: Vec<VersionInfo> = output
            .lines()
            .map(|line| line.trim().replace(" (default)", ""))
            .filter(|line| !line.is_empty())
            .map(|version| VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        for channel in &["stable", "beta", "nightly"] {
            if !versions.iter().any(|v| v.version.starts_with(channel)) {
                versions.push(VersionInfo {
                    version: channel.to_string(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                });
            }
        }

        Ok(versions)
    }

    async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt> {
        let toolchain = request.version.as_deref().unwrap_or("stable");

        self.run_rustup(&["toolchain", "install", toolchain])
            .await?;

        let rustup_home = self.rustup_home()?;
        let install_path = rustup_home.join("toolchains").join(toolchain);

        Ok(InstallReceipt {
            name: "rust".to_string(),
            version: toolchain.to_string(),
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, request: UninstallRequest) -> CogniaResult<()> {
        let toolchain = request
            .version
            .ok_or_else(|| CogniaError::Provider("Toolchain required for uninstall".into()))?;

        self.run_rustup(&["toolchain", "uninstall", &toolchain])
            .await?;
        Ok(())
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_rustup(&["toolchain", "list"]).await?;
        let rustup_home = self.rustup_home()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .map(|line| line.trim().replace(" (default)", ""))
            .filter(|line| !line.is_empty())
            .map(|toolchain| InstalledPackage {
                name: "rust".to_string(),
                version: toolchain.clone(),
                provider: self.id().to_string(),
                install_path: rustup_home.join("toolchains").join(&toolchain),
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let output = self.run_rustup(&["check"]).await?;

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|line| line.contains("Update available"))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    Some(UpdateInfo {
                        name: "rust".to_string(),
                        current_version: parts.first()?.to_string(),
                        latest_version: parts.last()?.to_string(),
                        provider: self.id().to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(updates)
    }
}

#[async_trait]
impl EnvironmentProvider for RustupProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_rustup(&["toolchain", "list"]).await?;
        let rustup_home = self.rustup_home()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .map(|line| {
                let is_default = line.contains("(default)");
                let toolchain = line.trim().replace(" (default)", "");
                (toolchain, is_default)
            })
            .filter(|(line, _)| !line.is_empty())
            .map(|(toolchain, is_default)| InstalledVersion {
                version: toolchain.clone(),
                install_path: rustup_home.join("toolchains").join(&toolchain),
                size: None,
                installed_at: None,
                is_current: is_default,
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_rustup(&["default"]).await?;
        let version = output.split_whitespace().next();
        Ok(version.map(|s| s.to_string()))
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_rustup(&["default", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let toolchain_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&toolchain_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        loop {
            // 1. Check rust-toolchain.toml (TOML format, highest priority)
            let toolchain_toml = current.join("rust-toolchain.toml");
            if toolchain_toml.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&toolchain_toml).await {
                    // Parse [toolchain] channel = "..."
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("channel") {
                            if let Some(value) = line.split('=').nth(1) {
                                let version = value
                                    .trim()
                                    .trim_matches('"')
                                    .trim_matches('\'')
                                    .trim();
                                if !version.is_empty() {
                                    return Ok(Some(VersionDetection {
                                        version: version.to_string(),
                                        source: VersionSource::LocalFile,
                                        source_path: Some(toolchain_toml),
                                    }));
                                }
                            }
                        }
                    }
                }
            }

            // 2. Check rust-toolchain (plain text format)
            let toolchain_plain = current.join("rust-toolchain");
            if toolchain_plain.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&toolchain_plain).await {
                    // Plain format: just the channel name on a line
                    let version = content
                        .lines()
                        .find(|line| !line.starts_with('#') && !line.trim().is_empty())
                        .unwrap_or("")
                        .trim();

                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version: version.to_string(),
                            source: VersionSource::LocalFile,
                            source_path: Some(toolchain_plain),
                        }));
                    }
                }
            }

            // 3. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("rust ") {
                            let version = line.strip_prefix("rust ").unwrap_or("").trim();
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

        // 4. Fall back to current rustup default
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
        let rustup_home = self.rustup_home()?;
        let toolchain_path = rustup_home.join("toolchains").join(version).join("bin");

        let mut mods = EnvModifications::new().prepend_path(toolchain_path);

        if let Some(cargo_home) = &self.cargo_home {
            mods = mods.prepend_path(cargo_home.join("bin"));
        }

        Ok(mods)
    }

    fn version_file_name(&self) -> &str {
        "rust-toolchain.toml"
    }
}
