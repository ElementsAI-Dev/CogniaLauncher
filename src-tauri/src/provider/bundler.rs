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

/// Bundler - Ruby dependency management
///
/// Bundler provides a consistent environment for Ruby projects by tracking
/// and installing the exact gems and versions that are needed.
pub struct BundlerProvider {
    client: Client,
}

impl BundlerProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    async fn run_bundle(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(180));
        let output = process::execute("bundle", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn run_gem(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("gem", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Search RubyGems.org API
    async fn search_rubygems(&self, query: &str, limit: usize) -> CogniaResult<Vec<RubyGem>> {
        let url = format!(
            "https://rubygems.org/api/v1/search.json?query={}&page=1",
            urlencoding::encode(query)
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("RubyGems API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "RubyGems API returned status: {}",
                response.status()
            )));
        }

        let gems: Vec<RubyGemResponse> = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse RubyGems response: {}", e)))?;

        Ok(gems
            .into_iter()
            .take(limit)
            .map(|g| RubyGem {
                name: g.name,
                version: g.version,
                info: g.info,
                homepage_uri: g.homepage_uri,
                source_code_uri: g.source_code_uri,
                licenses: g.licenses,
                downloads: g.downloads,
            })
            .collect())
    }

    /// Get gem info from RubyGems.org API
    async fn get_gem_info(&self, name: &str) -> CogniaResult<RubyGemInfo> {
        let url = format!("https://rubygems.org/api/v1/gems/{}.json", name);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("RubyGems API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::PackageNotFound(name.to_string()));
        }

        let gem: RubyGemResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse RubyGems response: {}", e)))?;

        // Get versions
        let versions = self.get_gem_versions(name).await.unwrap_or_default();

        Ok(RubyGemInfo {
            name: gem.name,
            version: gem.version,
            info: gem.info,
            homepage_uri: gem.homepage_uri,
            source_code_uri: gem.source_code_uri,
            licenses: gem.licenses,
            versions,
        })
    }

    /// Get all versions of a gem
    async fn get_gem_versions(&self, name: &str) -> CogniaResult<Vec<String>> {
        let url = format!("https://rubygems.org/api/v1/versions/{}.json", name);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("RubyGems API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Ok(vec![]);
        }

        let versions: Vec<RubyGemVersionResponse> = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse versions response: {}", e)))?;

        Ok(versions.into_iter().map(|v| v.number).collect())
    }

    fn parse_bundle_list_output(output: &str) -> Vec<InstalledPackage> {
        let mut packages = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("Gems") {
                continue;
            }

            // Format: "  * gem_name (version)"
            if let Some(rest) = line.strip_prefix("*").or_else(|| Some(line)) {
                let rest = rest.trim();
                if let Some((name, version_part)) = rest.rsplit_once(' ') {
                    let version = version_part
                        .trim_start_matches('(')
                        .trim_end_matches(')')
                        .to_string();

                    packages.push(InstalledPackage {
                        name: name.trim().to_string(),
                        version,
                        provider: "bundler".into(),
                        install_path: PathBuf::new(),
                        installed_at: String::new(),
                        is_global: false,
                    });
                }
            }
        }

        packages
    }
}

impl Default for BundlerProvider {
    fn default() -> Self {
        Self::new()
    }
}

// RubyGems API response types
#[derive(Debug, Deserialize)]
struct RubyGemResponse {
    name: String,
    version: String,
    #[serde(default)]
    info: Option<String>,
    #[serde(default)]
    homepage_uri: Option<String>,
    #[serde(default)]
    source_code_uri: Option<String>,
    #[serde(default)]
    licenses: Option<Vec<String>>,
    #[serde(default)]
    downloads: i64,
}

#[derive(Debug, Deserialize)]
struct RubyGemVersionResponse {
    number: String,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    yanked: bool,
}

#[derive(Debug, Clone)]
pub struct RubyGem {
    pub name: String,
    pub version: String,
    pub info: Option<String>,
    pub homepage_uri: Option<String>,
    pub source_code_uri: Option<String>,
    pub licenses: Option<Vec<String>>,
    pub downloads: i64,
}

#[derive(Debug, Clone)]
pub struct RubyGemInfo {
    pub name: String,
    pub version: String,
    pub info: Option<String>,
    pub homepage_uri: Option<String>,
    pub source_code_uri: Option<String>,
    pub licenses: Option<Vec<String>>,
    pub versions: Vec<String>,
}

#[async_trait]
impl Provider for BundlerProvider {
    fn id(&self) -> &str {
        "bundler"
    }

    fn display_name(&self) -> &str {
        "Bundler (Ruby Dependency Management)"
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
        75
    }

    async fn is_available(&self) -> bool {
        process::which("bundle").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let gems = self.search_rubygems(query, limit).await?;

        Ok(gems
            .into_iter()
            .map(|g| PackageSummary {
                name: g.name,
                description: g.info,
                latest_version: Some(g.version),
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let info = self.get_gem_info(name).await?;

        let versions: Vec<VersionInfo> = info
            .versions
            .into_iter()
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
            description: info.info,
            homepage: info.homepage_uri,
            license: info.licenses.map(|l| l.join(", ")),
            repository: info.source_code_uri,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let versions = self.get_gem_versions(name).await?;

        Ok(versions
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["add", &req.name];
        let version_arg;

        if let Some(v) = &req.version {
            version_arg = format!("--version={}", v);
            args.push(&version_arg);
        }

        self.run_bundle(&args).await?;

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path: PathBuf::new(),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_bundle(&["remove", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_bundle(&["list"]).await?;
        let mut packages = Self::parse_bundle_list_output(&output);

        if let Some(ref name_filter) = filter.name_filter {
            packages.retain(|p| p.name.contains(name_filter));
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Use bundle outdated
        if let Ok(output) = self.run_bundle(&["outdated", "--parseable"]).await {
            for line in output.lines() {
                // Format: gem_name (newest version, installed version)
                if let Some((name, rest)) = line.split_once(' ') {
                    let parts: Vec<&str> = rest
                        .trim_start_matches('(')
                        .trim_end_matches(')')
                        .split(',')
                        .collect();

                    if parts.len() >= 2 {
                        let latest = parts[0].trim().to_string();
                        let current = parts[1]
                            .trim()
                            .strip_prefix("installed: ")
                            .unwrap_or(parts[1].trim())
                            .to_string();

                        if packages.is_empty() || packages.contains(&name.to_string()) {
                            updates.push(UpdateInfo {
                                name: name.to_string(),
                                current_version: current,
                                latest_version: latest,
                                provider: self.id().into(),
                            });
                        }
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for BundlerProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_bundle(&["--version"]).await?;
        // Output: "Bundler version x.x.x"
        let version = output
            .trim()
            .strip_prefix("Bundler version ")
            .unwrap_or(output.trim());
        Ok(version.to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("bundle")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("bundle not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Bundler: gem install bundler".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let output = self.run_bundle(&["list"]).await;
        Ok(output.map(|s| s.contains(name)).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bundler_provider_creation() {
        let provider = BundlerProvider::new();
        assert_eq!(provider.id(), "bundler");
        assert_eq!(
            provider.display_name(),
            "Bundler (Ruby Dependency Management)"
        );
    }

    #[test]
    fn test_capabilities() {
        let provider = BundlerProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::LockVersion));
    }

    #[test]
    fn test_parse_bundle_list_output() {
        let output = r#"Gems included by the bundle:
  * actioncable (7.0.4)
  * actionmailbox (7.0.4)
  * rails (7.0.4)
"#;

        let packages = BundlerProvider::parse_bundle_list_output(output);

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "actioncable");
        assert_eq!(packages[0].version, "7.0.4");
        assert_eq!(packages[2].name, "rails");
        assert_eq!(packages[2].version, "7.0.4");
    }

    #[test]
    fn test_supported_platforms() {
        let provider = BundlerProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_priority() {
        let provider = BundlerProvider::new();
        assert_eq!(provider.priority(), 75);
    }
}
