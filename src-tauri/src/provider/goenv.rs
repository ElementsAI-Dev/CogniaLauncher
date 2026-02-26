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
        let installed = self
            .run_goenv(&["versions", "--bare"])
            .await
            .unwrap_or_default();
        let available = self
            .run_goenv(&["install", "--list"])
            .await
            .unwrap_or_default();

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

        // 3. Check go.mod for toolchain directive (Go 1.21+) and go directive
        let go_mod = start_path.join("go.mod");
        if go_mod.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&go_mod).await {
                let mut go_version: Option<String> = None;
                let mut toolchain_version: Option<String> = None;

                for line in content.lines() {
                    let line = line.trim();
                    // Parse "toolchain goX.Y.Z" (Go 1.21+) — the actual build toolchain
                    if let Some(stripped) = line.strip_prefix("toolchain go") {
                        let version = stripped.trim().to_string();
                        if !version.is_empty() {
                            toolchain_version = Some(version);
                        }
                    }
                    // Parse "go X.Y.Z" — minimum required version
                    else if let Some(stripped) = line.strip_prefix("go ") {
                        let version = stripped.trim().to_string();
                        if !version.is_empty() {
                            go_version = Some(version);
                        }
                    }
                }

                // Prefer toolchain directive (more precise) over go directive
                if let Some(version) = toolchain_version.or(go_version) {
                    return Ok(Some(VersionDetection {
                        version,
                        source: VersionSource::Manifest,
                        source_path: Some(go_mod),
                    }));
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

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_goenv(&["--version"]).await?;
        // Output format: "goenv 2.1.11" or similar
        let version = output
            .trim()
            .strip_prefix("goenv ")
            .unwrap_or(output.trim());
        Ok(version.to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("goenv")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("goenv not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("git clone https://github.com/go-nv/goenv.git ~/.goenv && echo 'export GOENV_ROOT=\"$HOME/.goenv\"' >> ~/.bashrc && echo 'export PATH=\"$GOENV_ROOT/bin:$PATH\"' >> ~/.bashrc".to_string())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.list_installed_versions().await?;
        Ok(versions.iter().any(|v| v.version == name))
    }
}

/// Go package provider using go modules
pub struct GoModProvider {
    /// Custom GOPROXY URL (mirrors like goproxy.cn, goproxy.io)
    proxy_url: Option<String>,
}

impl GoModProvider {
    pub fn new() -> Self {
        Self { proxy_url: None }
    }

    /// Configure a custom Go module proxy URL (e.g. from mirror settings)
    pub fn with_proxy_opt(mut self, url: Option<String>) -> Self {
        self.proxy_url = url;
        self
    }

    /// Get the configured proxy URL or the default Go proxy
    fn proxy_base_url(&self) -> &str {
        self.proxy_url
            .as_deref()
            .unwrap_or("https://proxy.golang.org")
    }

    async fn run_go(&self, args: &[&str]) -> CogniaResult<String> {
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(60));
        // Pass GOPROXY env var when a custom proxy is configured
        if let Some(ref proxy) = self.proxy_url {
            opts.env
                .insert("GOPROXY".into(), format!("{},direct", proxy));
        }
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

/// Go environment info from `go env -json`
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoEnvInfo {
    pub goroot: String,
    pub gopath: String,
    pub gobin: String,
    pub goproxy: String,
    pub goprivate: String,
    pub gonosumdb: String,
    pub gotoolchain: String,
    pub gomodcache: String,
    pub goos: String,
    pub goarch: String,
    pub goversion: String,
    pub goflags: String,
    pub cgo_enabled: String,
}

/// Go cache size info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoCacheInfo {
    pub build_cache_path: String,
    pub build_cache_size: u64,
    pub build_cache_size_human: String,
    pub mod_cache_path: String,
    pub mod_cache_size: u64,
    pub mod_cache_size_human: String,
}

/// Calculate directory size in bytes (best-effort, non-recursive symlink following)
pub fn go_dir_size(path: &str) -> u64 {
    let path = std::path::Path::new(path);
    if !path.exists() {
        return 0;
    }
    go_walkdir_size(path)
}

fn go_walkdir_size(path: &std::path::Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_file() {
                total += meta.len();
            } else if meta.is_dir() {
                total += go_walkdir_size(&entry.path());
            }
        }
    }
    total
}

pub fn go_format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
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
                            let name = r["packagePath"]
                                .as_str()
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
                                    yanked: json["Retracted"]
                                        .as_array()
                                        .map_or(false, |a| !a.is_empty()),
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

    async fn get_dependencies(
        &self,
        name: &str,
        version: &str,
    ) -> CogniaResult<Vec<crate::resolver::Dependency>> {
        // Use go list -m -json to get module dependencies
        let query = if version.is_empty() {
            format!("{}@latest", name)
        } else {
            format!("{}@{}", name, version)
        };

        // Try go list -m -json all in a temp module context
        // For now, query the Go module proxy for dependencies
        let proxy_url = format!(
            "{}/@v/{}.mod",
            // Remove trailing slash from proxy base URL if present
            self.proxy_base_url().trim_end_matches('/').to_string() + "/" + name,
            if version.is_empty() {
                "latest"
            } else {
                version
            }
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
                CogniaError::Provider(format!("Failed to remove {}: {}", binary_path.display(), e))
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

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
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
                            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
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
        let updates = Vec::new();

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

#[async_trait]
impl SystemPackageProvider for GoModProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_go(&["version"]).await?;
        // Output: "go version go1.22.5 linux/amd64"
        let re = regex::Regex::new(r"go(\d+\.\d+(?:\.\d+)?)")
            .map_err(|e| CogniaError::Provider(e.to_string()))?;
        if let Some(caps) = re.captures(&output) {
            if let Some(version) = caps.get(1) {
                return Ok(version.as_str().to_string());
            }
        }
        Err(CogniaError::Provider("Failed to parse Go version".into()))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("go")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("go not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        if cfg!(windows) {
            Some("winget install GoLang.Go".to_string())
        } else if cfg!(target_os = "macos") {
            Some("brew install go".to_string())
        } else {
            Some("Download from https://go.dev/dl/ or use your system package manager".to_string())
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let bin_dir = match Self::get_gobin() {
            Some(dir) => dir,
            None => return Ok(false),
        };

        let binary_name = name.rsplit('/').next().unwrap_or(name);
        let mut binary_path = bin_dir.join(binary_name);

        if cfg!(windows) && !binary_name.ends_with(".exe") {
            binary_path = bin_dir.join(format!("{}.exe", binary_name));
        }

        Ok(binary_path.exists())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── GoenvProvider trait tests ──────────────────────────

    #[test]
    fn test_goenv_provider_id_and_display_name() {
        let provider = GoenvProvider::new();
        assert_eq!(provider.id(), "goenv");
        assert_eq!(provider.display_name(), "goenv (Go Version Manager)");
    }

    #[test]
    fn test_goenv_provider_capabilities() {
        let provider = GoenvProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
        assert_eq!(caps.len(), 7);
    }

    #[test]
    fn test_goenv_provider_supported_platforms() {
        let provider = GoenvProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert!(!platforms.contains(&Platform::Windows));
    }

    #[test]
    fn test_goenv_provider_priority() {
        let provider = GoenvProvider::new();
        assert_eq!(provider.priority(), 80);
    }

    #[test]
    fn test_goenv_provider_version_file_name() {
        let provider = GoenvProvider::new();
        assert_eq!(provider.version_file_name(), ".go-version");
    }

    #[test]
    fn test_goenv_provider_requires_elevation() {
        let provider = GoenvProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }

    #[test]
    fn test_goenv_provider_install_instructions() {
        let provider = GoenvProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some());
        let text = instructions.unwrap();
        assert!(text.contains("goenv"));
        assert!(text.contains("git clone"));
    }

    #[test]
    fn test_goenv_provider_default() {
        let provider = GoenvProvider::default();
        assert_eq!(provider.id(), "goenv");
    }

    // ── GoModProvider trait tests ──────────────────────────

    #[test]
    fn test_go_mod_provider_id_and_display_name() {
        let provider = GoModProvider::new();
        assert_eq!(provider.id(), "go");
        assert_eq!(provider.display_name(), "Go Modules");
    }

    #[test]
    fn test_go_mod_provider_capabilities() {
        let provider = GoModProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert_eq!(caps.len(), 4);
        // Should NOT have version management capabilities
        assert!(!caps.contains(&Capability::VersionSwitch));
        assert!(!caps.contains(&Capability::MultiVersion));
    }

    #[test]
    fn test_go_mod_provider_supported_platforms() {
        let provider = GoModProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 3);
    }

    #[test]
    fn test_go_mod_provider_priority() {
        let provider = GoModProvider::new();
        assert_eq!(provider.priority(), 75);
    }

    #[test]
    fn test_go_mod_provider_requires_elevation() {
        let provider = GoModProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }

    #[test]
    fn test_go_mod_provider_install_instructions() {
        let provider = GoModProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some());
        let text = instructions.unwrap();
        // On Windows CI: "winget install GoLang.Go"
        // On other platforms: different instructions
        assert!(!text.is_empty());
    }

    #[test]
    fn test_go_mod_provider_default() {
        let provider = GoModProvider::default();
        assert_eq!(provider.id(), "go");
        assert!(provider.proxy_url.is_none());
    }

    // ── GOPROXY mirror configuration tests ────────────────

    #[test]
    fn test_go_mod_provider_with_proxy() {
        let provider = GoModProvider::new();
        assert!(provider.proxy_url.is_none());
        assert_eq!(provider.proxy_base_url(), "https://proxy.golang.org");

        let provider = GoModProvider::new().with_proxy_opt(Some("https://goproxy.cn".into()));
        assert_eq!(provider.proxy_url.as_deref(), Some("https://goproxy.cn"));
        assert_eq!(provider.proxy_base_url(), "https://goproxy.cn");

        let provider = GoModProvider::new().with_proxy_opt(None);
        assert!(provider.proxy_url.is_none());
        assert_eq!(provider.proxy_base_url(), "https://proxy.golang.org");
    }

    #[test]
    fn test_go_mod_provider_proxy_with_trailing_slash() {
        let provider = GoModProvider::new().with_proxy_opt(Some("https://goproxy.io/".into()));
        assert_eq!(provider.proxy_base_url(), "https://goproxy.io/");
    }

    #[test]
    fn test_go_mod_provider_proxy_chain() {
        // Builder pattern should work with chaining
        let provider = GoModProvider::new()
            .with_proxy_opt(Some("https://first.proxy".into()))
            .with_proxy_opt(Some("https://second.proxy".into()));
        assert_eq!(provider.proxy_base_url(), "https://second.proxy");
    }

    // ── Toolchain directive parsing tests ──────────────────

    /// Helper that simulates the go.mod parsing logic from detect_version
    fn parse_go_mod_versions(content: &str) -> (Option<String>, Option<String>) {
        let mut go_version: Option<String> = None;
        let mut toolchain_version: Option<String> = None;
        for line in content.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("toolchain go") {
                let version = stripped.trim().to_string();
                if !version.is_empty() {
                    toolchain_version = Some(version);
                }
            } else if let Some(stripped) = line.strip_prefix("go ") {
                let version = stripped.trim().to_string();
                if !version.is_empty() {
                    go_version = Some(version);
                }
            }
        }
        (go_version, toolchain_version)
    }

    #[test]
    fn test_parse_toolchain_directive() {
        let content = "module example.com/mymodule\n\ngo 1.22.0\ntoolchain go1.22.5\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);

        assert_eq!(go_ver.as_deref(), Some("1.22.0"));
        assert_eq!(tc_ver.as_deref(), Some("1.22.5"));
        // toolchain should be preferred over go directive
        let detected = tc_ver.or(go_ver);
        assert_eq!(detected.as_deref(), Some("1.22.5"));
    }

    #[test]
    fn test_parse_go_mod_without_toolchain() {
        let content = "module example.com/mymodule\n\ngo 1.21.0\n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);

        assert_eq!(go_ver.as_deref(), Some("1.21.0"));
        assert!(tc_ver.is_none());
        let detected = tc_ver.or(go_ver);
        assert_eq!(detected.as_deref(), Some("1.21.0"));
    }

    #[test]
    fn test_parse_go_mod_only_toolchain() {
        let content = "module example.com/m\ntoolchain go1.23.0\n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);

        assert!(go_ver.is_none());
        assert_eq!(tc_ver.as_deref(), Some("1.23.0"));
    }

    #[test]
    fn test_parse_go_mod_empty() {
        let content = "";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);
        assert!(go_ver.is_none());
        assert!(tc_ver.is_none());
    }

    #[test]
    fn test_parse_go_mod_no_version_lines() {
        let content =
            "module example.com/mymodule\n\nrequire (\n\tgithub.com/pkg/errors v0.9.1\n)\n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);
        assert!(go_ver.is_none());
        assert!(tc_ver.is_none());
    }

    #[test]
    fn test_parse_go_mod_with_whitespace() {
        let content = "module example.com/m\n\n  go 1.21.3  \n  toolchain go1.21.6  \n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);
        assert_eq!(go_ver.as_deref(), Some("1.21.3"));
        assert_eq!(tc_ver.as_deref(), Some("1.21.6"));
    }

    #[test]
    fn test_parse_go_mod_toolchain_without_go_prefix_ignored() {
        // "toolchain 1.22.0" (no "go" prefix) should NOT be parsed
        let content = "module example.com/m\ngo 1.21.0\ntoolchain 1.22.0\n";
        let (go_ver, tc_ver) = parse_go_mod_versions(content);
        assert_eq!(go_ver.as_deref(), Some("1.21.0"));
        // "toolchain 1.22.0" doesn't match "toolchain go" prefix
        assert!(tc_ver.is_none());
    }

    // ── GoEnvInfo serde tests ─────────────────────────────

    #[test]
    fn test_go_env_info_json_parsing() {
        let sample_json = r#"{
            "GOROOT": "/usr/local/go",
            "GOPATH": "/home/user/go",
            "GOBIN": "",
            "GOPROXY": "https://proxy.golang.org,direct",
            "GOPRIVATE": "",
            "GONOSUMDB": "",
            "GOTOOLCHAIN": "auto",
            "GOMODCACHE": "/home/user/go/pkg/mod",
            "GOOS": "linux",
            "GOARCH": "amd64",
            "GOVERSION": "go1.22.5",
            "GOFLAGS": "",
            "CGO_ENABLED": "1"
        }"#;

        let json: serde_json::Value = serde_json::from_str(sample_json).unwrap();
        let info = GoEnvInfo {
            goroot: json["GOROOT"].as_str().unwrap_or("").to_string(),
            gopath: json["GOPATH"].as_str().unwrap_or("").to_string(),
            gobin: json["GOBIN"].as_str().unwrap_or("").to_string(),
            goproxy: json["GOPROXY"].as_str().unwrap_or("").to_string(),
            goprivate: json["GOPRIVATE"].as_str().unwrap_or("").to_string(),
            gonosumdb: json["GONOSUMDB"].as_str().unwrap_or("").to_string(),
            gotoolchain: json["GOTOOLCHAIN"].as_str().unwrap_or("").to_string(),
            gomodcache: json["GOMODCACHE"].as_str().unwrap_or("").to_string(),
            goos: json["GOOS"].as_str().unwrap_or("").to_string(),
            goarch: json["GOARCH"].as_str().unwrap_or("").to_string(),
            goversion: json["GOVERSION"].as_str().unwrap_or("").to_string(),
            goflags: json["GOFLAGS"].as_str().unwrap_or("").to_string(),
            cgo_enabled: json["CGO_ENABLED"].as_str().unwrap_or("").to_string(),
        };

        assert_eq!(info.goroot, "/usr/local/go");
        assert_eq!(info.gopath, "/home/user/go");
        assert_eq!(info.gobin, "");
        assert_eq!(info.goproxy, "https://proxy.golang.org,direct");
        assert_eq!(info.gotoolchain, "auto");
        assert_eq!(info.gomodcache, "/home/user/go/pkg/mod");
        assert_eq!(info.goos, "linux");
        assert_eq!(info.goarch, "amd64");
        assert_eq!(info.goversion, "go1.22.5");
        assert_eq!(info.cgo_enabled, "1");
    }

    #[test]
    fn test_go_env_info_serde_camel_case() {
        let info = GoEnvInfo {
            goroot: "/usr/local/go".into(),
            gopath: "/home/user/go".into(),
            gobin: "".into(),
            goproxy: "https://proxy.golang.org".into(),
            goprivate: "".into(),
            gonosumdb: "".into(),
            gotoolchain: "auto".into(),
            gomodcache: "/home/user/go/pkg/mod".into(),
            goos: "linux".into(),
            goarch: "amd64".into(),
            goversion: "go1.22.5".into(),
            goflags: "".into(),
            cgo_enabled: "1".into(),
        };

        let serialized = serde_json::to_string(&info).unwrap();
        // cgo_enabled should serialize as cgoEnabled (camelCase)
        assert!(serialized.contains("\"cgoEnabled\""));
        assert!(!serialized.contains("\"cgo_enabled\""));
        // Other fields are already lowercase single-word, no rename needed
        assert!(serialized.contains("\"goroot\""));
        assert!(serialized.contains("\"gopath\""));
        assert!(serialized.contains("\"goproxy\""));
        assert!(serialized.contains("\"gomodcache\""));

        // Roundtrip: deserialize the camelCase JSON back
        let deserialized: GoEnvInfo = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.cgo_enabled, "1");
        assert_eq!(deserialized.goroot, "/usr/local/go");
    }

    // ── GoCacheInfo serde tests ───────────────────────────

    #[test]
    fn test_go_cache_info_serde_camel_case() {
        let info = GoCacheInfo {
            build_cache_path: "/home/user/.cache/go-build".into(),
            build_cache_size: 104857600,
            build_cache_size_human: "100.0 MB".into(),
            mod_cache_path: "/home/user/go/pkg/mod".into(),
            mod_cache_size: 52428800,
            mod_cache_size_human: "50.0 MB".into(),
        };

        let serialized = serde_json::to_string(&info).unwrap();
        // Snake_case fields should serialize as camelCase
        assert!(serialized.contains("\"buildCachePath\""));
        assert!(serialized.contains("\"buildCacheSize\""));
        assert!(serialized.contains("\"buildCacheSizeHuman\""));
        assert!(serialized.contains("\"modCachePath\""));
        assert!(serialized.contains("\"modCacheSize\""));
        assert!(serialized.contains("\"modCacheSizeHuman\""));
        // Should NOT contain snake_case
        assert!(!serialized.contains("\"build_cache_path\""));
        assert!(!serialized.contains("\"mod_cache_size\""));

        // Roundtrip
        let deserialized: GoCacheInfo = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.build_cache_path, "/home/user/.cache/go-build");
        assert_eq!(deserialized.build_cache_size, 104857600);
        assert_eq!(deserialized.mod_cache_path, "/home/user/go/pkg/mod");
    }

    #[test]
    fn test_go_cache_info_zero_values() {
        let info = GoCacheInfo {
            build_cache_path: "".into(),
            build_cache_size: 0,
            build_cache_size_human: "0 B".into(),
            mod_cache_path: "".into(),
            mod_cache_size: 0,
            mod_cache_size_human: "0 B".into(),
        };
        let serialized = serde_json::to_string(&info).unwrap();
        let deserialized: GoCacheInfo = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.build_cache_size, 0);
        assert_eq!(deserialized.mod_cache_size, 0);
    }

    // ── Helper function tests ─────────────────────────────

    #[test]
    fn test_format_bytes() {
        assert_eq!(go_format_bytes(0), "0 B");
        assert_eq!(go_format_bytes(512), "512 B");
        assert_eq!(go_format_bytes(1023), "1023 B");
        assert_eq!(go_format_bytes(1024), "1.0 KB");
        assert_eq!(go_format_bytes(1536), "1.5 KB");
        assert_eq!(go_format_bytes(1048576), "1.0 MB");
        assert_eq!(go_format_bytes(1073741824), "1.0 GB");
        assert_eq!(go_format_bytes(2147483648), "2.0 GB");
    }

    #[test]
    fn test_go_dir_size_nonexistent() {
        let size = go_dir_size("/nonexistent/path/that/should/not/exist/12345");
        assert_eq!(size, 0);
    }

    #[test]
    fn test_go_dir_size_with_temp_dir() {
        let tmp = std::env::temp_dir().join("cognia_test_go_dir_size");
        let _ = std::fs::create_dir_all(&tmp);

        // Write a small file
        let test_file = tmp.join("test.txt");
        std::fs::write(&test_file, "hello world").unwrap();

        let size = go_dir_size(tmp.to_str().unwrap());
        assert!(size > 0, "dir size should be > 0 for non-empty dir");

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
