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

/// mise (formerly rtx) - Polyglot runtime/tool version manager
///
/// mise is a modern replacement for asdf, nvm, pyenv, rbenv, etc.
/// It manages tool versions via `mise.toml` or `.tool-versions` files
/// and supports backends: asdf plugins, ubi, vfox, cargo, npm, etc.
///
/// Key commands:
/// - `mise use <tool>@<version>` — install + activate
/// - `mise install <tool>@<version>` — install only
/// - `mise ls` — list installed tools
/// - `mise ls-remote <tool>` — list available remote versions
/// - `mise current` — show current tool versions
/// - `mise upgrade` — upgrade installed tools
pub struct MiseProvider {
    mise_data_dir: Option<PathBuf>,
}

impl MiseProvider {
    pub fn new() -> Self {
        let mise_data_dir = std::env::var("MISE_DATA_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("XDG_DATA_HOME")
                    .ok()
                    .map(|d| PathBuf::from(d).join("mise"))
            })
            .or_else(|| dirs_home().map(|h| h.join(".local").join("share").join("mise")));

        Self { mise_data_dir }
    }

    async fn run_mise(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let out = process::execute("mise", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Parse `mise ls --json` output
    fn parse_ls_json(output: &str) -> Vec<(String, String, PathBuf, bool)> {
        let mut results = Vec::new();

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(output) {
            // mise ls --json returns: { "tool_name": [{"version": "x.y.z", "install_path": "...", "active": true}, ...] }
            if let Some(obj) = json.as_object() {
                for (tool, versions_val) in obj {
                    if let Some(versions_arr) = versions_val.as_array() {
                        for v in versions_arr {
                            let version = v["version"].as_str().unwrap_or("").to_string();
                            let install_path = v["install_path"]
                                .as_str()
                                .map(PathBuf::from)
                                .unwrap_or_default();
                            let active = v["active"].as_bool().unwrap_or(false);

                            if !version.is_empty() {
                                results.push((tool.clone(), version, install_path, active));
                            }
                        }
                    }
                }
            }
        }

        results
    }
}

impl Default for MiseProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for MiseProvider {
    fn id(&self) -> &str {
        "mise"
    }

    fn display_name(&self) -> &str {
        "mise (Polyglot Runtime Manager)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        92 // Higher than asdf (88) since mise is the modern successor
    }

    async fn is_available(&self) -> bool {
        if process::which("mise").await.is_none() {
            return false;
        }
        match process::execute("mise", &["--version"], None).await {
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

        // mise registry lists all available tool shorthands
        let out = self.run_mise(&["registry"]).await?;

        Ok(out
            .lines()
            .filter(|l| {
                let name = l.split_whitespace().next().unwrap_or("");
                name.contains(query)
            })
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                let name = parts.first()?.to_string();
                let backend = parts.get(1).map(|s| s.to_string());

                Some(PackageSummary {
                    name,
                    description: backend.map(|b| format!("Backend: {}", b)),
                    latest_version: None,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions(name).await.unwrap_or_default();

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("{} (via mise)", name)),
            description: Some(format!("{} runtime managed by mise", name)),
            homepage: Some("https://mise.jdx.dev".into()),
            license: None,
            repository: Some("https://github.com/jdx/mise".into()),
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // mise ls-remote <tool> lists all available versions
        let out = self.run_mise(&["ls-remote", name]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|v| VersionInfo {
                version: v.trim().to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let tool_spec = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            format!("{}@latest", req.name)
        };

        // Use `mise use --global` to install and activate globally
        self.run_mise(&["use", "--global", &tool_spec]).await?;

        // Resolve actual version
        let actual_version = if let Ok(out) = self.run_mise(&["current", &req.name]).await {
            out.trim().to_string()
        } else if let Ok(out) = self.run_mise(&["latest", &req.name]).await {
            out.trim().to_string()
        } else {
            req.version.clone().unwrap_or_else(|| "unknown".into())
        };

        let install_path = self
            .mise_data_dir
            .as_ref()
            .map(|d| d.join("installs").join(&req.name).join(&actual_version))
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
        if let Ok(out) = self.run_mise(&["current", name]).await {
            let version = out.trim().to_string();
            if !version.is_empty() && version != "missing" {
                return Ok(Some(version));
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for mise uninstall".into()))?;

        let tool_spec = format!("{}@{}", req.name, version);
        self.run_mise(&["uninstall", &tool_spec]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // Try JSON output first
        let out = self.run_mise(&["ls", "--json"]).await;

        if let Ok(json_out) = out {
            let items = Self::parse_ls_json(&json_out);
            return Ok(items
                .into_iter()
                .filter(|(name, _, _, _)| {
                    if let Some(ref name_filter) = filter.name_filter {
                        name.contains(name_filter)
                    } else {
                        true
                    }
                })
                .map(|(name, version, install_path, _active)| InstalledPackage {
                    name: name.clone(),
                    version: version.clone(),
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                })
                .collect());
        }

        // Fallback to text output
        let out = self.run_mise(&["ls"]).await?;
        let mise_data = self.mise_data_dir.clone().unwrap_or_default();

        Ok(out
            .lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                // Format: "tool  version  path  source"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() < 2 {
                    return None;
                }

                let name = parts[0].to_string();
                let version = parts[1].to_string();

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name: name.clone(),
                    version: version.clone(),
                    provider: self.id().into(),
                    install_path: mise_data.join("installs").join(&name).join(&version),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // mise outdated shows tools that can be upgraded
        let out = self.run_mise(&["outdated"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.trim().is_empty() && !l.starts_with("Tool"))
                .filter_map(|line| {
                    // Format: "Tool  Requested  Current  Latest"
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() < 4 {
                        return None;
                    }

                    let name = parts[0].to_string();
                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }

                    let current = parts[2].to_string();
                    let latest = parts[3].to_string();

                    if current != latest {
                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
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
impl EnvironmentProvider for MiseProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let out = self.run_mise(&["ls", "--json"]).await?;
        let items = Self::parse_ls_json(&out);

        Ok(items
            .into_iter()
            .map(|(tool, version, install_path, active)| InstalledVersion {
                version: format!("{}@{}", tool, version),
                install_path,
                size: None,
                installed_at: None,
                is_current: active,
            })
            .collect())
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let out = self.run_mise(&["current"]).await?;
        let first_line = out.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            Ok(Some(format!("{}@{}", parts[0], parts[1])))
        } else {
            Ok(None)
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        // version format: "tool@version"
        self.run_mise(&["use", "--global", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let cwd = project_path.to_string_lossy().to_string();
        let opts = ProcessOptions::new()
            .with_timeout(Duration::from_secs(120))
            .with_cwd(&cwd);
        process::execute("mise", &["use", version], Some(opts)).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check mise.toml
        let mise_toml = start_path.join("mise.toml");
        if mise_toml.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&mise_toml).await {
                // Simple TOML parsing for [tools] section
                let mut in_tools = false;
                for line in content.lines() {
                    let line = line.trim();
                    if line == "[tools]" {
                        in_tools = true;
                        continue;
                    }
                    if line.starts_with('[') {
                        in_tools = false;
                        continue;
                    }
                    if in_tools && line.contains('=') {
                        let parts: Vec<&str> = line.splitn(2, '=').collect();
                        if parts.len() == 2 {
                            let tool = parts[0].trim();
                            let version = parts[1].trim().trim_matches('"').trim_matches('\'');
                            return Ok(Some(VersionDetection {
                                version: format!("{}@{}", tool, version),
                                source: VersionSource::LocalFile,
                                source_path: Some(mise_toml),
                            }));
                        }
                    }
                }
            }
        }

        // Check .mise.toml
        let mise_local = start_path.join(".mise.toml");
        if mise_local.exists() {
            return Ok(Some(VersionDetection {
                version: "see .mise.toml".to_string(),
                source: VersionSource::LocalFile,
                source_path: Some(mise_local),
            }));
        }

        // Check .tool-versions (asdf compat)
        let tool_versions = start_path.join(".tool-versions");
        if tool_versions.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') {
                        continue;
                    }
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        return Ok(Some(VersionDetection {
                            version: format!("{}@{}", parts[0], parts[1]),
                            source: VersionSource::LocalFile,
                            source_path: Some(tool_versions),
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
        // mise handles PATH via activation/shims automatically
        Ok(EnvModifications::default())
    }

    fn version_file_name(&self) -> &str {
        "mise.toml"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
