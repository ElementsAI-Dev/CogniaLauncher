use super::api::get_api_client;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// goenv - Go Version Management
/// Similar to pyenv but for Go
pub struct GoenvProvider {
    goenv_root: Option<PathBuf>,
}

impl GoenvProvider {
    pub fn new() -> Self {
        Self {
            goenv_root: Self::detect_goenv_root(),
        }
    }

    fn detect_goenv_root() -> Option<PathBuf> {
        // Check GOENV_ROOT environment variable first
        if let Ok(root) = std::env::var("GOENV_ROOT") {
            return Some(PathBuf::from(root));
        }

        // Default location
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join(".goenv"))
    }

    fn goenv_root(&self) -> CogniaResult<PathBuf> {
        self.goenv_root
            .clone()
            .ok_or_else(|| CogniaError::Provider("GOENV_ROOT not found".into()))
    }

    async fn run_goenv(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("goenv", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for GoenvProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GoenvProvider {
    fn id(&self) -> &str {
        "goenv"
    }

    fn display_name(&self) -> &str {
        "goenv (Go Version Manager)"
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
        process::which("goenv").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let output = self.run_goenv(&["install", "--list"]).await?;

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
                name: format!("go@{}", version),
                description: Some("Go programming language".into()),
                latest_version: Some(version.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("go@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Go {}", version)),
            description: Some("Go programming language".into()),
            homepage: Some("https://go.dev".into()),
            license: Some("BSD-3-Clause".into()),
            repository: Some("https://github.com/golang/go".into()),
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
        let output = self.run_goenv(&["install", "--list"]).await?;

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

        self.run_goenv(&["install", &version]).await?;

        let goenv_root = self.goenv_root()?;
        let install_path = goenv_root.join("versions").join(&version);

        Ok(InstallReceipt {
            name: "go".to_string(),
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

        self.run_goenv(&["uninstall", "-f", &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_goenv(&["versions", "--bare"]).await?;
        let goenv_root = self.goenv_root()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .filter_map(|version| {
                let name = format!("go@{}", version);

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version: version.to_string(),
                    provider: self.id().into(),
                    install_path: goenv_root.join("versions").join(version),
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
impl EnvironmentProvider for GoenvProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_goenv(&["versions", "--bare"]).await?;
        let current = self.get_current_version().await?.unwrap_or_default();
        let goenv_root = self.goenv_root()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .map(|version| InstalledVersion {
                version: version.to_string(),
                install_path: goenv_root.join("versions").join(version),
                size: None,
                installed_at: None,
                is_current: version == current,
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_goenv(&["version-name"]).await?;
        let version = output.trim();

        if version == "system" || version.is_empty() {
            Ok(None)
        } else {
            Ok(Some(version.to_string()))
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_goenv(&["global", version]).await?;
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
            // 1. Check .go-version file (highest priority)
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
                        if line.starts_with("golang ") || line.starts_with("go ") {
                            let version = line
                                .strip_prefix("golang ")
                                .or_else(|| line.strip_prefix("go "))
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

        // 3. Check go.mod for go directive
        let go_mod = start_path.join("go.mod");
        if go_mod.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&go_mod).await {
                for line in content.lines() {
                    let line = line.trim();
                    if let Some(stripped) = line.strip_prefix("go ") {
                        let version = stripped.trim().to_string();
                        if !version.is_empty() {
                            return Ok(Some(VersionDetection {
                                version,
                                source: VersionSource::Manifest,
                                source_path: Some(go_mod),
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
        let goenv_root = self.goenv_root()?;
        let go_path = goenv_root.join("versions").join(version).join("bin");

        Ok(EnvModifications::new().prepend_path(go_path))
    }

    fn version_file_name(&self) -> &str {
        ".go-version"
    }
}

#[async_trait]
impl SystemPackageProvider for GoenvProvider {
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

/// Go package provider using go modules
pub struct GoModProvider;

impl GoModProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_go(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(60));
        let output = process::execute("go", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }
}

impl Default for GoModProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GoModProvider {
    fn id(&self) -> &str {
        "go"
    }

    fn display_name(&self) -> &str {
        "Go Modules"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        75
    }

    async fn is_available(&self) -> bool {
        process::which("go").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // Use pkg.go.dev search API
        let limit = options.limit.unwrap_or(20);
        let _api = get_api_client();

        // Search pkg.go.dev
        let _url = format!(
            "https://pkg.go.dev/search?q={}&m=package&limit={}",
            urlencoding::encode(query),
            limit
        );

        // For now, return basic info - proper API would need HTML parsing or official API
        Ok(vec![PackageSummary {
            name: query.to_string(),
            description: Some("Go package - search on pkg.go.dev".into()),
            latest_version: None,
            provider: self.id().into(),
        }])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Get package info using go list
        let _output = self.run_go(&["list", "-m", "-json", name]).await;

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: Some("Go package".into()),
            homepage: Some(format!("https://pkg.go.dev/{}", name)),
            license: None,
            repository: None,
            versions: vec![],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Use go list -m -versions
        let output = self.run_go(&["list", "-m", "-versions", name]).await?;

        let versions: Vec<VersionInfo> = output
            .split_whitespace()
            .skip(1) // Skip module name
            .map(|v| VersionInfo {
                version: v.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            format!("{}@latest", req.name)
        };

        self.run_go(&["install", &pkg]).await?;

        let gopath = std::env::var("GOPATH")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join("go"))
            })
            .unwrap_or_default();

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_else(|| "latest".into()),
            provider: self.id().into(),
            install_path: gopath.join("bin"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, _req: UninstallRequest) -> CogniaResult<()> {
        // Go doesn't have a built-in uninstall - need to manually remove from GOPATH/bin
        Err(CogniaError::Provider(
            "Go doesn't support uninstall. Remove binary from GOPATH/bin manually.".into(),
        ))
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        // List binaries in GOPATH/bin
        let gopath = std::env::var("GOPATH").ok().map(PathBuf::from).or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join("go"))
        });

        let Some(gopath) = gopath else {
            return Ok(vec![]);
        };

        let bin_dir = gopath.join("bin");
        if !bin_dir.exists() {
            return Ok(vec![]);
        }

        let mut packages = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&bin_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        packages.push(InstalledPackage {
                            name: name.to_string(),
                            version: "unknown".to_string(),
                            provider: self.id().into(),
                            install_path: path,
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
