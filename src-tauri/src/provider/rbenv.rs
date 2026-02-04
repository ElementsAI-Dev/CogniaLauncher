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

/// rbenv - Ruby Version Manager
/// Simple Ruby version management
pub struct RbenvProvider {
    rbenv_root: Option<PathBuf>,
}

impl RbenvProvider {
    pub fn new() -> Self {
        Self {
            rbenv_root: Self::detect_rbenv_root(),
        }
    }

    fn detect_rbenv_root() -> Option<PathBuf> {
        // Check RBENV_ROOT environment variable first
        if let Ok(root) = std::env::var("RBENV_ROOT") {
            return Some(PathBuf::from(root));
        }

        // Default location
        dirs_home().map(|h| h.join(".rbenv"))
    }

    fn rbenv_root(&self) -> CogniaResult<PathBuf> {
        self.rbenv_root
            .clone()
            .ok_or_else(|| CogniaError::Provider("RBENV_ROOT not found".into()))
    }

    async fn run_rbenv(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("rbenv", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for RbenvProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for RbenvProvider {
    fn id(&self) -> &str {
        "rbenv"
    }

    fn display_name(&self) -> &str {
        "rbenv (Ruby Version Manager)"
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
        process::which("rbenv").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_rbenv(&["install", "--list"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .filter(|line| line.contains(query) || query.is_empty())
            .filter(|line| {
                line.chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
            })
            .take(20)
            .map(|version| PackageSummary {
                name: format!("ruby@{}", version),
                description: Some("Ruby programming language".into()),
                latest_version: Some(version.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("ruby@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Ruby {}", version)),
            description: Some("Ruby programming language".into()),
            homepage: Some("https://www.ruby-lang.org".into()),
            license: Some("BSD-2-Clause".into()),
            repository: Some("https://github.com/ruby/ruby".into()),
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
        let output = self.run_rbenv(&["install", "--list"]).await?;

        Ok(output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .filter(|line| {
                line.chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
            })
            .map(|version| VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for install".into()))?;

        self.run_rbenv(&["install", &version]).await?;

        let rbenv_root = self.rbenv_root()?;
        let install_path = rbenv_root.join("versions").join(&version);

        Ok(InstallReceipt {
            name: "ruby".to_string(),
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

        self.run_rbenv(&["uninstall", "-f", &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_rbenv(&["versions", "--bare"]).await?;
        let rbenv_root = self.rbenv_root()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .filter_map(|version| {
                let name = format!("ruby@{}", version);

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version: version.to_string(),
                    provider: self.id().into(),
                    install_path: rbenv_root.join("versions").join(version),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for RbenvProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_rbenv(&["versions", "--bare"]).await?;
        let current = self.get_current_version().await?.unwrap_or_default();
        let rbenv_root = self.rbenv_root()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|version| InstalledVersion {
                version: version.to_string(),
                install_path: rbenv_root.join("versions").join(version),
                size: None,
                installed_at: None,
                is_current: version == current,
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_rbenv(&["version-name"]).await?;
        let version = output.trim();

        if version == "system" || version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version.to_string()))
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_rbenv(&["global", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        // Walk up directory tree looking for version files
        loop {
            // 1. Check .ruby-version file (highest priority)
            let version_file = current.join(self.version_file_name());
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

            // 2. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("ruby ") {
                            let version = line.strip_prefix("ruby ").unwrap_or("").trim();
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

        // 3. Check Gemfile for ruby constraint
        let gemfile = start_path.join("Gemfile");
        if gemfile.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&gemfile).await {
                for line in content.lines() {
                    let line = line.trim();
                    // Match: ruby "3.2.2" or ruby '3.2.2'
                    if line.starts_with("ruby ") {
                        let version_part = line.strip_prefix("ruby ").unwrap_or("");
                        let version = version_part
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'')
                            .split(',')
                            .next()
                            .unwrap_or("")
                            .trim();
                        if !version.is_empty() && version.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                            return Ok(Some(VersionDetection {
                                version: version.to_string(),
                                source: VersionSource::Manifest,
                                source_path: Some(gemfile),
                            }));
                        }
                    }
                }
            }
        }

        // 4. Fall back to current rbenv version
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
        let rbenv_root = self.rbenv_root()?;
        let ruby_path = rbenv_root.join("versions").join(version).join("bin");

        Ok(EnvModifications::new().prepend_path(ruby_path))
    }

    fn version_file_name(&self) -> &str {
        ".ruby-version"
    }
}

#[async_trait]
impl SystemPackageProvider for RbenvProvider {
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
