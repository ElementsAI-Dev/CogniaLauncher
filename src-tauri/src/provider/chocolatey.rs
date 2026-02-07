use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct ChocolateyProvider;

impl ChocolateyProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a choco command with common flags and timeout.
    /// Always passes `--no-progress` to suppress progress bars in automated output.
    async fn run_choco(&self, args: &[&str]) -> CogniaResult<String> {
        let mut full_args: Vec<&str> = args.to_vec();
        if !full_args.contains(&"--no-progress") {
            full_args.push("--no-progress");
        }

        let opts = process::ProcessOptions::new()
            .with_timeout(Duration::from_secs(300)); // choco operations can be slow

        let out = process::execute("choco", &full_args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            let msg = if out.stderr.trim().is_empty() { out.stdout } else { out.stderr };
            Err(CogniaError::Provider(msg))
        }
    }

    /// Get the installed version of a package using `choco list --exact -r`.
    /// O(1) lookup using --exact instead of listing all packages.
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        // In Chocolatey v2+, `choco list` only lists local packages
        let out = self.run_choco(&["list", "--exact", name, "-r"]).await?;
        for line in out.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 2 && parts[0].eq_ignore_ascii_case(name) {
                return Ok(parts[1].trim().to_string());
            }
        }
        Err(CogniaError::Provider(format!("Package {} not installed", name)))
    }

    fn get_choco_dir() -> PathBuf {
        std::env::var("ChocolateyInstall")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\ProgramData\\chocolatey"))
    }

    /// Parse choco `-r` (limit-output) format: `name|version` per line.
    fn parse_pipe_output(output: &str) -> Vec<(&str, &str)> {
        output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() || !line.contains('|') {
                    return None;
                }
                let mut parts = line.splitn(2, '|');
                let name = parts.next()?.trim();
                let version = parts.next()?.trim();
                if name.is_empty() {
                    return None;
                }
                Some((name, version))
            })
            .collect()
    }

    /// Parse choco outdated `-r` format: `name|current|available|pinned` per line.
    fn parse_outdated_output(output: &str) -> Vec<(&str, &str, &str, bool)> {
        output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line.is_empty() || !line.contains('|') {
                    return None;
                }
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 3 {
                    let name = parts[0].trim();
                    let current = parts[1].trim();
                    let available = parts[2].trim();
                    let pinned = parts.get(3).map(|p| p.trim() == "true").unwrap_or(false);
                    if name.is_empty() || available.is_empty() {
                        return None;
                    }
                    Some((name, current, available, pinned))
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Default for ChocolateyProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ChocolateyProvider {
    fn id(&self) -> &str {
        "chocolatey"
    }
    fn display_name(&self) -> &str {
        "Chocolatey (Windows Package Manager)"
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
        vec![Platform::Windows]
    }
    fn priority(&self) -> i32 {
        88
    }

    async fn is_available(&self) -> bool {
        if process::which("choco").await.is_none() {
            return false;
        }
        match process::execute("choco", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(25).to_string();
        let out = self
            .run_choco(&["search", query, "--limit", &limit, "-r"])
            .await?;

        let parsed = Self::parse_pipe_output(&out);

        Ok(parsed
            .into_iter()
            .map(|(name, version)| PackageSummary {
                name: name.into(),
                description: None,
                latest_version: if version.is_empty() { None } else { Some(version.into()) },
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Use verbose info (non -r) to get all fields in one call
        let out = self.run_choco(&["info", name]).await?;

        let mut version = None;
        let mut description = None;
        let mut summary = None;
        let mut author = None;
        let mut license_url = None;
        let mut tags = None;
        let mut title = None;
        let mut in_description = false;
        let mut desc_lines: Vec<String> = Vec::new();

        for line in out.lines() {
            let trimmed = line.trim();

            // Handle multi-line description
            if in_description {
                if trimmed.is_empty() || trimmed.contains('|') || trimmed.starts_with("Tags:") {
                    in_description = false;
                } else {
                    desc_lines.push(trimmed.to_string());
                    continue;
                }
            }

            // Parse pipe-delimited version line: name|version
            if version.is_none() && trimmed.contains('|') && !trimmed.starts_with(' ') {
                let parts: Vec<&str> = trimmed.split('|').collect();
                if parts.len() >= 2 && parts[0].eq_ignore_ascii_case(name) {
                    version = Some(parts[1].trim().to_string());
                    continue;
                }
            }

            if let Some(v) = trimmed.strip_prefix("Title:") {
                title = Some(v.trim().to_string());
            } else if let Some(v) = trimmed.strip_prefix("Summary:") {
                summary = Some(v.trim().to_string());
            } else if let Some(v) = trimmed.strip_prefix("Description:") {
                let v = v.trim();
                if !v.is_empty() {
                    desc_lines.push(v.to_string());
                }
                in_description = true;
            } else if let Some(v) = trimmed.strip_prefix("Author:") {
                author = Some(v.trim().to_string());
            } else if let Some(v) = trimmed.strip_prefix("Software Author:") {
                if author.is_none() {
                    author = Some(v.trim().to_string());
                }
            } else if let Some(v) = trimmed.strip_prefix("License Url:") {
                license_url = Some(v.trim().to_string());
            } else if let Some(v) = trimmed.strip_prefix("Tags:") {
                tags = Some(v.trim().to_string());
            }
        }

        if !desc_lines.is_empty() {
            description = Some(desc_lines.join(" "));
        } else if summary.is_some() {
            description = summary;
        }

        let display_name = title
            .or_else(|| author.clone().map(|a| format!("{} ({})", name, a)))
            .unwrap_or_else(|| name.to_string());

        let _ = tags; // Tags available but PackageInfo doesn't have a tags field

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(display_name),
            description,
            homepage: Some(format!(
                "https://community.chocolatey.org/packages/{}",
                name
            )),
            license: license_url,
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
        let out = self
            .run_choco(&["search", name, "--exact", "--all-versions", "-r", "--limit", "30"])
            .await?;

        let parsed = Self::parse_pipe_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(pkg_name, _)| pkg_name.eq_ignore_ascii_case(name))
            .map(|(_, version)| VersionInfo {
                version: version.into(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name, "-y"];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }
        if req.force {
            args.push("--force");
        }

        self.run_choco(&args).await?;

        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_choco_dir().join("lib").join(&req.name);

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
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["uninstall", &req.name, "-y"];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }
        if req.force {
            args.push("--force");
        }

        self.run_choco(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_choco(&["list", "-r"]).await?;
        let choco_dir = Self::get_choco_dir();

        let parsed = Self::parse_pipe_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(name, _)| {
                if let Some(ref name_filter) = filter.name_filter {
                    name.to_lowercase().contains(&name_filter.to_lowercase())
                } else {
                    true
                }
            })
            .map(|(name, version)| {
                let install_path = choco_dir.join("lib").join(name);
                InstalledPackage {
                    name: name.into(),
                    version: version.into(),
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                }
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = match self.run_choco(&["outdated", "-r"]).await {
            Ok(o) => o,
            Err(_) => return Ok(vec![]),
        };

        let parsed = Self::parse_outdated_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(name, _current, _available, pinned)| {
                // Skip pinned packages
                if *pinned {
                    return false;
                }
                if packages.is_empty() {
                    true
                } else {
                    packages.iter().any(|p| p.eq_ignore_ascii_case(name))
                }
            })
            .map(|(name, current, available, _)| UpdateInfo {
                name: name.into(),
                current_version: current.into(),
                latest_version: available.into(),
                provider: self.id().into(),
            })
            .collect())
    }
}

#[async_trait]
impl SystemPackageProvider for ChocolateyProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, operation: &str) -> bool {
        matches!(operation, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_choco(&["--version"]).await?;
        Ok(out.trim().into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("choco")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("choco not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "Install Chocolatey: https://chocolatey.org/install (requires admin PowerShell)".into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        // Chocolatey doesn't have a separate index update command
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_choco(&["upgrade", name, "-y"]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_choco(&["upgrade", "all", "-y"]).await?;

        let mut upgraded = Vec::new();
        for line in out.lines() {
            let trimmed = line.trim();
            // Choco outputs "package vX.Y.Z upgraded" or "has been upgraded"
            if trimmed.contains("upgraded") && !trimmed.starts_with("Chocolatey") {
                upgraded.push(trimmed.to_string());
            }
        }
        if upgraded.is_empty() {
            upgraded.push("All packages upgraded".into());
        }
        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        // O(1) lookup using --exact instead of listing all packages
        let out = self.run_choco(&["list", "--exact", name, "-r"]).await;
        Ok(out
            .map(|s| {
                s.lines().any(|l| {
                    l.split('|')
                        .next()
                        .map(|n| n.eq_ignore_ascii_case(name))
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pipe_output() {
        let output = "git|2.42.0\nnotepadplusplus|8.5.8\n";
        let results = ChocolateyProvider::parse_pipe_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "git");
        assert_eq!(results[0].1, "2.42.0");
        assert_eq!(results[1].0, "notepadplusplus");
        assert_eq!(results[1].1, "8.5.8");
    }

    #[test]
    fn test_parse_pipe_output_empty_lines() {
        let output = "\ngit|2.42.0\n\n  \n";
        let results = ChocolateyProvider::parse_pipe_output(output);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "git");
    }

    #[test]
    fn test_parse_outdated_output() {
        let output = "git|2.42.0|2.43.0|false\ncurl|8.4.0|8.5.0|true\n7zip|23.01|23.01|false\n";
        let results = ChocolateyProvider::parse_outdated_output(output);
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].0, "git");
        assert_eq!(results[0].1, "2.42.0");
        assert_eq!(results[0].2, "2.43.0");
        assert!(!results[0].3); // not pinned
        assert_eq!(results[1].0, "curl");
        assert!(results[1].3); // pinned
    }

    #[test]
    fn test_parse_outdated_output_pinned_filtered() {
        let output = "git|2.42.0|2.43.0|false\ncurl|8.4.0|8.5.0|true\n";
        let results = ChocolateyProvider::parse_outdated_output(output);

        // Simulate check_updates filter: skip pinned
        let non_pinned: Vec<_> = results.into_iter().filter(|(_, _, _, pinned)| !pinned).collect();
        assert_eq!(non_pinned.len(), 1);
        assert_eq!(non_pinned[0].0, "git");
    }

    #[test]
    fn test_parse_pipe_output_no_pipe() {
        let output = "Chocolatey v2.3.0\nsome random text\n";
        let results = ChocolateyProvider::parse_pipe_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_capabilities() {
        let provider = ChocolateyProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = ChocolateyProvider::new();
        assert_eq!(provider.id(), "chocolatey");
        assert_eq!(provider.display_name(), "Chocolatey (Windows Package Manager)");
        assert_eq!(provider.priority(), 88);
        assert_eq!(provider.supported_platforms(), vec![Platform::Windows]);
    }

    #[test]
    fn test_requires_elevation() {
        let provider = ChocolateyProvider::new();
        assert!(SystemPackageProvider::requires_elevation(&provider, "install"));
        assert!(SystemPackageProvider::requires_elevation(&provider, "uninstall"));
        assert!(SystemPackageProvider::requires_elevation(&provider, "upgrade"));
        assert!(!SystemPackageProvider::requires_elevation(&provider, "search"));
        assert!(!SystemPackageProvider::requires_elevation(&provider, "list"));
    }

    #[test]
    fn test_get_choco_dir() {
        let dir = ChocolateyProvider::get_choco_dir();
        // Should return a valid path
        assert!(!dir.as_os_str().is_empty());
    }

    #[test]
    fn test_default_impl() {
        let _provider = ChocolateyProvider::default();
    }
}
