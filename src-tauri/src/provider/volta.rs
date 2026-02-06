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

/// Volta - The Hassle-Free JavaScript Tool Manager
///
/// Volta manages Node.js, npm, yarn, and other JS tools.
/// It pins tool versions per-project via `package.json` and
/// transparently switches versions based on the current directory.
pub struct VoltaProvider {
    volta_home: Option<PathBuf>,
}

impl VoltaProvider {
    pub fn new() -> Self {
        let volta_home = std::env::var("VOLTA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".volta")));

        Self { volta_home }
    }

    fn volta_home(&self) -> CogniaResult<&PathBuf> {
        self.volta_home
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("VOLTA_HOME not found".into()))
    }

    async fn run_volta(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("volta", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get installed Node.js version via volta
    async fn get_node_version(&self) -> CogniaResult<String> {
        let out = process::execute("node", &["--version"], None).await?;
        if out.success {
            Ok(out.stdout.trim().trim_start_matches('v').to_string())
        } else {
            Err(CogniaError::Provider("Failed to get Node.js version".into()))
        }
    }

    /// Parse `volta list` output
    fn parse_volta_list(output: &str) -> Vec<(String, String, PathBuf)> {
        let mut results = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("⚡") || line.starts_with("No") {
                continue;
            }

            // Format varies: "tool@version (default|current|...)" or "tool@version"
            if let Some(at_pos) = line.find('@') {
                let tool = line[..at_pos].trim().to_string();
                let rest = &line[at_pos + 1..];
                let version = rest
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();

                if !tool.is_empty() && !version.is_empty() {
                    results.push((tool, version, PathBuf::new()));
                }
            }
        }

        results
    }
}

impl Default for VoltaProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for VoltaProvider {
    fn id(&self) -> &str {
        "volta"
    }
    fn display_name(&self) -> &str {
        "Volta (JavaScript Tool Manager)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::List,
            Capability::VersionSwitch,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        90
    }

    async fn is_available(&self) -> bool {
        if process::which("volta").await.is_none() {
            return false;
        }
        match process::execute("volta", &["--version"], None).await {
            Ok(output) => output.success && !output.stdout.is_empty(),
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // Volta manages specific tools (node, npm, yarn, pnpm) plus global packages
        // For tool search, return known tools matching query
        let tools = vec!["node", "npm", "yarn", "pnpm"];
        let results: Vec<PackageSummary> = tools
            .into_iter()
            .filter(|t| t.contains(&query.to_lowercase().as_str()))
            .map(|t| PackageSummary {
                name: t.into(),
                description: Some(format!("{} (managed by Volta)", t)),
                latest_version: None,
                provider: self.id().into(),
            })
            .collect();

        if !results.is_empty() {
            return Ok(results);
        }

        // For npm packages, use npm registry API
        use super::api::get_api_client;
        let api = get_api_client();
        match api.search_npm(query, 20).await {
            Ok(pkgs) => Ok(pkgs
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.description,
                    latest_version: Some(p.version),
                    provider: self.id().into(),
                })
                .collect()),
            Err(_) => Ok(vec![]),
        }
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // For runtime tools, use volta list to get current info
        let known_tools = ["node", "npm", "yarn", "pnpm"];
        if known_tools.contains(&name) {
            let out = self.run_volta(&["list", name]).await.unwrap_or_default();
            let items = Self::parse_volta_list(&out);

            let versions: Vec<VersionInfo> = items
                .iter()
                .map(|(_, v, _)| VersionInfo {
                    version: v.clone(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            return Ok(PackageInfo {
                name: name.into(),
                display_name: Some(format!("{} (via Volta)", name)),
                description: Some(format!("{} runtime managed by Volta", name)),
                homepage: Some("https://volta.sh".into()),
                license: None,
                repository: Some("https://github.com/volta-cli/volta".into()),
                versions,
                provider: self.id().into(),
            });
        }

        // For npm packages, use npm registry
        use super::api::get_api_client;
        let api = get_api_client();
        if let Ok(pkg) = api.get_npm_package(name).await {
            return Ok(PackageInfo {
                name: pkg.name.clone(),
                display_name: Some(pkg.name),
                description: pkg.description,
                homepage: pkg.homepage,
                license: pkg.license,
                repository: pkg.repository,
                versions: pkg
                    .versions
                    .into_iter()
                    .map(|v| VersionInfo {
                        version: v,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                    .collect(),
                provider: self.id().into(),
            });
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: None,
            homepage: None,
            license: None,
            repository: None,
            versions: vec![],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let known_tools = ["node", "npm", "yarn", "pnpm"];

        if known_tools.contains(&req.name.as_str()) {
            // Install a runtime tool
            let pkg = if let Some(v) = &req.version {
                format!("{}@{}", req.name, v)
            } else {
                req.name.clone()
            };
            self.run_volta(&["install", &pkg]).await?;
        } else {
            // Install a global npm package via volta
            let pkg = if let Some(v) = &req.version {
                format!("{}@{}", req.name, v)
            } else {
                req.name.clone()
            };
            self.run_volta(&["install", &pkg]).await?;
        }

        // Determine actual version
        let actual_version = if let Ok(out) = self.run_volta(&["list", &req.name]).await {
            let items = Self::parse_volta_list(&out);
            items
                .first()
                .map(|(_, v, _)| v.clone())
                .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()))
        } else {
            req.version.clone().unwrap_or_else(|| "unknown".into())
        };

        let install_path = self
            .volta_home()?
            .join("tools")
            .join("image")
            .join(&req.name)
            .join(&actual_version);

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
        if let Ok(out) = self.run_volta(&["list", name]).await {
            let items = Self::parse_volta_list(&out);
            if let Some((_, v, _)) = items.first() {
                return Ok(Some(v.clone()));
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_volta(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_volta(&["list", "--format=plain", "all"]).await?;
        let volta_home = self.volta_home()?.clone();
        let items = Self::parse_volta_list(&out);

        Ok(items
            .into_iter()
            .filter(|(name, _, _)| {
                if let Some(ref name_filter) = filter.name_filter {
                    name.contains(name_filter)
                } else {
                    true
                }
            })
            .map(|(name, version, _)| InstalledPackage {
                name: name.clone(),
                version: version.clone(),
                provider: self.id().into(),
                install_path: volta_home
                    .join("tools")
                    .join("image")
                    .join(&name)
                    .join(&version),
                installed_at: String::new(),
                is_global: true,
            })
            .collect())
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // Volta doesn't have a built-in update check
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for VoltaProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let out = self.run_volta(&["list", "node"]).await?;
        let items = Self::parse_volta_list(&out);
        let volta_home = self.volta_home()?.clone();

        let current = self.get_node_version().await.unwrap_or_default();

        Ok(items
            .into_iter()
            .map(|(_, version, _)| {
                let is_current = version == current;
                InstalledVersion {
                    version: version.clone(),
                    install_path: volta_home
                        .join("tools")
                        .join("image")
                        .join("node")
                        .join(&version),
                    size: None,
                    installed_at: None,
                    is_current,
                }
            })
            .collect())
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        match self.get_node_version().await {
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_volta(&["install", &format!("node@{}", version)])
            .await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        // Volta uses `volta pin` to set project-local version in package.json
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(60));
        let cwd = project_path.to_string_lossy().to_string();
        process::execute(
            "volta",
            &["pin", &format!("node@{}", version)],
            Some(opts.with_cwd(&cwd)),
        )
        .await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check package.json for volta.node pin
        let pkg_json = start_path.join("package.json");
        if pkg_json.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&pkg_json).await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(node_version) = json["volta"]["node"].as_str() {
                        return Ok(Some(VersionDetection {
                            version: node_version.to_string(),
                            source: VersionSource::Manifest,
                            source_path: Some(pkg_json),
                        }));
                    }
                }
            }
        }

        // Fall back to current version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, _version: &str) -> CogniaResult<EnvModifications> {
        // Volta handles PATH automatically via shims
        Ok(EnvModifications::default())
    }

    fn version_file_name(&self) -> &str {
        "package.json"
    }
}
