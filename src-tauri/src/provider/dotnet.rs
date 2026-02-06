use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    fs,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// .NET SDK Provider - Environment and package management for .NET
///
/// Provides .NET SDK version management and NuGet package search capabilities.
/// Supports global.json for project-local version pinning.
pub struct DotnetProvider {
    client: Client,
}

impl DotnetProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    async fn run_dotnet(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("dotnet", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Get NuGet packages directory
    fn get_nuget_packages_dir() -> Option<PathBuf> {
        // Check NUGET_PACKAGES env var first
        if let Ok(path) = std::env::var("NUGET_PACKAGES") {
            return Some(PathBuf::from(path));
        }
        // Default: ~/.nuget/packages
        if cfg!(windows) {
            std::env::var("USERPROFILE")
                .ok()
                .map(|p| PathBuf::from(p).join(".nuget").join("packages"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".nuget").join("packages"))
        }
    }

    /// Search NuGet API
    async fn search_nuget(&self, query: &str, limit: usize) -> CogniaResult<NuGetSearchResults> {
        let url = format!(
            "https://azuresearch-usnc.nuget.org/query?q={}&take={}",
            urlencoding::encode(query),
            limit
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| CogniaError::Provider(format!("NuGet API request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "NuGet API returned status: {}",
                response.status()
            )));
        }

        let data: NuGetSearchResponse = response
            .json()
            .await
            .map_err(|e| CogniaError::Provider(format!("Failed to parse NuGet response: {}", e)))?;

        let packages = data
            .data
            .into_iter()
            .map(|p| NuGetPackage {
                id: p.id,
                version: p.version,
                description: p.description,
                authors: p.authors,
                project_url: p.project_url,
                license_url: p.license_url,
                total_downloads: p.total_downloads,
                versions: p.versions.into_iter().map(|v| NuGetPackageVersion {
                    version: v.version,
                    downloads: v.downloads,
                }).collect(),
            })
            .collect();

        Ok(NuGetSearchResults {
            packages,
            total_hits: data.total_hits,
        })
    }

    /// Get package info from NuGet API
    async fn get_nuget_package(&self, id: &str) -> CogniaResult<NuGetPackageInfo> {
        let results = self.search_nuget(id, 1).await?;

        results
            .packages
            .into_iter()
            .find(|p| p.id.eq_ignore_ascii_case(id))
            .map(|p| NuGetPackageInfo {
                id: p.id,
                version: p.version,
                description: p.description,
                authors: p.authors,
                project_url: p.project_url,
                license_url: p.license_url,
                versions: p.versions,
            })
            .ok_or_else(|| CogniaError::PackageNotFound(id.to_string()))
    }

    fn get_dotnet_root() -> Option<PathBuf> {
        // Check DOTNET_ROOT first
        if let Ok(root) = std::env::var("DOTNET_ROOT") {
            return Some(PathBuf::from(root));
        }

        // Default locations
        if cfg!(windows) {
            Some(PathBuf::from("C:\\Program Files\\dotnet"))
        } else if cfg!(target_os = "macos") {
            Some(PathBuf::from("/usr/local/share/dotnet"))
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".dotnet"))
        }
    }

    fn parse_sdk_list(output: &str) -> Vec<InstalledVersion> {
        let mut versions = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Format: "x.x.x [path]"
            if let Some((version, path_part)) = line.split_once(' ') {
                let path = path_part
                    .trim_start_matches('[')
                    .trim_end_matches(']')
                    .to_string();

                versions.push(InstalledVersion {
                    version: version.to_string(),
                    install_path: PathBuf::from(path).join(version),
                    size: None,
                    installed_at: None,
                    is_current: false,
                });
            }
        }

        versions
    }

    async fn read_global_json(path: &Path) -> Option<String> {
        let global_json_path = path.join("global.json");
        if let Ok(content) = fs::read_file_string(&global_json_path).await {
            if let Ok(json) = serde_json::from_str::<GlobalJson>(&content) {
                return json.sdk.and_then(|s| s.version);
            }
        }
        None
    }

    async fn write_global_json(path: &Path, version: &str) -> CogniaResult<()> {
        let global_json_path = path.join("global.json");
        let content = GlobalJson {
            sdk: Some(SdkConfig {
                version: Some(version.to_string()),
                roll_forward: Some("latestFeature".to_string()),
            }),
        };

        let json = serde_json::to_string_pretty(&content)
            .map_err(|e| CogniaError::Provider(format!("Failed to serialize global.json: {}", e)))?;

        fs::write_file(&global_json_path, json.as_bytes()).await?;
        Ok(())
    }

    /// Get the installed version of a NuGet package from dotnet list package output
    async fn get_package_version(&self, name: &str) -> CogniaResult<String> {
        let output = self.run_dotnet(&["list", "package"]).await?;
        
        for line in output.lines() {
            let line = line.trim();
            if line.starts_with('>') && line.to_lowercase().contains(&name.to_lowercase()) {
                // Format: "> PackageName    RequestedVersion    ResolvedVersion"
                let parts: Vec<&str> = line[1..].split_whitespace().collect();
                if parts.len() >= 3 {
                    return Ok(parts[parts.len() - 1].to_string());
                }
            }
        }
        
        Err(CogniaError::Provider(format!("Package {} not found", name)))
    }
}

impl Default for DotnetProvider {
    fn default() -> Self {
        Self::new()
    }
}

// NuGet API response types
#[derive(Debug, Deserialize)]
struct NuGetSearchResponse {
    data: Vec<NuGetSearchResult>,
    #[serde(rename = "totalHits")]
    #[serde(default)]
    total_hits: i64,
}

#[derive(Debug, Deserialize)]
struct NuGetSearchResult {
    id: String,
    version: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    authors: Option<Vec<String>>,
    #[serde(rename = "projectUrl")]
    #[serde(default)]
    project_url: Option<String>,
    #[serde(rename = "licenseUrl")]
    #[serde(default)]
    license_url: Option<String>,
    #[serde(rename = "totalDownloads")]
    #[serde(default)]
    total_downloads: i64,
    #[serde(default)]
    versions: Vec<NuGetVersionInfo>,
}

#[derive(Debug, Deserialize)]
struct NuGetVersionInfo {
    version: String,
    #[serde(default)]
    downloads: i64,
}

#[derive(Debug, Clone)]
pub struct NuGetPackage {
    pub id: String,
    pub version: String,
    pub description: Option<String>,
    pub authors: Option<Vec<String>>,
    pub project_url: Option<String>,
    pub license_url: Option<String>,
    pub total_downloads: i64,
    pub versions: Vec<NuGetPackageVersion>,
}

#[derive(Debug, Clone)]
pub struct NuGetPackageVersion {
    pub version: String,
    pub downloads: i64,
}

#[derive(Debug, Clone)]
pub struct NuGetSearchResults {
    pub packages: Vec<NuGetPackage>,
    pub total_hits: i64,
}

#[derive(Debug, Clone)]
pub struct NuGetPackageInfo {
    pub id: String,
    pub version: String,
    pub description: Option<String>,
    pub authors: Option<Vec<String>>,
    pub project_url: Option<String>,
    pub license_url: Option<String>,
    pub versions: Vec<NuGetPackageVersion>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GlobalJson {
    #[serde(default)]
    sdk: Option<SdkConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SdkConfig {
    #[serde(default)]
    version: Option<String>,
    #[serde(rename = "rollForward")]
    #[serde(default)]
    roll_forward: Option<String>,
}

#[async_trait]
impl Provider for DotnetProvider {
    fn id(&self) -> &str {
        "dotnet"
    }

    fn display_name(&self) -> &str {
        ".NET SDK"
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
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        system_detection::is_command_available("dotnet", &["--version"]).await
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let results = self.search_nuget(query, limit).await?;

        tracing::debug!("NuGet search returned {} of {} total hits", results.packages.len(), results.total_hits);

        Ok(results
            .packages
            .into_iter()
            .map(|p| PackageSummary {
                name: p.id,
                description: p.description,
                latest_version: Some(p.version),
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let info = self.get_nuget_package(name).await?;

        let versions: Vec<VersionInfo> = info
            .versions
            .into_iter()
            .map(|v| {
                tracing::trace!("Version {} has {} downloads", v.version, v.downloads);
                VersionInfo {
                    version: v.version,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                }
            })
            .collect();

        Ok(PackageInfo {
            name: info.id,
            display_name: None,
            description: info.description,
            homepage: info.project_url,
            license: info.license_url,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_nuget_package(name).await?;

        Ok(info
            .versions
            .into_iter()
            .map(|v| VersionInfo {
                version: v.version,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use NuGet API to get package dependencies
        let target_version = if version.is_empty() { "index" } else { version };
        let url = format!(
            "https://api.nuget.org/v3/registration5-gz-semver2/{}/index.json",
            name.to_lowercase()
        );

        let client = Client::builder()
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
                    // Navigate to the latest catalog entry
                    if let Some(items) = json["items"].as_array() {
                        if let Some(last_page) = items.last() {
                            if let Some(page_items) = last_page["items"].as_array() {
                                // Find matching version or last entry
                                let entry = if target_version != "index" {
                                    page_items.iter().find(|e| {
                                        e["catalogEntry"]["version"].as_str() == Some(target_version)
                                    })
                                } else {
                                    page_items.last()
                                };

                                if let Some(entry) = entry {
                                    if let Some(dep_groups) = entry["catalogEntry"]["dependencyGroups"].as_array() {
                                        let mut deps = Vec::new();
                                        for group in dep_groups {
                                            if let Some(group_deps) = group["dependencies"].as_array() {
                                                for d in group_deps {
                                                    if let Some(dep_name) = d["id"].as_str() {
                                                        let range = d["range"].as_str().unwrap_or("*");
                                                        let constraint = range
                                                            .parse::<VersionConstraint>()
                                                            .unwrap_or(VersionConstraint::Any);
                                                        deps.push(Dependency {
                                                            name: dep_name.to_string(),
                                                            constraint,
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                        if !deps.is_empty() {
                                            return Ok(deps);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        // For NuGet packages, use dotnet add package
        let mut args = vec!["add", "package", &req.name];
        let version_arg;

        if let Some(v) = &req.version {
            version_arg = format!("--version={}", v);
            args.push(&version_arg);
        }

        self.run_dotnet(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .get_package_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        // NuGet packages are stored in the global packages folder
        let install_path = Self::get_nuget_packages_dir()
            .unwrap_or_else(|| PathBuf::from(".nuget").join("packages"));

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
        self.run_dotnet(&["remove", "package", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // List installed NuGet packages in current project
        let output = self.run_dotnet(&["list", "package"]).await?;
        let mut packages = Vec::new();

        let mut in_top_level = false;
        for line in output.lines() {
            let line = line.trim();

            if line.contains("Top-level Package") {
                in_top_level = true;
                continue;
            }

            if in_top_level && line.starts_with('>') {
                // Format: "> PackageName    RequestedVersion    ResolvedVersion"
                let parts: Vec<&str> = line[1..].split_whitespace().collect();
                if parts.len() >= 3 {
                    let name = parts[0].to_string();
                    let version = parts[parts.len() - 1].to_string();

                    if let Some(ref name_filter) = filter.name_filter {
                        if !name.contains(name_filter) {
                            continue;
                        }
                    }

                    // NuGet packages are typically in ~/.nuget/packages or project-local
                    let nuget_path = Self::get_nuget_packages_dir()
                        .map(|p| p.join(&name.to_lowercase()).join(&version))
                        .unwrap_or_default();

                    packages.push(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path: nuget_path,
                        installed_at: String::new(),
                        is_global: false,
                    });
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let mut updates = Vec::new();

        // Use dotnet list package --outdated
        if let Ok(output) = self.run_dotnet(&["list", "package", "--outdated"]).await {
            let mut in_top_level = false;
            for line in output.lines() {
                let line = line.trim();

                if line.contains("Top-level Package") {
                    in_top_level = true;
                    continue;
                }

                if in_top_level && line.starts_with('>') {
                    let parts: Vec<&str> = line[1..].split_whitespace().collect();
                    if parts.len() >= 4 {
                        let name = parts[0].to_string();
                        let current = parts[1].to_string();
                        let latest = parts[parts.len() - 1].to_string();

                        if packages.is_empty() || packages.contains(&name) {
                            updates.push(UpdateInfo {
                                name,
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
impl EnvironmentProvider for DotnetProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_dotnet(&["--list-sdks"]).await?;
        let mut versions = Self::parse_sdk_list(&output);

        // Mark current version
        if let Ok(Some(current)) = self.get_current_version().await {
            for v in &mut versions {
                if v.version == current {
                    v.is_current = true;
                }
            }
        }

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_dotnet(&["--version"]).await?;
        Ok(Some(output.trim().to_string()))
    }

    async fn set_global_version(&self, _version: &str) -> CogniaResult<()> {
        // .NET doesn't have a simple global version switch
        // Users typically set version via global.json in their home directory
        Err(CogniaError::Provider(
            ".NET SDK global version is managed by PATH order. Use global.json for project-specific versions.".into()
        ))
    }

    async fn set_local_version(
        &self,
        project_path: &Path,
        version: &str,
    ) -> CogniaResult<()> {
        Self::write_global_json(project_path, version).await
    }

    async fn detect_version(
        &self,
        start_path: &Path,
    ) -> CogniaResult<Option<VersionDetection>> {
        // Check global.json in current and parent directories
        let mut current = start_path.to_path_buf();

        loop {
            if let Some(version) = Self::read_global_json(&current).await {
                return Ok(Some(VersionDetection {
                    version,
                    source: VersionSource::LocalFile,
                    source_path: Some(current.join("global.json")),
                }));
            }

            if !current.pop() {
                break;
            }
        }

        // Fallback to system version
        if let Ok(Some(version)) = self.get_current_version().await {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemExecutable,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, _version: &str) -> CogniaResult<EnvModifications> {
        let dotnet_root = Self::get_dotnet_root()
            .ok_or_else(|| CogniaError::Provider("DOTNET_ROOT not found".into()))?;

        let mut set_variables = std::collections::HashMap::new();
        set_variables.insert("DOTNET_ROOT".to_string(), dotnet_root.to_string_lossy().into_owned());

        Ok(EnvModifications {
            path_prepend: vec![dotnet_root],
            path_append: vec![],
            set_variables,
            unset_variables: vec![],
        })
    }

    fn version_file_name(&self) -> &str {
        "global.json"
    }
}

#[async_trait]
impl SystemPackageProvider for DotnetProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_dotnet(&["--version"]).await?;
        Ok(output.trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("dotnet")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("dotnet not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install .NET SDK: https://dotnet.microsoft.com/download or use your system package manager (winget install Microsoft.DotNet.SDK.8, brew install dotnet, apt install dotnet-sdk-8.0)".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let output = self.run_dotnet(&["list", "package"]).await;
        Ok(output.map(|s| s.contains(name)).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dotnet_provider_creation() {
        let provider = DotnetProvider::new();
        assert_eq!(provider.id(), "dotnet");
        assert_eq!(provider.display_name(), ".NET SDK");
    }

    #[test]
    fn test_capabilities() {
        let provider = DotnetProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_parse_sdk_list() {
        let output = r#"6.0.400 [C:\Program Files\dotnet\sdk]
7.0.100 [C:\Program Files\dotnet\sdk]
8.0.100 [C:\Program Files\dotnet\sdk]
"#;

        let versions = DotnetProvider::parse_sdk_list(output);

        assert_eq!(versions.len(), 3);
        assert_eq!(versions[0].version, "6.0.400");
        assert_eq!(versions[1].version, "7.0.100");
        assert_eq!(versions[2].version, "8.0.100");
    }

    #[test]
    fn test_supported_platforms() {
        let provider = DotnetProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_version_file_name() {
        let provider = DotnetProvider::new();
        assert_eq!(provider.version_file_name(), "global.json");
    }

    #[test]
    fn test_priority() {
        let provider = DotnetProvider::new();
        assert_eq!(provider.priority(), 80);
    }
}
