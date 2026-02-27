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

/// asdf - Extendable version manager supporting multiple runtimes
///
/// asdf manages multiple language runtime versions via plugins.
/// Each plugin adds support for a specific tool (nodejs, python, ruby, etc.).
/// Version pinning is done via `.tool-versions` files.
pub struct AsdfProvider {
    asdf_dir: Option<PathBuf>,
}

impl AsdfProvider {
    pub fn new() -> Self {
        let asdf_dir = std::env::var("ASDF_DIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("ASDF_DATA_DIR").ok().map(PathBuf::from))
            .or_else(|| dirs_home().map(|h| h.join(".asdf")));

        Self { asdf_dir }
    }

    fn asdf_dir(&self) -> CogniaResult<&PathBuf> {
        self.asdf_dir
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("ASDF_DIR not found".into()))
    }

    async fn run_asdf(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let out = process::execute("asdf", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// List installed plugins
    async fn list_plugins(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_asdf(&["plugin", "list"]).await?;
        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .map(|l| l.trim().to_string())
            .collect())
    }

    /// Parse tool-versions file
    fn parse_tool_versions(content: &str) -> Vec<(String, String)> {
        content
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with('#'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    Some((parts[0].to_string(), parts[1].to_string()))
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Default for AsdfProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for AsdfProvider {
    fn id(&self) -> &str {
        "asdf"
    }
    fn display_name(&self) -> &str {
        "asdf (Multiple Runtime Version Manager)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::VersionSwitch,
            Capability::MultiVersion,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        88
    }

    async fn is_available(&self) -> bool {
        if process::which("asdf").await.is_none() {
            return false;
        }
        match process::execute("asdf", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);

        // Search available plugins
        let out = self.run_asdf(&["plugin", "list", "all"]).await?;

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
                let url = parts.get(1).map(|s| s.to_string());

                Some(PackageSummary {
                    name,
                    description: url,
                    latest_version: None,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Check if plugin is installed and get latest version
        let versions = self.get_versions(name).await.unwrap_or_default();

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("{} (via asdf)", name)),
            description: Some(format!("{} runtime managed by asdf version manager", name)),
            homepage: Some("https://asdf-vm.com".into()),
            license: None,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Ensure plugin is installed
        let plugins = self.list_plugins().await.unwrap_or_default();
        if !plugins.contains(&name.to_string()) {
            // Try to add the plugin first
            let _ = self.run_asdf(&["plugin", "add", name]).await;
        }

        let out = self.run_asdf(&["list", "all", name]).await?;

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
        let version = req.version.as_deref().unwrap_or("latest");

        // Ensure plugin is installed
        let plugins = self.list_plugins().await.unwrap_or_default();
        if !plugins.contains(&req.name) {
            self.run_asdf(&["plugin", "add", &req.name]).await?;
        }

        // Install the version
        self.run_asdf(&["install", &req.name, version]).await?;

        // Resolve actual version (especially for "latest")
        let actual_version = if version == "latest" {
            self.run_asdf(&["latest", &req.name])
                .await
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|_| version.to_string())
        } else {
            version.to_string()
        };

        let install_path = self
            .asdf_dir()?
            .join("installs")
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
        if let Ok(out) = self.run_asdf(&["current", name]).await {
            // Output format: "plugin  version  (set by ...)"
            let parts: Vec<&str> = out.split_whitespace().collect();
            if parts.len() >= 2 {
                let version = parts[1].to_string();
                if version != "______" && !version.is_empty() {
                    return Ok(Some(version));
                }
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for asdf uninstall".into()))?;

        self.run_asdf(&["uninstall", &req.name, &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let plugins = self.list_plugins().await?;
        let asdf_dir = self.asdf_dir()?;
        let mut packages = Vec::new();

        for plugin in &plugins {
            if let Some(ref name_filter) = filter.name_filter {
                if !plugin.contains(name_filter) {
                    continue;
                }
            }

            if let Ok(out) = self.run_asdf(&["list", plugin]).await {
                for line in out.lines() {
                    let version = line.trim().trim_start_matches('*').trim();
                    if version.is_empty() || version == "No versions installed" {
                        continue;
                    }

                    packages.push(InstalledPackage {
                        name: format!("{}@{}", plugin, version),
                        version: version.to_string(),
                        provider: self.id().into(),
                        install_path: asdf_dir.join("installs").join(plugin).join(version),
                        installed_at: String::new(),
                        is_global: true,
                    });
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // asdf doesn't have a built-in update check for installed versions
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for AsdfProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let plugins = self.list_plugins().await?;
        let asdf_dir = self.asdf_dir()?;
        let mut versions = Vec::new();

        for plugin in &plugins {
            let current = self.get_installed_version(plugin).await.ok().flatten();

            if let Ok(out) = self.run_asdf(&["list", plugin]).await {
                for line in out.lines() {
                    let version_str = line.trim().trim_start_matches('*').trim();
                    if version_str.is_empty() || version_str == "No versions installed" {
                        continue;
                    }

                    let is_active =
                        line.trim().starts_with('*') || current.as_deref() == Some(version_str);

                    versions.push(InstalledVersion {
                        version: format!("{}@{}", plugin, version_str),
                        install_path: asdf_dir.join("installs").join(plugin).join(version_str),
                        size: None,
                        installed_at: None,
                        is_current: is_active,
                    });
                }
            }
        }

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let out = self.run_asdf(&["current"]).await?;
        let first_line = out.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            Ok(Some(format!("{}@{}", parts[0], parts[1])))
        } else {
            Ok(None)
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        let (plugin, ver) = if let Some(at_pos) = version.find('@') {
            (&version[..at_pos], &version[at_pos + 1..])
        } else {
            return Err(CogniaError::Provider(
                "Version must be in format 'plugin@version'".into(),
            ));
        };
        self.run_asdf(&["global", plugin, ver]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let (plugin, ver) = if let Some(at_pos) = version.find('@') {
            (&version[..at_pos], &version[at_pos + 1..])
        } else {
            return Err(CogniaError::Provider(
                "Version must be in format 'plugin@version'".into(),
            ));
        };

        // Write to .tool-versions file in project directory
        let tool_versions_path = project_path.join(".tool-versions");
        let mut content = String::new();

        // Read existing file and update/add the entry
        if tool_versions_path.exists() {
            if let Ok(existing) = crate::platform::fs::read_file_string(&tool_versions_path).await {
                let mut found = false;
                for line in existing.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.first() == Some(&plugin) {
                        content.push_str(&format!("{} {}\n", plugin, ver));
                        found = true;
                    } else {
                        content.push_str(line);
                        content.push('\n');
                    }
                }
                if !found {
                    content.push_str(&format!("{} {}\n", plugin, ver));
                }
            } else {
                content = format!("{} {}\n", plugin, ver);
            }
        } else {
            content = format!("{} {}\n", plugin, ver);
        }

        crate::platform::fs::write_file_string(&tool_versions_path, &content).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check .tool-versions file
        let tool_versions_path = start_path.join(".tool-versions");
        if tool_versions_path.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions_path).await {
                let versions = Self::parse_tool_versions(&content);
                if let Some((tool, version)) = versions.first() {
                    return Ok(Some(VersionDetection {
                        version: format!("{}@{}", tool, version),
                        source: VersionSource::LocalFile,
                        source_path: Some(tool_versions_path),
                    }));
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
        // asdf handles PATH via shims automatically
        Ok(EnvModifications::default())
    }

    fn version_file_name(&self) -> &str {
        ".tool-versions"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tool_versions_normal() {
        let content = "nodejs 18.17.0\npython 3.11.4\nruby 3.2.2\n";
        let result = AsdfProvider::parse_tool_versions(content);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], ("nodejs".to_string(), "18.17.0".to_string()));
        assert_eq!(result[1], ("python".to_string(), "3.11.4".to_string()));
        assert_eq!(result[2], ("ruby".to_string(), "3.2.2".to_string()));
    }

    #[test]
    fn test_parse_tool_versions_with_comments() {
        let content = "# This is a comment\nnodejs 18.17.0\n# Another comment\npython 3.11.4\n";
        let result = AsdfProvider::parse_tool_versions(content);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].0, "nodejs");
        assert_eq!(result[1].0, "python");
    }

    #[test]
    fn test_parse_tool_versions_blank_lines() {
        let content = "\nnodejs 18.17.0\n\n\npython 3.11.4\n\n";
        let result = AsdfProvider::parse_tool_versions(content);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_parse_tool_versions_empty() {
        let result = AsdfProvider::parse_tool_versions("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_tool_versions_single_word_line() {
        let content = "nodejs\n";
        let result = AsdfProvider::parse_tool_versions(content);
        assert!(result.is_empty());
    }

    #[test]
    fn test_provider_metadata() {
        let provider = AsdfProvider::new();
        assert_eq!(provider.id(), "asdf");
        assert_eq!(
            provider.display_name(),
            "asdf (Multiple Runtime Version Manager)"
        );
        assert_eq!(provider.priority(), 88);
    }

    #[test]
    fn test_capabilities() {
        let provider = AsdfProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = AsdfProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert!(!platforms.contains(&Platform::Windows));
    }

    #[test]
    fn test_default_impl() {
        let _provider = AsdfProvider::default();
    }
}
