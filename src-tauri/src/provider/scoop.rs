use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct ScoopProvider;

impl ScoopProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a scoop command with a generous timeout.
    async fn run_scoop(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = process::ProcessOptions::new().with_timeout(Duration::from_secs(120));

        let out = process::execute("scoop", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            let msg = if out.stderr.trim().is_empty() {
                out.stdout
            } else {
                out.stderr
            };
            Err(CogniaError::Provider(msg))
        }
    }

    /// Get the installed version of a package using `scoop info`.
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_scoop(&["info", name]).await?;
        // "Installed:" field shows actual local version; "Version:" shows latest available
        let mut latest_version = None;
        for line in out.lines() {
            let line = line.trim();
            if let Some(installed) = line.strip_prefix("Installed:") {
                let installed = installed.trim();
                if !installed.is_empty() && installed != "No" {
                    return Ok(installed.to_string());
                }
            }
            if let Some(version) = line.strip_prefix("Version:") {
                latest_version = Some(version.trim().to_string());
            }
        }
        // Fallback to Version: if Installed: field missing
        latest_version
            .ok_or_else(|| CogniaError::Provider(format!("Version not found for {}", name)))
    }

    fn get_scoop_dir() -> Option<PathBuf> {
        std::env::var("SCOOP").ok().map(PathBuf::from).or_else(|| {
            std::env::var("USERPROFILE")
                .ok()
                .map(|h| PathBuf::from(h).join("scoop"))
        })
    }

    /// Parse scoop search output, handling both old format ('name' (version) [bucket])
    /// and newer tabular format (Name  Version  Source  Binaries).
    fn parse_search_output(output: &str) -> Vec<(String, Option<String>)> {
        let mut results = Vec::new();
        let mut in_table = false;
        let mut separator_seen = false;

        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("Results") {
                continue;
            }

            // Detect table separator (---- ---- ----)
            if !separator_seen
                && trimmed.chars().all(|c| c == '-' || c == ' ')
                && trimmed.contains('-')
            {
                separator_seen = true;
                in_table = true;
                continue;
            }

            // Skip table header ("Name  Version  Source  Binaries")
            if !separator_seen && (trimmed.starts_with("Name") && trimmed.contains("Source")) {
                continue;
            }

            if in_table {
                // Tabular format: first column is name, second is version
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if !parts.is_empty() {
                    let name = parts[0].to_string();
                    let version = parts.get(1).map(|v| v.to_string());
                    results.push((name, version));
                }
            } else if trimmed.contains('\'') {
                // Old format: 'name' (version) [bucket]
                if let Some(name_start) = trimmed.find('\'') {
                    if let Some(name_end) = trimmed[name_start + 1..].find('\'') {
                        let name = &trimmed[name_start + 1..name_start + 1 + name_end];
                        let version = trimmed.find('(').and_then(|start| {
                            trimmed
                                .find(')')
                                .map(|end| trimmed[start + 1..end].to_string())
                        });
                        results.push((name.to_string(), version));
                    }
                }
            } else {
                // Fallback: treat as whitespace-separated
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if !parts.is_empty() && !parts[0].starts_with('-') {
                    let name = parts[0].to_string();
                    let version = parts.get(1).map(|v| v.to_string());
                    results.push((name, version));
                }
            }
        }

        results
    }

    /// Parse scoop list output (tabular: Name Version Source Updated Info).
    fn parse_list_output(output: &str) -> Vec<(String, String, Option<String>)> {
        let mut results = Vec::new();
        let mut separator_seen = false;

        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Detect separator line
            if !separator_seen {
                if trimmed.chars().all(|c| c == '-' || c == ' ') && trimmed.contains('-') {
                    separator_seen = true;
                    continue;
                }
                // Skip headers and preamble
                if trimmed.starts_with("Installed") || trimmed.starts_with("Name") {
                    continue;
                }
            }

            if separator_seen || !trimmed.starts_with('-') {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.is_empty() {
                    continue;
                }
                let name = parts[0].to_string();
                let version = parts.get(1).unwrap_or(&"").to_string();
                let source = parts.get(2).map(|s| s.to_string());
                results.push((name, version, source));
            }
        }

        results
    }

    /// Parse scoop status output (tabular: Name Installed Version Latest Version Missing Dependencies Info).
    fn parse_status_output(output: &str) -> Vec<(String, String, String)> {
        let mut results = Vec::new();
        let mut separator_seen = false;

        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if !separator_seen {
                if trimmed.chars().all(|c| c == '-' || c == ' ') && trimmed.contains('-') {
                    separator_seen = true;
                    continue;
                }
                // Skip header
                if trimmed.starts_with("Name") {
                    continue;
                }
            }

            if separator_seen {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 3 {
                    results.push((
                        parts[0].to_string(),
                        parts[1].to_string(),
                        parts[2].to_string(),
                    ));
                }
            }
        }

        results
    }
}

impl Default for ScoopProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ScoopProvider {
    fn id(&self) -> &str {
        "scoop"
    }
    fn display_name(&self) -> &str {
        "Scoop (Windows Package Manager)"
    }
    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
            Capability::UpdateIndex,
        ])
    }
    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows]
    }
    fn priority(&self) -> i32 {
        85
    }

    async fn is_available(&self) -> bool {
        if process::which("scoop").await.is_none() {
            return false;
        }
        match process::execute("scoop", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_scoop(&["search", query]).await?;
        let limit = options.limit.unwrap_or(25);

        let parsed = Self::parse_search_output(&out);

        Ok(parsed
            .into_iter()
            .take(limit)
            .map(|(name, version)| PackageSummary {
                name,
                description: None,
                latest_version: version,
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_scoop(&["info", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut homepage = None;
        let mut license = None;
        let mut bucket = None;
        let mut manifest = None;

        for line in out.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("Description:") {
                description = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Website:") {
                homepage = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("License:") {
                license = Some(stripped.trim().into());
            } else if let Some(stripped) = line.strip_prefix("Bucket:") {
                bucket = Some(stripped.trim().to_string());
            } else if let Some(stripped) = line.strip_prefix("Manifest:") {
                manifest = Some(stripped.trim().to_string());
            }
        }

        // Use manifest path as repository hint
        let repository =
            manifest.or_else(|| bucket.map(|b| format!("https://github.com/ScoopInstaller/{}", b)));

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
            license,
            repository,
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
        // Scoop doesn't have a direct versions command; info only shows latest
        let out = self.run_scoop(&["info", name]).await?;

        for line in out.lines() {
            if let Some(stripped) = line.trim().strip_prefix("Version:") {
                let version = stripped.trim().to_string();
                if !version.is_empty() {
                    return Ok(vec![VersionInfo {
                        version,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]);
                }
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        let mut args = vec!["install", &*pkg];
        if req.force {
            args.push("--force");
        }

        self.run_scoop(&args).await?;

        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_scoop_dir()
            .map(|p| p.join("apps").join(&req.name).join("current"))
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
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["uninstall", &*req.name];
        if req.force {
            args.push("--force");
        }
        // --purge removes persisted data
        if req.force {
            args.push("--purge");
        }

        self.run_scoop(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_scoop(&["list"]).await?;
        let scoop_dir = Self::get_scoop_dir().unwrap_or_default();

        let parsed = Self::parse_list_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(name, _, _)| {
                if let Some(ref name_filter) = filter.name_filter {
                    name.contains(name_filter)
                } else {
                    true
                }
            })
            .map(|(name, version, _source)| {
                let install_path = scoop_dir.join("apps").join(&name).join("current");
                InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: false,
                }
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = match self.run_scoop(&["status"]).await {
            Ok(o) => o,
            Err(_) => return Ok(vec![]),
        };

        let parsed = Self::parse_status_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(name, current, latest)| {
                if packages.is_empty() || packages.contains(name) {
                    current != latest
                } else {
                    false
                }
            })
            .map(|(name, current, latest)| UpdateInfo {
                name,
                current_version: current,
                latest_version: latest,
                provider: self.id().into(),
            })
            .collect())
    }
}

#[async_trait]
impl SystemPackageProvider for ScoopProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false // Scoop is user-space, no admin required
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_scoop(&["--version"]).await?;
        // Output may contain multiple lines; look for version string
        for line in out.lines() {
            let trimmed = line.trim();
            // "Scoop (v0.5.3)" or just version number
            if let Some(v_pos) = trimmed.find('v') {
                let rest = &trimmed[v_pos + 1..];
                let version: String = rest
                    .chars()
                    .take_while(|c| c.is_ascii_digit() || *c == '.')
                    .collect();
                if !version.is_empty() {
                    return Ok(version);
                }
            }
            // Plain version line like "0.5.3"
            if trimmed
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
            {
                return Ok(trimmed.to_string());
            }
        }
        // Fallback: return first non-empty line
        Ok(out.lines().next().unwrap_or("").trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("scoop")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("scoop not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Scoop: irm get.scoop.sh | iex (PowerShell)".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_scoop(&["update"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_scoop(&["update", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = self.run_scoop(&["update", "*"]).await?;

        let mut upgraded = Vec::new();
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("was updated") || trimmed.contains("was installed") {
                upgraded.push(trimmed.to_string());
            }
        }
        if upgraded.is_empty() {
            upgraded.push("All packages upgraded".into());
        }
        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        // Use scoop info for O(1) check instead of listing all packages
        match self.run_scoop(&["info", name]).await {
            Ok(output) => {
                for line in output.lines() {
                    let trimmed = line.trim();
                    if let Some(installed) = trimmed.strip_prefix("Installed:") {
                        let installed = installed.trim();
                        return Ok(!installed.is_empty() && installed != "No");
                    }
                }
                Ok(false)
            }
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_search_output_old_format() {
        let output = "Results from local buckets...\n\n'git' (2.42.0) [main bucket]\n'git-lfs' (3.4.0) [main bucket]\n";
        let results = ScoopProvider::parse_search_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "git");
        assert_eq!(results[0].1, Some("2.42.0".to_string()));
        assert_eq!(results[1].0, "git-lfs");
    }

    #[test]
    fn test_parse_search_output_table_format() {
        let output = "Results from local buckets...\n\nName      Version Source Binaries\n----      ------- ------ --------\n7zip      23.01   main\ngit       2.42.0  main   git.exe\n";
        let results = ScoopProvider::parse_search_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "7zip");
        assert_eq!(results[0].1, Some("23.01".to_string()));
        assert_eq!(results[1].0, "git");
        assert_eq!(results[1].1, Some("2.42.0".to_string()));
    }

    #[test]
    fn test_parse_list_output() {
        let output = "Installed apps:\n\nName      Version Source Updated             Info\n----      ------- ------ -------             ----\n7zip      23.01   main   2024-01-15 10:30:00\ngit       2.42.0  main   2024-01-10 08:20:00\n";
        let results = ScoopProvider::parse_list_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "7zip");
        assert_eq!(results[0].1, "23.01");
        assert_eq!(results[0].2, Some("main".to_string()));
    }

    #[test]
    fn test_parse_status_output() {
        let output = "Name      Installed Version Latest Version Missing Dependencies Info\n----      --------- -------------- -------------------- ----\ngit       2.42.0          2.43.0\ncurl      8.4.0           8.5.0\n";
        let results = ScoopProvider::parse_status_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "git");
        assert_eq!(results[0].1, "2.42.0");
        assert_eq!(results[0].2, "2.43.0");
    }

    #[test]
    fn test_parse_search_output_empty() {
        let output = "";
        let results = ScoopProvider::parse_search_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_capabilities() {
        let provider = ScoopProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::UpdateIndex));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = ScoopProvider::new();
        assert_eq!(provider.id(), "scoop");
        assert_eq!(provider.display_name(), "Scoop (Windows Package Manager)");
        assert_eq!(provider.priority(), 85);
        assert_eq!(provider.supported_platforms(), vec![Platform::Windows]);
    }

    #[test]
    fn test_requires_elevation() {
        let provider = ScoopProvider::new();
        assert!(!SystemPackageProvider::requires_elevation(
            &provider, "install"
        ));
        assert!(!SystemPackageProvider::requires_elevation(
            &provider,
            "uninstall"
        ));
        assert!(!SystemPackageProvider::requires_elevation(
            &provider, "upgrade"
        ));
    }

    #[test]
    fn test_get_scoop_dir() {
        // Should return Some even without SCOOP env var if USERPROFILE is set
        let dir = ScoopProvider::get_scoop_dir();
        // On Windows CI, USERPROFILE should be set
        // We just verify it doesn't panic
        let _ = dir;
    }

    #[test]
    fn test_default_impl() {
        let _provider = ScoopProvider::default();
    }
}
