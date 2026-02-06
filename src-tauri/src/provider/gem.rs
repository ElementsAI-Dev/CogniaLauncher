use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// RubyGems - The Ruby community's gem hosting service
///
/// Uses `gem` CLI for package management.
/// Interacts with rubygems.org API for search and package information.
pub struct GemProvider;

impl GemProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_gem(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("gem", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get GEM_HOME or default gem directory
    fn get_gem_home() -> Option<PathBuf> {
        std::env::var("GEM_HOME").ok().map(PathBuf::from).or_else(|| {
            if cfg!(windows) {
                std::env::var("USERPROFILE")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".gem"))
            } else {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".gem"))
            }
        })
    }

    /// Get the installed version of a gem
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_gem(&["list", "--exact", name, "--local"]).await?;
        // Output format: "gemname (1.2.3, 1.2.2)"
        for line in out.lines() {
            if line.starts_with(name) || line.to_lowercase().starts_with(&name.to_lowercase()) {
                if let Some(start) = line.find('(') {
                    if let Some(end) = line.find(')') {
                        let versions_str = &line[start + 1..end];
                        // First version listed is the latest installed
                        if let Some(ver) = versions_str.split(',').next() {
                            return Ok(ver.trim().to_string());
                        }
                    }
                }
            }
        }
        Err(CogniaError::Provider(format!("Gem {} not found", name)))
    }

    /// Fetch gem info from rubygems.org API
    async fn fetch_rubygems_info(&self, name: &str) -> CogniaResult<serde_json::Value> {
        let url = format!("https://rubygems.org/api/v1/gems/{}.json", name);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        let resp = client
            .get(&url)
            .header("User-Agent", "CogniaLauncher/1.0")
            .send()
            .await
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(CogniaError::Provider(format!(
                "RubyGems API error: {}",
                resp.status()
            )));
        }

        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| CogniaError::Provider(e.to_string()))
    }

    /// Fetch gem versions from rubygems.org API
    async fn fetch_rubygems_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let url = format!("https://rubygems.org/api/v1/versions/{}.json", name);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        let resp = client
            .get(&url)
            .header("User-Agent", "CogniaLauncher/1.0")
            .send()
            .await
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(vec![]);
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        if let Some(arr) = json.as_array() {
            return Ok(arr
                .iter()
                .filter_map(|v| {
                    let version = v["number"].as_str()?.to_string();
                    let created = v["created_at"].as_str().map(|s| s.to_string());
                    let yanked = v["yanked"].as_bool().unwrap_or(false);

                    Some(VersionInfo {
                        version,
                        release_date: created,
                        deprecated: false,
                        yanked,
                    })
                })
                .collect());
        }

        Ok(vec![])
    }
}

impl Default for GemProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GemProvider {
    fn id(&self) -> &str {
        "gem"
    }
    fn display_name(&self) -> &str {
        "RubyGems (Ruby Package Manager)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
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
        if process::which("gem").await.is_none() {
            return false;
        }
        match process::execute("gem", &["--version"], None).await {
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

        // Use rubygems.org search API
        let url = format!(
            "https://rubygems.org/api/v1/search.json?query={}&page=1",
            query
        );
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| CogniaError::Provider(e.to_string()))?;

        let resp = client
            .get(&url)
            .header("User-Agent", "CogniaLauncher/1.0")
            .send()
            .await;

        if let Ok(resp) = resp {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(arr) = json.as_array() {
                        return Ok(arr
                            .iter()
                            .take(limit)
                            .filter_map(|g| {
                                Some(PackageSummary {
                                    name: g["name"].as_str()?.to_string(),
                                    description: g["info"].as_str().map(|s| {
                                        if s.len() > 200 {
                                            format!("{}...", &s[..200])
                                        } else {
                                            s.to_string()
                                        }
                                    }),
                                    latest_version: g["version"].as_str().map(|s| s.to_string()),
                                    provider: self.id().into(),
                                })
                            })
                            .collect());
                    }
                }
            }
        }

        // Fallback to gem search CLI
        let out = self.run_gem(&["search", "--remote", query]).await?;
        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("***"))
            .take(limit)
            .filter_map(|line| {
                let name = line.split_whitespace().next()?.to_string();
                let version = line
                    .find('(')
                    .and_then(|start| line.find(')').map(|end| line[start + 1..end].to_string()));

                Some(PackageSummary {
                    name,
                    description: None,
                    latest_version: version,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try RubyGems API first
        if let Ok(json) = self.fetch_rubygems_info(name).await {
            let versions = self.fetch_rubygems_versions(name).await.unwrap_or_default();

            return Ok(PackageInfo {
                name: json["name"].as_str().unwrap_or(name).to_string(),
                display_name: Some(json["name"].as_str().unwrap_or(name).to_string()),
                description: json["info"].as_str().map(|s| s.to_string()),
                homepage: json["homepage_uri"]
                    .as_str()
                    .or_else(|| json["project_uri"].as_str())
                    .map(|s| s.to_string()),
                license: json["licenses"]
                    .as_array()
                    .and_then(|arr| arr.first())
                    .and_then(|l| l.as_str())
                    .map(|s| s.to_string()),
                repository: json["source_code_uri"].as_str().map(|s| s.to_string()),
                versions,
                provider: self.id().into(),
            });
        }

        // Fallback to gem info CLI
        let out = self.run_gem(&["info", name, "--remote"]).await?;
        let mut description = None;
        let mut version = None;
        let mut homepage = None;

        for line in out.lines() {
            let line = line.trim();
            if let Some(v) = line.strip_prefix("Version:") {
                version = Some(v.trim().to_string());
            } else if let Some(h) = line.strip_prefix("Homepage:") {
                homepage = Some(h.trim().to_string());
            } else if !line.contains(':') && !line.is_empty() && description.is_none() {
                description = Some(line.to_string());
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
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
        // Try API first
        let versions = self.fetch_rubygems_versions(name).await?;
        if !versions.is_empty() {
            return Ok(versions);
        }

        // Fallback: gem list --remote --all
        let out = self.run_gem(&["list", "--remote", "--all", "--exact", name]).await?;
        for line in out.lines() {
            if line.starts_with(name) {
                if let Some(start) = line.find('(') {
                    if let Some(end) = line.find(')') {
                        let versions_str = &line[start + 1..end];
                        return Ok(versions_str
                            .split(',')
                            .map(|v| VersionInfo {
                                version: v.trim().to_string(),
                                release_date: None,
                                deprecated: false,
                                yanked: false,
                            })
                            .collect());
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use rubygems.org API to get runtime dependencies
        if let Ok(json) = self.fetch_rubygems_info(name).await {
            if let Some(deps) = json["dependencies"]["runtime"].as_array() {
                return Ok(deps
                    .iter()
                    .filter_map(|d| {
                        let dep_name = d["name"].as_str()?.to_string();
                        let req_str = d["requirements"].as_str().unwrap_or(">= 0");
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
        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name, "--no-document"];

        let version_flag;
        if let Some(v) = &req.version {
            version_flag = format!("--version={}", v);
            args.push(&version_flag);
        }

        self.run_gem(&args).await?;

        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_gem_home()
            .map(|p| p.join("gems").join(format!("{}-{}", req.name, actual_version)))
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

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.query_installed_version(name).await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["uninstall", &req.name, "-x"];
        let version_flag;
        if let Some(v) = &req.version {
            version_flag = format!("--version={}", v);
            args.push(&version_flag);
        } else {
            args.push("--all");
        }
        self.run_gem(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_gem(&["list", "--local"]).await?;
        let gem_home = Self::get_gem_home().unwrap_or_default();

        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("***"))
            .filter_map(|line| {
                let name = line.split_whitespace().next()?.to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                let version = line
                    .find('(')
                    .and_then(|start| {
                        line.find(')').map(|end| {
                            line[start + 1..end]
                                .split(',')
                                .next()
                                .unwrap_or("")
                                .trim()
                                .to_string()
                        })
                    })
                    .unwrap_or_default();

                Some(InstalledPackage {
                    name: name.clone(),
                    version: version.clone(),
                    provider: self.id().into(),
                    install_path: gem_home.join("gems").join(format!("{}-{}", name, version)),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_gem(&["outdated"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|line| {
                    // Format: "gemname (current < latest)"
                    let name = line.split_whitespace().next()?.to_string();

                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }

                    let versions_part = line.find('(').and_then(|start| {
                        line.find(')').map(|end| &line[start + 1..end])
                    })?;

                    let parts: Vec<&str> = versions_part.split('<').collect();
                    if parts.len() >= 2 {
                        Some(UpdateInfo {
                            name,
                            current_version: parts[0].trim().to_string(),
                            latest_version: parts[1].trim().to_string(),
                            provider: self.id().into(),
                        })
                    } else {
                        None
                    }
                })
                .collect());
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for GemProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.query_installed_version(name).await.is_ok())
    }
}
