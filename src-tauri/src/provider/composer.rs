use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Composer - PHP Dependency Management
///
/// Composer is a tool for dependency management in PHP. It allows you to
/// declare the libraries your project depends on and it will manage
/// (install/update) them for you.
pub struct ComposerProvider {
    client: Client,
}

impl ComposerProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    async fn run_composer(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(180));
        let output = process::execute("composer", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Search Packagist API
    async fn search_packagist(&self, query: &str, limit: usize) -> CogniaResult<PackagistSearchResult> {
        let url = format!(
            "https://packagist.org/search.json?q={}&per_page={}",
            urlencoding::encode(query),
            limit
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("Packagist API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "Packagist API returned status: {}",
                response.status()
            )));
        }

        let data: PackagistSearchResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse Packagist response: {}", e)))?;

        let packages = data
            .results
            .into_iter()
            .map(|p| PackagistPackage {
                name: p.name,
                description: p.description,
                url: p.url,
                repository: p.repository,
                downloads: p.downloads,
                favers: p.favers,
            })
            .collect();

        Ok(PackagistSearchResult {
            packages,
            total: data.total,
        })
    }

    /// Get package info from Packagist API
    async fn get_packagist_package(&self, name: &str) -> CogniaResult<PackagistPackageInfo> {
        let url = format!("https://repo.packagist.org/p2/{}.json", name);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("Packagist API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::PackageNotFound(name.to_string()));
        }

        let data: PackagistPackageResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse Packagist response: {}", e)))?;

        // Get versions from the packages map
        let versions: Vec<String> = data
            .packages
            .get(name)
            .map(|versions| {
                versions
                    .iter()
                    .map(|v| v.version.clone())
                    .collect()
            })
            .unwrap_or_default();

        let first_version = data
            .packages
            .get(name)
            .and_then(|v| v.first());

        Ok(PackagistPackageInfo {
            name: name.to_string(),
            description: first_version.and_then(|v| v.description.clone()),
            homepage: first_version.and_then(|v| v.homepage.clone()),
            license: first_version.and_then(|v| v.license.as_ref().map(|l| l.join(", "))),
            versions,
        })
    }

    fn get_composer_home() -> Option<PathBuf> {
        // Check COMPOSER_HOME first
        if let Ok(home) = std::env::var("COMPOSER_HOME") {
            return Some(PathBuf::from(home));
        }

        // Default locations
        if cfg!(windows) {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("Composer"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".composer"))
        }
    }

    fn parse_composer_show_output(output: &str) -> Vec<InstalledPackage> {
        let mut packages = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Format: vendor/package version description
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() >= 2 {
                packages.push(InstalledPackage {
                    name: parts[0].to_string(),
                    version: parts[1].to_string(),
                    provider: "composer".into(),
                    install_path: PathBuf::from("vendor").join(parts[0]),
                    installed_at: String::new(),
                    is_global: false,
                });
            }
        }

        packages
    }
}

impl Default for ComposerProvider {
    fn default() -> Self {
        Self::new()
    }
}

// Packagist API response types
#[derive(Debug, Deserialize)]
struct PackagistSearchResponse {
    results: Vec<PackagistSearchItem>,
    #[serde(default)]
    total: i64,
}

/// Result from Packagist search including total count
#[derive(Debug, Clone)]
pub struct PackagistSearchResult {
    pub packages: Vec<PackagistPackage>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
struct PackagistSearchItem {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    repository: Option<String>,
    #[serde(default)]
    downloads: i64,
    #[serde(default)]
    favers: i64,
}

#[derive(Debug, Deserialize)]
struct PackagistPackageResponse {
    packages: std::collections::HashMap<String, Vec<PackagistVersionInfo>>,
}

#[derive(Debug, Deserialize)]
struct PackagistVersionInfo {
    version: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    homepage: Option<String>,
    #[serde(default)]
    license: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct PackagistPackage {
    pub name: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub repository: Option<String>,
    pub downloads: i64,
    pub favers: i64,
}

#[derive(Debug, Clone)]
pub struct PackagistPackageInfo {
    pub name: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub versions: Vec<String>,
}

#[async_trait]
impl Provider for ComposerProvider {
    fn id(&self) -> &str {
        "composer"
    }

    fn display_name(&self) -> &str {
        "Composer (PHP Dependency Management)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::LockVersion,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        process::which("composer").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let result = self.search_packagist(query, limit).await?;

        // Log total available results for debugging
        tracing::debug!("Packagist search for '{}': {} results available, returning {}", query, result.total, result.packages.len());

        Ok(result.packages
            .into_iter()
            .map(|p| PackageSummary {
                name: p.name,
                description: p.description,
                latest_version: None, // Packagist search doesn't return version
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let info = self.get_packagist_package(name).await?;

        let versions: Vec<VersionInfo> = info
            .versions
            .into_iter()
            .filter(|v| !v.starts_with("dev-")) // Filter dev versions
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(PackageInfo {
            name: info.name,
            display_name: None,
            description: info.description,
            homepage: info.homepage,
            license: info.license,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_packagist_package(name).await?;

        Ok(info
            .versions
            .into_iter()
            .filter(|v| !v.starts_with("dev-"))
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}:{}", req.name, v)
        } else {
            req.name.clone()
        };

        let args = if req.global {
            vec!["global", "require", &pkg]
        } else {
            vec!["require", &pkg]
        };

        self.run_composer(&args).await?;

        let install_path = if req.global {
            Self::get_composer_home()
                .map(|p| p.join("vendor").join(&req.name))
                .unwrap_or_default()
        } else {
            PathBuf::from("vendor").join(&req.name)
        };

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_composer(&["remove", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let args = if filter.global_only {
            vec!["global", "show", "--format=json"]
        } else {
            vec!["show", "--format=json"]
        };

        // Try JSON format first
        if let Ok(output) = self.run_composer(&args).await {
            if let Ok(data) = serde_json::from_str::<ComposerShowJson>(&output) {
                let mut packages: Vec<InstalledPackage> = data
                    .installed
                    .into_iter()
                    .map(|p| {
                        let install_path = PathBuf::from("vendor").join(&p.name);
                        InstalledPackage {
                            name: p.name,
                            version: p.version,
                            provider: self.id().into(),
                            install_path,
                            installed_at: String::new(),
                            is_global: filter.global_only,
                        }
                    })
                    .collect();

                if let Some(ref name_filter) = filter.name_filter {
                    packages.retain(|p| p.name.contains(name_filter));
                }

                return Ok(packages);
            }
        }

        // Fallback to text format
        let args = if filter.global_only {
            vec!["global", "show"]
        } else {
            vec!["show"]
        };

        let output = self.run_composer(&args).await?;
        let mut packages = Self::parse_composer_show_output(&output);

        for p in &mut packages {
            p.is_global = filter.global_only;
        }

        if let Some(ref name_filter) = filter.name_filter {
            packages.retain(|p| p.name.contains(name_filter));
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Use composer outdated
        if let Ok(output) = self.run_composer(&["outdated", "--format=json"]).await {
            if let Ok(data) = serde_json::from_str::<ComposerOutdatedJson>(&output) {
                for pkg in data.installed {
                    if packages.is_empty() || packages.contains(&pkg.name) {
                        updates.push(UpdateInfo {
                            name: pkg.name,
                            current_version: pkg.version,
                            latest_version: pkg.latest.unwrap_or_default(),
                            provider: self.id().into(),
                        });
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[derive(Debug, Deserialize)]
struct ComposerShowJson {
    #[serde(default)]
    installed: Vec<ComposerPackageJson>,
}

#[derive(Debug, Deserialize)]
struct ComposerPackageJson {
    name: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct ComposerOutdatedJson {
    #[serde(default)]
    installed: Vec<ComposerOutdatedPackage>,
}

#[derive(Debug, Deserialize)]
struct ComposerOutdatedPackage {
    name: String,
    version: String,
    #[serde(default)]
    latest: Option<String>,
}

#[async_trait]
impl SystemPackageProvider for ComposerProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_composer(&["--version"]).await?;
        // Output: "Composer version x.x.x ..."
        let version = output
            .split_whitespace()
            .nth(2)
            .unwrap_or(output.trim());
        Ok(version.to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("composer")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("composer not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Composer: https://getcomposer.org/download/ or curl -sS https://getcomposer.org/installer | php".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let output = self.run_composer(&["show", name]).await;
        Ok(output.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_composer_provider_creation() {
        let provider = ComposerProvider::new();
        assert_eq!(provider.id(), "composer");
        assert_eq!(
            provider.display_name(),
            "Composer (PHP Dependency Management)"
        );
    }

    #[test]
    fn test_capabilities() {
        let provider = ComposerProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::LockVersion));
    }

    #[test]
    fn test_parse_composer_show_output() {
        let output = r#"laravel/framework     v10.0.0  The Laravel Framework.
guzzlehttp/guzzle     7.5.0    Guzzle is a PHP HTTP client library
monolog/monolog       3.3.1    Sends your logs to files, sockets, inboxes
"#;

        let packages = ComposerProvider::parse_composer_show_output(output);

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "laravel/framework");
        assert_eq!(packages[0].version, "v10.0.0");
        assert_eq!(packages[2].name, "monolog/monolog");
        assert_eq!(packages[2].version, "3.3.1");
    }

    #[test]
    fn test_supported_platforms() {
        let provider = ComposerProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_priority() {
        let provider = ComposerProvider::new();
        assert_eq!(provider.priority(), 80);
    }
}
