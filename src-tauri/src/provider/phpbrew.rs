use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    fs,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// PHPBrew - PHP Version Manager
///
/// PHPBrew is a tool to build and install multiple versions of PHP on your system.
/// It supports .php-version file for project-local version pinning.
pub struct PhpbrewProvider {
    phpbrew_root: Option<PathBuf>,
}

impl PhpbrewProvider {
    pub fn new() -> Self {
        Self {
            phpbrew_root: Self::detect_phpbrew_root(),
        }
    }

    fn detect_phpbrew_root() -> Option<PathBuf> {
        // Check PHPBREW_ROOT environment variable first
        if let Ok(root) = std::env::var("PHPBREW_ROOT") {
            return Some(PathBuf::from(root));
        }

        // Default location
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join(".phpbrew"))
    }

    fn phpbrew_root(&self) -> CogniaResult<PathBuf> {
        self.phpbrew_root
            .clone()
            .ok_or_else(|| CogniaError::Provider("PHPBREW_ROOT not found".into()))
    }

    async fn run_phpbrew(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(600)); // PHP compilation can take a while
        let output = process::execute("phpbrew", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    fn parse_phpbrew_list(output: &str) -> Vec<InstalledVersion> {
        let mut versions = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Format varies: "php-x.x.x" or "* php-x.x.x (current)"
            let is_current = line.starts_with('*');
            let version_part = line
                .trim_start_matches('*')
                .split_whitespace()
                .next()
                .unwrap_or("");

            if let Some(version) = version_part.strip_prefix("php-") {
                // PHPBrew installs PHP versions in ~/.phpbrew/php/php-x.x.x
                let install_path = Self::detect_phpbrew_root()
                    .map(|root| root.join("php").join(format!("php-{}", version)))
                    .unwrap_or_default();

                versions.push(InstalledVersion {
                    version: version.to_string(),
                    install_path,
                    size: None,
                    installed_at: None,
                    is_current,
                });
            }
        }

        versions
    }

    async fn read_php_version_file(path: &Path) -> Option<String> {
        let version_file = path.join(".php-version");
        if let Ok(content) = fs::read_file_string(&version_file).await {
            let version = content.trim().to_string();
            if !version.is_empty() {
                return Some(version);
            }
        }
        None
    }

    async fn write_php_version_file(path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = path.join(".php-version");
        fs::write_file(&version_file, version.as_bytes()).await?;
        Ok(())
    }
}

impl Default for PhpbrewProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PhpbrewProvider {
    fn id(&self) -> &str {
        "phpbrew"
    }

    fn display_name(&self) -> &str {
        "PHPBrew (PHP Version Manager)"
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
        vec![Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        if process::which("phpbrew").await.is_none() {
            return false;
        }
        // Verify phpbrew actually works
        match process::execute("phpbrew", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // List available PHP versions
        let output = self.run_phpbrew(&["known"]).await?;

        let versions: Vec<PackageSummary> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                // Lines that start with numbers are version lines
                if line
                    .chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
                {
                    // Parse version numbers from the line
                    let versions: Vec<&str> = line.split_whitespace().collect();
                    Some(versions)
                } else {
                    None
                }
            })
            .flatten()
            .filter(|v| v.contains(query) || query.is_empty())
            .take(20)
            .map(|version| PackageSummary {
                name: format!("php@{}", version),
                description: Some("PHP programming language".into()),
                latest_version: Some(version.to_string()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(versions)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("php@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("PHP {}", version)),
            description: Some("PHP: Hypertext Preprocessor".into()),
            homepage: Some("https://www.php.net".into()),
            license: Some("PHP License".into()),
            repository: Some("https://github.com/php/php-src".into()),
            versions: vec![VersionInfo {
                version: version.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self.run_phpbrew(&["known"]).await?;

        let versions: Vec<VersionInfo> = output
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if line
                    .chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
                {
                    Some(line.split_whitespace().collect::<Vec<_>>())
                } else {
                    None
                }
            })
            .flatten()
            .map(|v| VersionInfo {
                version: v.to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req
            .name
            .strip_prefix("php@")
            .unwrap_or(&req.name)
            .to_string();

        // PHPBrew install command
        self.run_phpbrew(&["install", &version, "+default"]).await?;

        let install_path = self
            .phpbrew_root()
            .map(|r| r.join("php").join(format!("php-{}", version)))
            .unwrap_or_default();

        Ok(InstallReceipt {
            name: req.name,
            version: version.clone(),
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req.name.strip_prefix("php@").unwrap_or(&req.name);

        self.run_phpbrew(&["remove", version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_phpbrew(&["list"]).await?;
        let versions = Self::parse_phpbrew_list(&output);

        let mut packages: Vec<InstalledPackage> = versions
            .into_iter()
            .map(|v| InstalledPackage {
                name: format!("php@{}", v.version),
                version: v.version,
                provider: self.id().into(),
                install_path: v.install_path,
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        if let Some(ref name_filter) = filter.name_filter {
            packages.retain(|p| p.name.contains(name_filter) || p.version.contains(name_filter));
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // PHPBrew doesn't have a built-in update check
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for PhpbrewProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_phpbrew(&["list"]).await?;
        Ok(Self::parse_phpbrew_list(&output))
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        // Check phpbrew current or use php -v
        if let Ok(output) = self.run_phpbrew(&["current"]).await {
            let current = output.trim();
            if !current.is_empty() && current != "none" {
                return Ok(Some(
                    current.strip_prefix("php-").unwrap_or(current).to_string(),
                ));
            }
        }

        // Fallback to php -v
        if let Ok(output) = process::execute("php", &["-v"], None).await {
            if output.success {
                // Parse "PHP x.x.x" from output
                if let Some(line) = output.stdout.lines().next() {
                    if let Some(version) = line.split_whitespace().nth(1) {
                        return Ok(Some(version.to_string()));
                    }
                }
            }
        }

        Ok(None)
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_phpbrew(&["switch", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        Self::write_php_version_file(project_path, version).await
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // Check .php-version in current and parent directories
        let mut current = start_path.to_path_buf();

        loop {
            if let Some(version) = Self::read_php_version_file(&current).await {
                return Ok(Some(VersionDetection {
                    version,
                    source: VersionSource::LocalFile,
                    source_path: Some(current.join(".php-version")),
                }));
            }

            // Check composer.json for PHP version requirement
            let composer_json = current.join("composer.json");
            if let Ok(content) = fs::read_file_string(&composer_json).await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(php_req) = json
                        .get("require")
                        .and_then(|r| r.get("php"))
                        .and_then(|v| v.as_str())
                    {
                        // Extract version from requirement like ">=8.0" or "^8.1"
                        let version = php_req
                            .trim_start_matches(|c: char| !c.is_ascii_digit())
                            .split(|c: char| !c.is_ascii_digit() && c != '.')
                            .next()
                            .unwrap_or("");

                        if !version.is_empty() {
                            return Ok(Some(VersionDetection {
                                version: version.to_string(),
                                source: VersionSource::Manifest,
                                source_path: Some(composer_json),
                            }));
                        }
                    }
                }
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

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let phpbrew_root = self.phpbrew_root()?;
        let php_path = phpbrew_root.join("php").join(format!("php-{}", version));
        let bin_path = php_path.join("bin");

        let mut set_variables = std::collections::HashMap::new();
        set_variables.insert("PHPBREW_PHP".to_string(), format!("php-{}", version));
        set_variables.insert(
            "PHPBREW_PATH".to_string(),
            php_path.to_string_lossy().into_owned(),
        );

        Ok(EnvModifications {
            path_prepend: vec![bin_path],
            path_append: vec![],
            set_variables,
            unset_variables: vec![],
        })
    }

    fn version_file_name(&self) -> &str {
        ".php-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl SystemPackageProvider for PhpbrewProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_phpbrew(&["--version"]).await?;
        // Output: "phpbrew - x.x.x"
        let version = output
            .lines()
            .next()
            .and_then(|l| l.split('-').next_back())
            .map(|v| v.trim())
            .unwrap_or(output.trim());
        Ok(version.to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("phpbrew")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("phpbrew not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install PHPBrew: curl -L -O https://github.com/phpbrew/phpbrew/releases/latest/download/phpbrew.phar && chmod +x phpbrew.phar && sudo mv phpbrew.phar /usr/local/bin/phpbrew && phpbrew init".into())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let version = name.strip_prefix("php@").unwrap_or(name);
        let output = self.run_phpbrew(&["list"]).await;
        Ok(output.map(|s| s.contains(version)).unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_phpbrew_provider_creation() {
        let provider = PhpbrewProvider::new();
        assert_eq!(provider.id(), "phpbrew");
        assert_eq!(provider.display_name(), "PHPBrew (PHP Version Manager)");
    }

    #[test]
    fn test_capabilities() {
        let provider = PhpbrewProvider::new();
        let caps = provider.capabilities();

        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_parse_phpbrew_list() {
        let output = r#"
  php-7.4.33
* php-8.1.27
  php-8.2.14
  php-8.3.1
"#;

        let versions = PhpbrewProvider::parse_phpbrew_list(output);

        assert_eq!(versions.len(), 4);
        assert_eq!(versions[0].version, "7.4.33");
        assert!(!versions[0].is_current);
        assert_eq!(versions[1].version, "8.1.27");
        assert!(versions[1].is_current);
        assert_eq!(versions[3].version, "8.3.1");
    }

    #[test]
    fn test_supported_platforms() {
        let provider = PhpbrewProvider::new();
        let platforms = provider.supported_platforms();

        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        // PHPBrew doesn't support Windows
        assert!(!platforms.contains(&Platform::Windows));
    }

    #[test]
    fn test_version_file_name() {
        let provider = PhpbrewProvider::new();
        assert_eq!(provider.version_file_name(), ".php-version");
    }

    #[test]
    fn test_priority() {
        let provider = PhpbrewProvider::new();
        assert_eq!(provider.priority(), 80);
    }
}
