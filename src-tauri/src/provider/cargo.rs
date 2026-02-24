use super::api::get_api_client;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;

/// Cargo - Rust Package Manager
///
/// Supports custom crates.io registry configuration via environment variables.
/// Note: Cargo registry mirrors are typically configured via `.cargo/config.toml`,
/// but we support setting environment variables for runtime configuration.
pub struct CargoProvider {
    /// Custom registry URL (used for CARGO_REGISTRIES_CRATES_IO_PROTOCOL)
    registry_url: Option<String>,
    /// Additional environment variables for cargo commands
    env_vars: HashMap<String, String>,
}

impl CargoProvider {
    pub fn new() -> Self {
        Self {
            registry_url: None,
            env_vars: HashMap::new(),
        }
    }

    /// Set the registry URL
    pub fn with_registry(mut self, url: impl Into<String>) -> Self {
        self.registry_url = Some(url.into());
        self
    }

    /// Set the registry URL from an Option
    pub fn with_registry_opt(mut self, url: Option<String>) -> Self {
        self.registry_url = url;
        self
    }

    /// Add a custom environment variable for cargo commands
    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env_vars.insert(key.into(), value.into());
        self
    }

    async fn run_cargo(&self, args: &[&str]) -> CogniaResult<String> {
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));

        // Pass custom environment variables if configured
        for (key, value) in &self.env_vars {
            opts = opts.with_env(key, value);
        }

        // Set sparse registry protocol if registry_url is configured
        if let Some(ref url) = self.registry_url {
            opts = opts.with_env("CARGO_REGISTRIES_CRATES_IO_PROTOCOL", "sparse");
            opts = opts.with_env("CARGO_REGISTRIES_CRATES_IO_INDEX", url);
        }

        let out = process::execute("cargo", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    fn get_cargo_home() -> Option<PathBuf> {
        std::env::var("CARGO_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".cargo"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join(".cargo"))
                }
            })
    }

    /// Get the configured registry URL if set
    pub fn get_registry_url(&self) -> Option<&String> {
        self.registry_url.as_ref()
    }

    /// Get the installed version of a crate from cargo install --list
    async fn get_installed_crate_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_cargo(&["install", "--list"]).await?;
        
        for line in out.lines() {
            if !line.starts_with(' ') && !line.is_empty() {
                // Format: "crate_name v0.1.0:"
                let parts: Vec<&str> = line.trim_end_matches(':').split_whitespace().collect();
                if parts.len() >= 2 && parts[0] == name {
                    return Ok(parts[1].trim_start_matches('v').to_string());
                }
            }
        }
        
        Err(CogniaError::Provider(format!("Crate {} not found in installed list", name)))
    }
}

impl Default for CargoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for CargoProvider {
    fn id(&self) -> &str {
        "cargo"
    }
    fn display_name(&self) -> &str {
        "Cargo (Rust Package Manager)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        // Check if cargo exists and is actually executable
        if process::which("cargo").await.is_none() {
            return false;
        }
        // Verify cargo works by running --version
        match process::execute("cargo", &["--version"], None).await {
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
        let api = get_api_client();

        // Use crates.io API for faster and more reliable search
        if let Ok(packages) = api.search_crates(query, limit).await {
            return Ok(packages
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.description,
                    latest_version: Some(p.max_version),
                    provider: self.id().into(),
                })
                .collect());
        }

        // Fallback to cargo CLI with timeout
        let limit_str = limit.to_string();
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(30));
        let out = process::execute(
            "cargo",
            &["search", query, "--limit", &limit_str],
            Some(opts),
        )
        .await;

        if let Ok(result) = out {
            if result.success {
                // Parse cargo search output: name = "version"    # description
                let packages: Vec<PackageSummary> = result
                    .stdout
                    .lines()
                    .filter(|l| !l.is_empty() && l.contains('='))
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.splitn(2, '=').collect();
                        if parts.len() >= 2 {
                            let name = parts[0].trim().to_string();
                            let rest = parts[1].trim();
                            let version = rest
                                .split('#')
                                .next()
                                .map(|v| v.trim().trim_matches('"').to_string());
                            let description = rest.split('#').nth(1).map(|d| d.trim().to_string());

                            Some(PackageSummary {
                                name,
                                description,
                                latest_version: version,
                                provider: self.id().into(),
                            })
                        } else {
                            None
                        }
                    })
                    .collect();

                return Ok(packages);
            }
        }

        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();

        // Use crates.io API first
        if let Ok(crate_info) = api.get_crate(name).await {
            let versions: Vec<VersionInfo> = crate_info
                .versions
                .into_iter()
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            return Ok(PackageInfo {
                name: crate_info.name.clone(),
                display_name: Some(crate_info.name),
                description: crate_info.description,
                homepage: crate_info
                    .homepage
                    .or_else(|| Some(format!("https://crates.io/crates/{}", name))),
                license: None,
                repository: crate_info.repository,
                versions: if versions.is_empty() {
                    vec![VersionInfo {
                        version: crate_info.max_version,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                } else {
                    versions
                },
                provider: self.id().into(),
            });
        }

        // Fallback to cargo CLI
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
        let out = process::execute("cargo", &["search", name, "--limit", "1"], Some(opts)).await;

        let mut description = None;
        let mut version = None;

        if let Ok(result) = out {
            if result.success {
                for line in result.stdout.lines() {
                    if line.starts_with(name) || line.contains(&format!("{} =", name)) {
                        let parts: Vec<&str> = line.splitn(2, '=').collect();
                        if parts.len() >= 2 {
                            let rest = parts[1].trim();
                            version = rest
                                .split('#')
                                .next()
                                .map(|v| v.trim().trim_matches('"').to_string());
                            description = rest.split('#').nth(1).map(|d| d.trim().to_string());
                        }
                        break;
                    }
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!("https://crates.io/crates/{}", name)),
            license: None,
            repository: None,
            versions: version
                .map(|v| {
                    vec![VersionInfo {
                        version: v,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                })
                .unwrap_or_default(),
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Use crates.io API for comprehensive version listing
        let api = get_api_client();
        if let Ok(crate_info) = api.get_crate(name).await {
            let versions: Vec<VersionInfo> = crate_info
                .versions
                .into_iter()
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            if !versions.is_empty() {
                return Ok(versions);
            }
        }

        // Fallback to cargo search for latest version only
        let out = self.run_cargo(&["search", name, "--limit", "1"]).await?;

        for line in out.lines() {
            if line.starts_with(name) || line.contains(&format!("{} =", name)) {
                let parts: Vec<&str> = line.splitn(2, '=').collect();
                if parts.len() >= 2 {
                    let version = parts[1]
                        .trim()
                        .split('#')
                        .next()
                        .map(|v| v.trim().trim_matches('"').to_string());

                    if let Some(v) = version {
                        return Ok(vec![VersionInfo {
                            version: v,
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        }]);
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        // O(1) lookup using get_installed_crate_version instead of default O(n)
        match self.get_installed_crate_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use crates.io API to get dependencies
        let api = get_api_client();
        if let Ok(crate_info) = api.get_crate(name).await {
            let target_version = if version.is_empty() {
                crate_info.max_version.clone()
            } else {
                version.to_string()
            };

            // Use crates.io dependencies API: /api/v1/crates/{name}/{version}/dependencies
            let url = format!(
                "https://crates.io/api/v1/crates/{}/{}/dependencies",
                name, target_version
            );

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .map_err(|e| CogniaError::Provider(e.to_string()))?;

            if let Ok(resp) = client
                .get(&url)
                .header("User-Agent", "CogniaLauncher/1.0")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(deps) = json["dependencies"].as_array() {
                            return Ok(deps
                                .iter()
                                .filter(|d| {
                                    d["kind"].as_str().unwrap_or("normal") == "normal"
                                        && !d["optional"].as_bool().unwrap_or(false)
                                })
                                .filter_map(|d| {
                                    let dep_name = d["crate_id"].as_str()?.to_string();
                                    let req_str = d["req"].as_str().unwrap_or("*");
                                    let constraint = req_str
                                        .parse::<VersionConstraint>()
                                        .unwrap_or(VersionConstraint::Any);
                                    Some(Dependency {
                                        name: dep_name,
                                        constraint,
                                    })
                                })
                                .collect());
                        }
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name];
        let ver;
        if let Some(v) = &req.version {
            ver = format!("--version={}", v);
            args.push(&ver);
        }
        if req.force {
            args.push("--force");
        }

        self.run_cargo(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .get_installed_crate_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_cargo_home()
            .map(|p| p.join("bin"))
            .unwrap_or_default();

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
        self.run_cargo(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_cargo(&["install", "--list"]).await?;
        let cargo_bin = Self::get_cargo_home()
            .map(|p| p.join("bin"))
            .unwrap_or_default();

        let mut packages = Vec::new();
        let mut current_name: Option<String> = None;
        let mut current_version: Option<String> = None;

        for line in out.lines() {
            if !line.starts_with(' ') && !line.is_empty() {
                // New package line: name v0.1.0:
                if let Some(name) = current_name.take() {
                    if let Some(version) = current_version.take() {
                        if filter
                            .name_filter
                            .as_ref()
                            .map_or(true, |f| name.contains(f))
                        {
                            packages.push(InstalledPackage {
                                name,
                                version,
                                provider: self.id().into(),
                                install_path: cargo_bin.clone(),
                                installed_at: String::new(),
                                is_global: true,
                            });
                        }
                    }
                }

                // Parse new package
                let parts: Vec<&str> = line.trim_end_matches(':').split_whitespace().collect();
                if parts.len() >= 2 {
                    current_name = Some(parts[0].to_string());
                    current_version = Some(parts[1].trim_start_matches('v').to_string());
                }
            }
        }

        // Don't forget the last package
        if let Some(name) = current_name {
            if let Some(version) = current_version {
                if filter
                    .name_filter
                    .as_ref()
                    .map_or(true, |f| name.contains(f))
                {
                    packages.push(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path: cargo_bin,
                        installed_at: String::new(),
                        is_global: true,
                    });
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.list_installed(InstalledFilter::default()).await?;
        let api = get_api_client();
        let mut updates = Vec::new();

        for pkg in installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            // Use crates.io API for faster version check (batch-friendly)
            if let Ok(crate_info) = api.get_crate(&pkg.name).await {
                if crate_info.max_version != pkg.version {
                    updates.push(UpdateInfo {
                        name: pkg.name,
                        current_version: pkg.version,
                        latest_version: crate_info.max_version,
                        provider: self.id().into(),
                    });
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for CargoProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_cargo(&["--version"]).await?;
        // Output: "cargo 1.82.0 (8f40fc59f 2024-08-21)"
        Ok(output
            .split_whitespace()
            .nth(1)
            .unwrap_or("unknown")
            .to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("cargo")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("cargo not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        if cfg!(windows) {
            Some("winget install Rustlang.Rustup".to_string())
        } else {
            Some("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh".to_string())
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        // cargo install --force compiles from source; use a longer timeout
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(600));
        for (key, value) in &self.env_vars {
            opts = opts.with_env(key, value);
        }
        if let Some(ref url) = self.registry_url {
            opts = opts.with_env("CARGO_REGISTRIES_CRATES_IO_PROTOCOL", "sparse");
            opts = opts.with_env("CARGO_REGISTRIES_CRATES_IO_INDEX", url);
        }
        let out = process::execute("cargo", &["install", "--force", name], Some(opts)).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_cargo(&["install", "--list"]).await?;
        let packages = parse_installed_list_output(&out);
        let mut upgraded = Vec::new();

        for (name, _version) in &packages {
            if self.upgrade_package(name).await.is_ok() {
                upgraded.push(name.clone());
            }
        }

        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_cargo(&["install", "--list"]).await;
        Ok(out
            .map(|s| is_crate_in_installed_output(&s, name))
            .unwrap_or(false))
    }
}

// ── Pure parsing helpers (extracted for testability) ──

/// Parse `cargo install --list` output into (name, version) tuples
pub(crate) fn parse_installed_list_output(output: &str) -> Vec<(String, String)> {
    let mut packages = Vec::new();
    for line in output.lines() {
        if !line.starts_with(' ') && !line.is_empty() {
            let parts: Vec<&str> = line.trim_end_matches(':').split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let version = parts[1].trim_start_matches('v').to_string();
                packages.push((name, version));
            }
        }
    }
    packages
}

/// Check if a crate name matches exactly in `cargo install --list` output
pub(crate) fn is_crate_in_installed_output(output: &str, name: &str) -> bool {
    output.lines().any(|l| {
        if l.starts_with(' ') || l.is_empty() {
            return false;
        }
        l.split_whitespace()
            .next()
            .map_or(false, |crate_name| crate_name == name)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cargo_provider_builder() {
        let provider = CargoProvider::new()
            .with_registry("https://rsproxy.cn");
        
        assert_eq!(provider.registry_url, Some("https://rsproxy.cn".to_string()));
    }

    #[test]
    fn test_cargo_provider_with_env() {
        let provider = CargoProvider::new()
            .with_env("CARGO_HTTP_PROXY", "http://proxy.example.com:8080");
        
        assert_eq!(
            provider.env_vars.get("CARGO_HTTP_PROXY"),
            Some(&"http://proxy.example.com:8080".to_string())
        );
    }

    #[test]
    fn test_capabilities() {
        let provider = CargoProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
    }

    #[test]
    fn test_parse_installed_list() {
        let output = "\
cargo-audit v0.18.3:
    cargo-audit
cargo-edit v0.12.2:
    cargo-add
    cargo-rm
    cargo-upgrade
ripgrep v14.1.0:
    rg";

        let packages = parse_installed_list_output(output);
        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].0, "cargo-audit");
        assert_eq!(packages[0].1, "0.18.3");
        assert_eq!(packages[1].0, "cargo-edit");
        assert_eq!(packages[1].1, "0.12.2");
        assert_eq!(packages[2].0, "ripgrep");
        assert_eq!(packages[2].1, "14.1.0");
    }

    #[test]
    fn test_parse_installed_list_empty() {
        let output = "";
        let packages = parse_installed_list_output(output);
        assert!(packages.is_empty());
    }

    #[test]
    fn test_is_crate_installed_exact_match() {
        let output = "\
serde v1.0.200:
    serde
serde_json v1.0.117:
    serde_json";

        assert!(is_crate_in_installed_output(output, "serde"));
        assert!(is_crate_in_installed_output(output, "serde_json"));
        assert!(!is_crate_in_installed_output(output, "serd"));
        assert!(!is_crate_in_installed_output(output, "serde_yaml"));
    }

    #[test]
    fn test_get_cargo_home_env_var() {
        // This tests the fallback logic structure, not actual env var
        let home = CargoProvider::get_cargo_home();
        // Should always return Some on any platform (either CARGO_HOME or HOME/.cargo)
        assert!(home.is_some());
    }

    #[test]
    fn test_cargo_provider_with_registry_opt_none() {
        let provider = CargoProvider::new().with_registry_opt(None);
        assert_eq!(provider.registry_url, None);
    }

    #[test]
    fn test_cargo_provider_with_registry_opt_some() {
        let provider = CargoProvider::new()
            .with_registry_opt(Some("https://rsproxy.cn".to_string()));
        assert_eq!(provider.registry_url, Some("https://rsproxy.cn".to_string()));
    }
}
