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
        if process::which("goenv").await.is_none() {
            return false;
        }
        // Verify goenv actually works
        match process::execute("goenv", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
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

        // Rehash shims after installing a new version
        let _ = self.run_goenv(&["rehash"]).await;

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
        // Compare installed goenv versions with latest available
        let installed = self.run_goenv(&["versions", "--bare"]).await.unwrap_or_default();
        let available = self.run_goenv(&["install", "--list"]).await.unwrap_or_default();

        // Collect all stable available versions
        let available_versions: Vec<&str> = available
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty() && !l.contains("beta") && !l.contains("rc"))
            .filter(|l| l.chars().next().map_or(false, |c| c.is_ascii_digit()))
            .collect();

        if available_versions.is_empty() {
            return Ok(vec![]);
        }

        let mut updates = Vec::new();
        for line in installed.lines() {
            let version = line.trim();
            if version.is_empty() {
                continue;
            }

            // Find the latest available version in the same major.minor series
            let parts: Vec<&str> = version.splitn(3, '.').collect();
            let major_minor = if parts.len() >= 2 {
                format!("{}.{}", parts[0], parts[1])
            } else {
                version.to_string()
            };

            // Find latest patch in the same major.minor series
            let latest_in_series = available_versions
                .iter()
                .filter(|v| v.starts_with(&format!("{}.", major_minor)) || **v == major_minor)
                .last()
                .copied();

            // Also check if there's a newer major.minor series
            let latest_overall = available_versions.last().copied().unwrap_or("");

            // Use the latest in the same series first, then overall
            let latest = latest_in_series.unwrap_or(latest_overall);

            if !latest.is_empty() && latest != version {
                updates.push(UpdateInfo {
                    name: format!("go@{}", version),
                    current_version: version.to_string(),
                    latest_version: latest.to_string(),
                    provider: self.id().into(),
                });
            }
        }

        Ok(updates)
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
        let version_root = goenv_root.join("versions").join(version);
        let go_bin = version_root.join("bin");

        let mut mods = EnvModifications::new()
            .prepend_path(go_bin)
            .set_var("GOROOT", version_root.to_string_lossy().to_string());

        // Also add GOPATH/bin to PATH if GOPATH is set
        if let Ok(gopath) = std::env::var("GOPATH") {
            mods = mods.prepend_path(PathBuf::from(&gopath).join("bin"));
        } else if let Ok(home) = std::env::var("HOME") {
            mods = mods.prepend_path(PathBuf::from(&home).join("go").join("bin"));
        }

        Ok(mods)
    }

    fn version_file_name(&self) -> &str {
        ".go-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
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

    /// Get GOPATH, with proper Windows fallback
    fn get_gopath() -> Option<PathBuf> {
        std::env::var("GOPATH").ok().map(PathBuf::from).or_else(|| {
            // On Windows, HOME might not be set; use USERPROFILE
            std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .ok()
                .map(|h| PathBuf::from(h).join("go"))
        })
    }

    /// Get GOBIN path (where `go install` puts binaries)
    fn get_gobin() -> Option<PathBuf> {
        // GOBIN takes precedence, then GOPATH/bin
        std::env::var("GOBIN")
            .ok()
            .map(PathBuf::from)
            .or_else(|| Self::get_gopath().map(|p| p.join("bin")))
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
        if process::which("go").await.is_none() {
            return false;
        }
        match process::execute("go", &["version"], None).await {
            Ok(output) => output.success && !output.stdout.is_empty(),
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);

        // Try using `go list -m` to resolve exact module paths
        // This works for exact or partial module paths (e.g., "github.com/gin-gonic/gin")
        let query_at = format!("{}@latest", query);
        if let Ok(output) = self.run_go(&["list", "-m", "-json", &query_at]).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let path = json["Path"].as_str().unwrap_or(query);
                let version = json["Version"].as_str().map(|s| s.to_string());
                return Ok(vec![PackageSummary {
                    name: path.to_string(),
                    description: Some(format!("Go module: {}", path)),
                    latest_version: version,
                    provider: self.id().into(),
                }]);
            }
        }

        // Fallback: use Go module proxy API to search for packages
        // The proxy.golang.org doesn't have a search API, but we can try
        // the pkg.go.dev search API endpoint
        let api = get_api_client();
        let url = format!(
            "https://api.pkg.go.dev/search?q={}&limit={}",
            urlencoding::encode(query),
            limit
        );

        if let Ok(resp) = api.raw_get(&url).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&resp) {
                if let Some(results) = json["results"].as_array() {
                    let packages: Vec<PackageSummary> = results
                        .iter()
                        .take(limit)
                        .filter_map(|r| {
                            let name = r["packagePath"].as_str()
                                .or_else(|| r["modulePath"].as_str())?;
                            Some(PackageSummary {
                                name: name.to_string(),
                                description: r["synopsis"].as_str().map(|s| s.to_string()),
                                latest_version: r["version"].as_str().map(|s| s.to_string()),
                                provider: self.id().into(),
                            })
                        })
                        .collect();

                    if !packages.is_empty() {
                        return Ok(packages);
                    }
                }
            }
        }

        // Last fallback: return the query as a potential module path
        Ok(vec![PackageSummary {
            name: query.to_string(),
            description: Some("Go module - try installing with go install".into()),
            latest_version: None,
            provider: self.id().into(),
        }])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Get package info using go list -m -json
        let query = format!("{}@latest", name);
        if let Ok(output) = self.run_go(&["list", "-m", "-json", &query]).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let version = json["Version"].as_str().map(|s| s.to_string());
                let path = json["Path"].as_str().unwrap_or(name);

                // Determine repository URL from module path
                let repo_url = if path.starts_with("github.com/") {
                    Some(format!("https://{}", path))
                } else if path.starts_with("gitlab.com/") || path.starts_with("bitbucket.org/") {
                    Some(format!("https://{}", path))
                } else {
                    None
                };

                let versions = self.get_versions(name).await.unwrap_or_default();

                return Ok(PackageInfo {
                    name: name.into(),
                    display_name: Some(path.to_string()),
                    description: Some(format!("Go module: {}", path)),
                    homepage: Some(format!("https://pkg.go.dev/{}", name)),
                    license: None,
                    repository: repo_url,
                    versions: if versions.is_empty() {
                        version
                            .map(|v| {
                                vec![VersionInfo {
                                    version: v,
                                    release_date: None,
                                    deprecated: json["Deprecated"].as_str().is_some(),
                                    yanked: json["Retracted"].as_array().map_or(false, |a| !a.is_empty()),
                                }]
                            })
                            .unwrap_or_default()
                    } else {
                        versions
                    },
                    provider: self.id().into(),
                });
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: Some("Go module".into()),
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

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<crate::resolver::Dependency>> {
        // Use go list -m -json to get module dependencies
        let query = if version.is_empty() {
            format!("{}@latest", name)
        } else {
            format!("{}@{}", name, version)
        };

        // Try go list -m -json all in a temp module context
        // For now, query the Go module proxy for dependencies
        let proxy_url = format!(
            "https://proxy.golang.org/{}/@v/{}.mod",
            name,
            if version.is_empty() { "latest" } else { version }
        );

        let api = get_api_client();
        if let Ok(mod_content) = api.raw_get(&proxy_url).await {
            let deps: Vec<crate::resolver::Dependency> = mod_content
                .lines()
                .filter(|line| line.starts_with("\t") || line.starts_with("    "))
                .filter_map(|line| {
                    let line = line.trim();
                    // Format: module/path v1.2.3
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 && !parts[0].starts_with("//") {
                        let dep_name = parts[0].to_string();
                        let constraint = parts[1]
                            .parse::<crate::resolver::VersionConstraint>()
                            .unwrap_or(crate::resolver::VersionConstraint::Any);
                        Some(crate::resolver::Dependency {
                            name: dep_name,
                            constraint,
                        })
                    } else {
                        None
                    }
                })
                .collect();

            return Ok(deps);
        }

        // Fallback: use go list -m -json
        if let Ok(output) = self.run_go(&["list", "-m", "-json", &query]).await {
            // go list -m -json doesn't directly list deps, return empty
            let _ = output;
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            format!("{}@latest", req.name)
        };

        self.run_go(&["install", &pkg]).await?;

        let install_path = Self::get_gobin().unwrap_or_default();

        // Resolve actual version: query `go list -m -json <module>@latest`
        let actual_version = if req.version.is_none() || req.version.as_deref() == Some("latest") {
            let list_pkg = format!("{}@latest", req.name);
            if let Ok(out) = self.run_go(&["list", "-m", "-json", &list_pkg]).await {
                serde_json::from_str::<serde_json::Value>(&out)
                    .ok()
                    .and_then(|j| j["Version"].as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()))
            } else {
                req.version.clone().unwrap_or_else(|| "unknown".into())
            }
        } else {
            req.version.clone().unwrap_or_else(|| "unknown".into())
        };

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        // Go doesn't have a built-in uninstall command, but we can remove
        // the binary from GOBIN/GOPATH/bin
        let bin_dir = Self::get_gobin()
            .ok_or_else(|| CogniaError::Provider("Cannot determine GOBIN/GOPATH".into()))?;

        // The binary name is the last segment of the module path
        let binary_name = req.name.rsplit('/').next().unwrap_or(&req.name);

        let mut binary_path = bin_dir.join(binary_name);

        // On Windows, add .exe extension
        if cfg!(windows) && !binary_name.ends_with(".exe") {
            binary_path = bin_dir.join(format!("{}.exe", binary_name));
        }

        if binary_path.exists() {
            std::fs::remove_file(&binary_path).map_err(|e| {
                CogniaError::Provider(format!(
                    "Failed to remove {}: {}",
                    binary_path.display(),
                    e
                ))
            })?;
            Ok(())
        } else {
            Err(CogniaError::Provider(format!(
                "Binary '{}' not found in {}",
                binary_name,
                bin_dir.display()
            )))
        }
    }

    async fn list_installed(
        &self,
        filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        // List binaries in GOBIN or GOPATH/bin
        let bin_dir = match Self::get_gobin() {
            Some(dir) => dir,
            None => return Ok(vec![]),
        };

        if !bin_dir.exists() {
            return Ok(vec![]);
        }

        let mut packages = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&bin_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        // Skip non-executable files on Windows (must end with .exe)
                        #[cfg(windows)]
                        if !name.ends_with(".exe") {
                            continue;
                        }

                        // Clean up name (remove .exe on Windows for display)
                        let display_name = name.strip_suffix(".exe").unwrap_or(name);

                        if let Some(ref name_filter) = filter.name_filter {
                            if !display_name.contains(name_filter) {
                                continue;
                            }
                        }

                        // Try to get modification time as installed_at
                        let installed_at = entry
                            .metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .map(|t| {
                                chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
                            })
                            .unwrap_or_default();

                        packages.push(InstalledPackage {
                            name: display_name.to_string(),
                            version: "installed".to_string(),
                            provider: self.id().into(),
                            install_path: path,
                            installed_at,
                            is_global: true,
                        });
                    }
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // For go modules, we can check if installed binaries have newer versions
        // by querying the module proxy
        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in &installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            // We can't easily determine the module path from just a binary name,
            // so this is best-effort. Users who installed via `go install module@version`
            // would need to re-check manually.
        }

        Ok(updates)
    }
}
