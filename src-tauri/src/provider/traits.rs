use crate::error::CogniaResult;
use crate::resolver::Dependency;
use crate::platform::env::{Architecture, EnvModifications, Platform};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Install,
    Uninstall,
    Update,
    Upgrade,
    Search,
    List,
    LockVersion,
    Rollback,
    VersionSwitch,
    MultiVersion,
    ProjectLocal,
    UpdateIndex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageSummary {
    pub name: String,
    pub description: Option<String>,
    pub latest_version: Option<String>,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub repository: Option<String>,
    pub versions: Vec<VersionInfo>,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: Option<String>,
    pub deprecated: bool,
    pub yanked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPackage {
    pub name: String,
    pub version: String,
    pub provider: String,
    pub install_path: PathBuf,
    pub installed_at: String,
    pub is_global: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRequest {
    pub name: String,
    pub version: Option<String>,
    pub global: bool,
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallReceipt {
    pub name: String,
    pub version: String,
    pub provider: String,
    pub install_path: PathBuf,
    pub files: Vec<PathBuf>,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UninstallRequest {
    pub name: String,
    pub version: Option<String>,
    pub force: bool,
}

#[derive(Debug, Clone, Default)]
pub struct SearchOptions {
    pub limit: Option<usize>,
    pub page: Option<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct InstalledFilter {
    pub global_only: bool,
    pub name_filter: Option<String>,
}

#[async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    fn capabilities(&self) -> HashSet<Capability>;
    fn supported_platforms(&self) -> Vec<Platform>;
    fn priority(&self) -> i32 {
        0
    }

    async fn is_available(&self) -> bool;

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>>;

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo>;

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>>;

    async fn get_dependencies(&self, _name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        Ok(vec![])
    }

    async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt>;

    async fn uninstall(&self, request: UninstallRequest) -> CogniaResult<()>;

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>>;

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub id: String,
    pub display_name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub executable_path: Option<PathBuf>,
    pub install_instructions: Option<String>,
    pub platforms: Vec<Platform>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledVersion {
    pub version: String,
    pub install_path: PathBuf,
    pub size: Option<u64>,
    pub installed_at: Option<String>,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDetection {
    pub version: String,
    pub source: VersionSource,
    pub source_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VersionSource {
    LocalFile,
    Manifest,
    GlobalFile,
    SystemDefault,
    SystemExecutable,
}

/// Helper functions for detecting system-installed versions directly from executables
pub mod system_detection {
    use crate::error::CogniaResult;
    use crate::platform::process;
    use regex::Regex;

    /// Detect version from a system executable using --version flag
    pub async fn detect_from_executable(
        cmd: &str,
        version_args: &[&str],
        version_pattern: Option<&str>,
    ) -> CogniaResult<Option<String>> {
        // Check if executable exists
        if process::which(cmd).await.is_none() {
            return Ok(None);
        }

        // Run version command
        let output = process::execute(cmd, version_args, None).await?;
        if !output.success {
            return Ok(None);
        }

        let output_text = if output.stdout.is_empty() {
            &output.stderr
        } else {
            &output.stdout
        };

        // Extract version using pattern or default
        let pattern = version_pattern.unwrap_or(r"(\d+\.\d+(?:\.\d+)?)");
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(output_text) {
                if let Some(version) = caps.get(1) {
                    return Ok(Some(version.as_str().to_string()));
                }
            }
        }

        Ok(None)
    }

    /// Common version detection configurations
    pub struct VersionDetector {
        pub cmd: &'static str,
        pub args: &'static [&'static str],
        pub pattern: Option<&'static str>,
    }

    /// Predefined detectors for common languages
    pub const NODE_DETECTOR: VersionDetector = VersionDetector {
        cmd: "node",
        args: &["--version"],
        pattern: Some(r"v?(\d+\.\d+\.\d+)"),
    };

    pub const PYTHON_DETECTOR: VersionDetector = VersionDetector {
        cmd: "python3",
        args: &["--version"],
        pattern: Some(r"Python (\d+\.\d+\.\d+)"),
    };

    pub const GO_DETECTOR: VersionDetector = VersionDetector {
        cmd: "go",
        args: &["version"],
        pattern: Some(r"go(\d+\.\d+(?:\.\d+)?)"),
    };

    pub const RUST_DETECTOR: VersionDetector = VersionDetector {
        cmd: "rustc",
        args: &["--version"],
        pattern: Some(r"rustc (\d+\.\d+\.\d+)"),
    };

    pub const RUBY_DETECTOR: VersionDetector = VersionDetector {
        cmd: "ruby",
        args: &["--version"],
        pattern: Some(r"ruby (\d+\.\d+\.\d+)"),
    };

    pub const JAVA_DETECTOR: VersionDetector = VersionDetector {
        cmd: "java",
        args: &["-version"],
        pattern: Some(r#"version "(\d+(?:\.\d+)*)"#),
    };

    impl VersionDetector {
        pub async fn detect(&self) -> CogniaResult<Option<String>> {
            detect_from_executable(self.cmd, self.args, self.pattern).await
        }
    }
}

#[async_trait]
pub trait EnvironmentProvider: Provider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>>;

    async fn get_current_version(&self) -> CogniaResult<Option<String>>;

    async fn set_global_version(&self, version: &str) -> CogniaResult<()>;

    async fn set_local_version(
        &self,
        project_path: &std::path::Path,
        version: &str,
    ) -> CogniaResult<()>;

    async fn detect_version(
        &self,
        start_path: &std::path::Path,
    ) -> CogniaResult<Option<VersionDetection>>;

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications>;

    fn version_file_name(&self) -> &str;
}

#[async_trait]
pub trait SystemPackageProvider: Provider {
    async fn check_system_requirements(&self) -> CogniaResult<bool>;

    fn requires_elevation(&self, operation: &str) -> bool;

    async fn get_provider_status(&self) -> ProviderStatus {
        let installed = self.is_available().await;
        let (version, executable_path) = if installed {
            (
                self.get_version().await.ok(),
                self.get_executable_path().await.ok(),
            )
        } else {
            (None, None)
        };

        ProviderStatus {
            id: self.id().to_string(),
            display_name: self.display_name().to_string(),
            installed,
            version,
            executable_path,
            install_instructions: self.get_install_instructions(),
            platforms: self.supported_platforms(),
        }
    }

    async fn get_version(&self) -> CogniaResult<String> {
        Err(crate::error::CogniaError::Provider(
            "Version check not implemented".into(),
        ))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        Err(crate::error::CogniaError::Provider(
            "Executable path not available".into(),
        ))
    }

    fn get_install_instructions(&self) -> Option<String> {
        None
    }

    async fn update_index(&self) -> CogniaResult<()> {
        Err(crate::error::CogniaError::Provider(
            "Index update not supported".into(),
        ))
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        Err(crate::error::CogniaError::Provider(format!(
            "Upgrade not supported for {}",
            name
        )))
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        Err(crate::error::CogniaError::Provider(
            "Upgrade all not supported".into(),
        ))
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool>;
}

#[async_trait]
pub trait CustomSourceProvider: Provider {
    async fn fetch_releases(&self, source: &str) -> CogniaResult<Vec<ReleaseInfo>>;

    async fn resolve_artifact(
        &self,
        release: &ReleaseInfo,
        platform: Platform,
        arch: Architecture,
    ) -> CogniaResult<ArtifactInfo>;

    async fn download_artifact(
        &self,
        artifact: &ArtifactInfo,
        dest: &std::path::Path,
    ) -> CogniaResult<PathBuf>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub version: String,
    pub tag: String,
    pub published_at: Option<String>,
    pub prerelease: bool,
    pub assets: Vec<AssetInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    pub name: String,
    pub url: String,
    pub size: u64,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactInfo {
    pub url: String,
    pub filename: String,
    pub size: u64,
    pub checksum: Option<String>,
}
