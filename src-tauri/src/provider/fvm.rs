use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// FVM - Flutter Version Manager
///
/// Manages Flutter SDK versions using FVM (https://fvm.app).
/// FVM caches SDK versions and allows per-project version pinning via `.fvmrc`.
pub struct FvmProvider {
    cache_dir: Option<PathBuf>,
}

impl FvmProvider {
    pub fn new() -> Self {
        Self {
            cache_dir: Self::detect_cache_dir(),
        }
    }

    fn detect_cache_dir() -> Option<PathBuf> {
        // Check FVM_CACHE_PATH environment variable first
        if let Ok(dir) = std::env::var("FVM_CACHE_PATH") {
            return Some(PathBuf::from(dir));
        }

        // Default locations
        if cfg!(windows) {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("fvm").join("versions"))
                .or_else(|| {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".fvm").join("versions"))
                })
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join("fvm").join("versions"))
                .or_else(|| {
                    std::env::var("XDG_CACHE_HOME")
                        .ok()
                        .map(|p| PathBuf::from(p).join("fvm").join("versions"))
                })
        }
    }

    fn cache_dir(&self) -> CogniaResult<PathBuf> {
        self.cache_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("FVM cache directory not found".into()))
    }

    async fn run_fvm(&self, args: &[&str]) -> CogniaResult<String> {
        self.run_fvm_with_timeout(args, Duration::from_secs(120))
            .await
    }

    async fn run_fvm_long(&self, args: &[&str]) -> CogniaResult<String> {
        self.run_fvm_with_timeout(args, Duration::from_secs(600))
            .await
    }

    async fn run_fvm_with_timeout(&self, args: &[&str], timeout: Duration) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(timeout);
        let output = process::execute("fvm", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn get_fvm_version(&self) -> CogniaResult<String> {
        let output = self.run_fvm(&["--version"]).await?;
        Ok(output.trim().to_string())
    }

    async fn fetch_installed_versions_json(&self) -> CogniaResult<Vec<serde_json::Value>> {
        let output = self.run_fvm(&["api", "list", "-c"]).await?;
        let list: Vec<serde_json::Value> = serde_json::from_str(&output)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse fvm api list: {}", e)))?;
        Ok(list)
    }

    async fn fetch_releases_json(&self) -> CogniaResult<Vec<serde_json::Value>> {
        let output = self.run_fvm(&["api", "releases", "-c"]).await?;
        let releases: Vec<serde_json::Value> = serde_json::from_str(&output)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse fvm api releases: {}", e)))?;
        Ok(releases)
    }
}

impl Default for FvmProvider {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse `.fvmrc` JSON content to extract the Flutter version.
/// Format: `{"flutter": "3.19.0", ...}`
pub fn parse_fvmrc(content: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(content).ok()?;
    json.get("flutter")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Parse legacy `.fvm/fvm_config.json` content.
/// Format: `{"flutterSdkVersion": "3.16.0", ...}`
pub fn parse_fvm_config_json(content: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(content).ok()?;
    json.get("flutterSdkVersion")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[async_trait]
impl Provider for FvmProvider {
    fn id(&self) -> &str {
        "fvm"
    }

    fn display_name(&self) -> &str {
        "FVM (Flutter Version Manager)"
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
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        if process::which("fvm").await.is_none() {
            return false;
        }
        match process::execute("fvm", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let releases = self.fetch_releases_json().await?;

        let results: Vec<PackageSummary> = releases
            .iter()
            .filter_map(|release| {
                let version = release
                    .get("version")
                    .or_else(|| release.get("tag_name"))
                    .and_then(|v| v.as_str())?;
                let version = version.strip_prefix('v').unwrap_or(version);
                if !query.is_empty() && !version.contains(query) {
                    return None;
                }
                Some(PackageSummary {
                    name: format!("flutter@{}", version),
                    description: Some(
                        "Flutter SDK - Google's UI toolkit for mobile, web, and desktop".into(),
                    ),
                    latest_version: Some(version.to_string()),
                    provider: self.id().to_string(),
                })
            })
            .take(20)
            .collect();

        Ok(results)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("flutter@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Flutter SDK {}", version)),
            description: Some(
                "Flutter SDK - Google's UI toolkit for mobile, web, and desktop".into(),
            ),
            homepage: Some("https://flutter.dev".into()),
            license: Some("BSD-3-Clause".into()),
            repository: Some("https://github.com/flutter/flutter".into()),
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
        let releases = self.fetch_releases_json().await?;

        Ok(releases
            .iter()
            .filter_map(|release| {
                let version = release
                    .get("version")
                    .or_else(|| release.get("tag_name"))
                    .and_then(|v| v.as_str())?;
                let version = version.strip_prefix('v').unwrap_or(version);
                let date = release
                    .get("release_date")
                    .or_else(|| release.get("published_at"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                Some(VersionInfo {
                    version: version.to_string(),
                    release_date: date,
                    deprecated: false,
                    yanked: false,
                })
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req.version.as_deref().unwrap_or("stable");

        self.run_fvm_long(&["install", version]).await?;

        let cache_dir = self.cache_dir()?;
        let install_path = cache_dir.join(version);

        Ok(InstallReceipt {
            name: "flutter".to_string(),
            version: version.to_string(),
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let version = req
            .version
            .ok_or_else(|| CogniaError::Provider("Version required for uninstall".into()))?;

        self.run_fvm(&["remove", &version]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let versions = self
            .fetch_installed_versions_json()
            .await
            .unwrap_or_default();
        let cache_dir = self.cache_dir().unwrap_or_default();

        let mut packages = Vec::new();
        for entry in versions {
            let version = entry
                .get("name")
                .or_else(|| entry.get("version"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if version.is_empty() {
                continue;
            }

            let name = format!("flutter@{}", version);
            if let Some(ref name_filter) = filter.name_filter {
                if !name.contains(name_filter) {
                    continue;
                }
            }

            packages.push(InstalledPackage {
                name,
                version: version.clone(),
                provider: self.id().into(),
                install_path: cache_dir.join(&version),
                installed_at: String::new(),
                is_global: true,
            });
        }

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let current = match self.get_current_version().await? {
            Some(v) => v,
            None => return Ok(vec![]),
        };

        let releases = self.fetch_releases_json().await.unwrap_or_default();
        if let Some(latest) = releases.first().and_then(|r| {
            r.get("version")
                .or_else(|| r.get("tag_name"))
                .and_then(|v| v.as_str())
                .map(|s| s.strip_prefix('v').unwrap_or(s).to_string())
        }) {
            if latest != current {
                return Ok(vec![UpdateInfo {
                    name: "flutter".into(),
                    current_version: current,
                    latest_version: latest,
                    provider: self.id().into(),
                }]);
            }
        }

        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for FvmProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let current = self.get_current_version().await?.unwrap_or_default();
        let versions = self
            .fetch_installed_versions_json()
            .await
            .unwrap_or_default();
        let cache_dir = self.cache_dir().unwrap_or_default();

        Ok(versions
            .iter()
            .filter_map(|entry| {
                let version = entry
                    .get("name")
                    .or_else(|| entry.get("version"))
                    .and_then(|v| v.as_str())?
                    .to_string();

                if version.is_empty() {
                    return None;
                }

                Some(InstalledVersion {
                    version: version.clone(),
                    install_path: cache_dir.join(&version),
                    size: entry.get("size").and_then(|v| v.as_u64()),
                    installed_at: None,
                    is_current: version == current,
                })
            })
            .collect())
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        // Try reading .fvmrc in current directory
        let cwd = std::env::current_dir().unwrap_or_default();
        let fvmrc = cwd.join(".fvmrc");
        if fvmrc.exists() {
            if let Ok(content) = crate::platform::fs::read_file_string(&fvmrc).await {
                if let Some(version) = parse_fvmrc(&content) {
                    return Ok(Some(version));
                }
            }
        }

        // Try fvm api context
        if let Ok(output) = self.run_fvm(&["api", "context", "-c"]).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                if let Some(version) = json
                    .get("flutterVersion")
                    .or_else(|| json.get("flutter"))
                    .and_then(|v| v.as_str())
                {
                    return Ok(Some(version.to_string()));
                }
            }
        }

        Ok(None)
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_fvm(&["global", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        opts.cwd = Some(project_path.to_string_lossy().to_string());
        let output =
            process::execute("fvm", &["use", version, "--skip-pub-get"], Some(opts)).await?;
        if output.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();
        loop {
            // 1. Check .fvmrc (highest priority for FVM)
            let fvmrc = current.join(".fvmrc");
            if fvmrc.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&fvmrc).await {
                    if let Some(version) = parse_fvmrc(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(fvmrc),
                        }));
                    }
                }
            }

            // 2. Check legacy .fvm/fvm_config.json
            let fvm_config = current.join(".fvm").join("fvm_config.json");
            if fvm_config.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&fvm_config).await {
                    if let Some(version) = parse_fvm_config_json(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(fvm_config),
                        }));
                    }
                }
            }

            // 3. Check .dart-version
            let dart_version = current.join(".dart-version");
            if dart_version.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&dart_version).await {
                    let version = content.trim().to_string();
                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(dart_version),
                        }));
                    }
                }
            }

            // 4. Check .tool-versions (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("dart ") || line.starts_with("flutter ") {
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            if parts.len() >= 2 {
                                return Ok(Some(VersionDetection {
                                    version: parts[1].to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 5. Fall back to current version
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let cache_dir = self.cache_dir()?;
        let bin_path = cache_dir.join(version).join("bin");
        Ok(EnvModifications::new().prepend_path(bin_path))
    }

    fn version_file_name(&self) -> &str {
        ".fvmrc"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl SystemPackageProvider for FvmProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        self.get_fvm_version().await
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("fvm")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("fvm not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        if cfg!(windows) {
            Some("dart pub global activate fvm".into())
        } else if cfg!(target_os = "macos") {
            Some("brew tap leoafarias/fvm && brew install fvm".into())
        } else {
            Some("dart pub global activate fvm".into())
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.list_installed_versions().await?;
        Ok(versions.iter().any(|v| v.version == name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_fvmrc() {
        let content = r#"{"flutter": "3.19.0"}"#;
        assert_eq!(parse_fvmrc(content), Some("3.19.0".to_string()));
    }

    #[test]
    fn test_parse_fvmrc_with_extras() {
        let content = r#"{
            "flutter": "3.16.0",
            "flavors": {
                "development": "beta",
                "production": "3.16.0"
            },
            "updateVscodeSettings": true
        }"#;
        assert_eq!(parse_fvmrc(content), Some("3.16.0".to_string()));
    }

    #[test]
    fn test_parse_fvmrc_channel() {
        let content = r#"{"flutter": "stable"}"#;
        assert_eq!(parse_fvmrc(content), Some("stable".to_string()));
    }

    #[test]
    fn test_parse_fvmrc_invalid() {
        assert_eq!(parse_fvmrc("not json"), None);
        assert_eq!(parse_fvmrc("{}"), None);
        assert_eq!(parse_fvmrc(r#"{"other": "key"}"#), None);
    }

    #[test]
    fn test_parse_fvm_config_json() {
        let content = r#"{"flutterSdkVersion": "3.16.0", "cachePath": ".fvm/flutter_sdk"}"#;
        assert_eq!(parse_fvm_config_json(content), Some("3.16.0".to_string()));
    }

    #[test]
    fn test_parse_fvm_config_json_invalid() {
        assert_eq!(parse_fvm_config_json("not json"), None);
        assert_eq!(parse_fvm_config_json("{}"), None);
    }

    #[test]
    fn test_parse_fvmrc_empty_flutter_value() {
        assert_eq!(parse_fvmrc(r#"{"flutter": ""}"#), Some("".to_string()));
    }

    #[test]
    fn test_parse_fvmrc_whitespace_value() {
        // Whitespace-only values are preserved (caller's responsibility to trim)
        assert_eq!(
            parse_fvmrc(r#"{"flutter": "  3.19.0  "}"#),
            Some("  3.19.0  ".to_string())
        );
    }

    #[test]
    fn test_parse_fvmrc_null_flutter() {
        assert_eq!(parse_fvmrc(r#"{"flutter": null}"#), None);
    }

    #[test]
    fn test_parse_fvmrc_numeric_flutter() {
        // flutter value should be a string; numeric values are ignored
        assert_eq!(parse_fvmrc(r#"{"flutter": 3}"#), None);
    }

    #[test]
    fn test_parse_fvm_config_json_with_extra_fields() {
        let content = r#"{
            "flutterSdkVersion": "3.22.0",
            "cachePath": ".fvm/flutter_sdk",
            "flavors": {}
        }"#;
        assert_eq!(parse_fvm_config_json(content), Some("3.22.0".to_string()));
    }

    #[test]
    fn test_parse_fvm_config_json_null_version() {
        assert_eq!(
            parse_fvm_config_json(r#"{"flutterSdkVersion": null}"#),
            None
        );
    }

    #[test]
    fn test_provider_id_and_display_name() {
        let provider = FvmProvider::new();
        assert_eq!(provider.id(), "fvm");
        assert_eq!(provider.display_name(), "FVM (Flutter Version Manager)");
    }

    #[test]
    fn test_provider_capabilities() {
        let provider = FvmProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
    }

    #[test]
    fn test_provider_supported_platforms() {
        let provider = FvmProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_provider_priority() {
        let provider = FvmProvider::new();
        assert_eq!(provider.priority(), 80);
    }

    #[test]
    fn test_version_file_name() {
        let provider = FvmProvider::new();
        assert_eq!(provider.version_file_name(), ".fvmrc");
    }

    #[test]
    fn test_get_env_modifications_prepends_bin_path() {
        let provider = FvmProvider {
            cache_dir: Some(PathBuf::from("/tmp/fvm/versions")),
        };
        let mods = provider.get_env_modifications("3.19.0").unwrap();
        let expected = PathBuf::from("/tmp/fvm/versions/3.19.0/bin");
        assert!(
            mods.path_prepend.contains(&expected),
            "Expected {:?} in path_prepend {:?}",
            expected,
            mods.path_prepend
        );
    }

    #[test]
    fn test_cache_dir_returns_error_when_none() {
        let provider = FvmProvider { cache_dir: None };
        let result = provider.cache_dir();
        assert!(result.is_err());
    }

    #[test]
    fn test_get_install_instructions() {
        let provider = FvmProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some());
        let text = instructions.unwrap();
        assert!(
            text.contains("fvm"),
            "Expected fvm in instructions: {}",
            text
        );
    }

    #[test]
    fn test_requires_elevation_is_false() {
        let provider = FvmProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }

    #[test]
    fn test_default_creates_provider() {
        let provider = FvmProvider::default();
        assert_eq!(provider.id(), "fvm");
    }
}
