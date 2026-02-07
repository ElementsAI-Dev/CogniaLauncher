use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::env::{EnvModifications, Platform};
use crate::platform::process;
use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Environment type for system-installed runtimes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemEnvironmentType {
    Node,
    Python,
    Go,
    Rust,
    Ruby,
    Java,
    Kotlin,
    Php,
    Dotnet,
    Deno,
    Bun,
}

impl SystemEnvironmentType {
    pub fn id(&self) -> &'static str {
        match self {
            Self::Node => "system-node",
            Self::Python => "system-python",
            Self::Go => "system-go",
            Self::Rust => "system-rust",
            Self::Ruby => "system-ruby",
            Self::Java => "system-java",
            Self::Kotlin => "system-kotlin",
            Self::Php => "system-php",
            Self::Dotnet => "system-dotnet",
            Self::Deno => "system-deno",
            Self::Bun => "system-bun",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Node => "Node.js (System)",
            Self::Python => "Python (System)",
            Self::Go => "Go (System)",
            Self::Rust => "Rust (System)",
            Self::Ruby => "Ruby (System)",
            Self::Java => "Java (System)",
            Self::Kotlin => "Kotlin (System)",
            Self::Php => "PHP (System)",
            Self::Dotnet => ".NET (System)",
            Self::Deno => "Deno (System)",
            Self::Bun => "Bun (System)",
        }
    }

    pub fn env_type(&self) -> &'static str {
        match self {
            Self::Node => "node",
            Self::Python => "python",
            Self::Go => "go",
            Self::Rust => "rust",
            Self::Ruby => "ruby",
            Self::Java => "java",
            Self::Kotlin => "kotlin",
            Self::Php => "php",
            Self::Dotnet => "dotnet",
            Self::Deno => "deno",
            Self::Bun => "bun",
        }
    }

    /// Get the detection configuration for this environment type
    pub fn detection_config(&self) -> SystemDetectionConfig {
        match self {
            Self::Node => SystemDetectionConfig {
                commands: vec!["node"],
                version_args: vec!["--version"],
                version_pattern: r"v?(\d+\.\d+\.\d+)",
                version_files: vec![".nvmrc", ".node-version", ".tool-versions"],
                manifest_files: vec![("package.json", r#""engines"\s*:\s*\{[^}]*"node"\s*:\s*"([^"]+)""#)],
            },
            Self::Python => SystemDetectionConfig {
                #[cfg(windows)]
                commands: vec!["python", "python3", "py"],
                #[cfg(not(windows))]
                commands: vec!["python3", "python"],
                version_args: vec!["--version"],
                version_pattern: r"Python (\d+\.\d+\.\d+)",
                version_files: vec![".python-version", ".tool-versions"],
                manifest_files: vec![
                    ("pyproject.toml", r#"python\s*=\s*"[^"]*(\d+\.\d+)"#),
                    ("Pipfile", r#"python_version\s*=\s*"(\d+\.\d+)"#),
                ],
            },
            Self::Go => SystemDetectionConfig {
                commands: vec!["go"],
                version_args: vec!["version"],
                version_pattern: r"go(\d+\.\d+(?:\.\d+)?)",
                version_files: vec![".go-version", ".tool-versions"],
                manifest_files: vec![("go.mod", r"^go\s+(\d+\.\d+(?:\.\d+)?)")],
            },
            Self::Rust => SystemDetectionConfig {
                commands: vec!["rustc"],
                version_args: vec!["--version"],
                version_pattern: r"rustc (\d+\.\d+\.\d+)",
                version_files: vec!["rust-toolchain", "rust-toolchain.toml", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Ruby => SystemDetectionConfig {
                commands: vec!["ruby"],
                version_args: vec!["--version"],
                version_pattern: r"ruby (\d+\.\d+\.\d+)",
                version_files: vec![".ruby-version", ".tool-versions"],
                manifest_files: vec![("Gemfile", r#"ruby ['"](\d+\.\d+(?:\.\d+)?)"#)],
            },
            Self::Java => SystemDetectionConfig {
                commands: vec!["java"],
                version_args: vec!["-version"],
                version_pattern: r#"version "(\d+(?:\.\d+)*)""#,
                version_files: vec![".java-version", ".tool-versions", ".sdkmanrc"],
                manifest_files: vec![],
            },
            Self::Kotlin => SystemDetectionConfig {
                commands: vec!["kotlinc"],
                version_args: vec!["-version"],
                version_pattern: r"kotlinc-jvm (\d+\.\d+\.\d+)",
                version_files: vec![".kotlin-version", ".tool-versions", ".sdkmanrc"],
                manifest_files: vec![],
            },
            Self::Php => SystemDetectionConfig {
                commands: vec!["php"],
                version_args: vec!["--version"],
                version_pattern: r"PHP (\d+\.\d+\.\d+)",
                version_files: vec![".php-version", ".tool-versions"],
                manifest_files: vec![("composer.json", r#""php"\s*:\s*"[^"]*(\d+\.\d+)"#)],
            },
            Self::Dotnet => SystemDetectionConfig {
                commands: vec!["dotnet"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec!["global.json"],
                manifest_files: vec![],
            },
            Self::Deno => SystemDetectionConfig {
                commands: vec!["deno"],
                version_args: vec!["--version"],
                version_pattern: r"deno (\d+\.\d+\.\d+)",
                version_files: vec![".deno-version", ".tool-versions"],
                manifest_files: vec![],
            },
            Self::Bun => SystemDetectionConfig {
                commands: vec!["bun"],
                version_args: vec!["--version"],
                version_pattern: r"(\d+\.\d+\.\d+)",
                version_files: vec![".bun-version", ".tool-versions"],
                manifest_files: vec![],
            },
        }
    }

    /// Get all environment types
    pub fn all() -> Vec<Self> {
        vec![
            Self::Node,
            Self::Python,
            Self::Go,
            Self::Rust,
            Self::Ruby,
            Self::Java,
            Self::Kotlin,
            Self::Php,
            Self::Dotnet,
            Self::Deno,
            Self::Bun,
        ]
    }
}

/// Configuration for detecting a system-installed environment
#[derive(Debug, Clone)]
pub struct SystemDetectionConfig {
    pub commands: Vec<&'static str>,
    pub version_args: Vec<&'static str>,
    pub version_pattern: &'static str,
    pub version_files: Vec<&'static str>,
    pub manifest_files: Vec<(&'static str, &'static str)>,
}

/// Provider for detecting system-installed environments
/// This detects environments installed directly via official installers,
/// package managers (apt, brew, winget, scoop), or other means
pub struct SystemEnvironmentProvider {
    env_type: SystemEnvironmentType,
    cached_version: tokio::sync::RwLock<Option<String>>,
    cached_path: tokio::sync::RwLock<Option<PathBuf>>,
}

impl SystemEnvironmentProvider {
    pub fn new(env_type: SystemEnvironmentType) -> Self {
        Self {
            env_type,
            cached_version: tokio::sync::RwLock::new(None),
            cached_path: tokio::sync::RwLock::new(None),
        }
    }

    /// Detect version from system executable
    async fn detect_system_version(&self) -> CogniaResult<Option<(String, PathBuf)>> {
        let config = self.env_type.detection_config();

        for cmd in &config.commands {
            // Check if command exists in PATH
            if let Some(path) = process::which(cmd).await {
                let path = PathBuf::from(&path);

                // Run version command
                let args: Vec<&str> = config.version_args.iter().copied().collect();
                if let Ok(output) = process::execute(cmd, &args, None).await {
                    if output.success {
                        let output_text = if output.stdout.is_empty() {
                            &output.stderr
                        } else {
                            &output.stdout
                        };

                        if let Ok(re) = Regex::new(config.version_pattern) {
                            if let Some(caps) = re.captures(output_text) {
                                if let Some(version) = caps.get(1) {
                                    return Ok(Some((version.as_str().to_string(), path)));
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    /// Detect version from project files
    async fn detect_from_project_files(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let config = self.env_type.detection_config();
        let mut current = start_path.to_path_buf();

        loop {
            // Check version files (e.g., .node-version, .python-version)
            for version_file in &config.version_files {
                let file_path = current.join(version_file);
                if file_path.exists() {
                    if *version_file == ".tool-versions" {
                        // Parse .tool-versions format (asdf-style)
                        if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await {
                            let env_type = self.env_type.env_type();
                            for line in content.lines() {
                                let line = line.trim();
                                if line.starts_with(env_type) || 
                                   (env_type == "node" && line.starts_with("nodejs")) ||
                                   (env_type == "go" && line.starts_with("golang")) {
                                    let parts: Vec<&str> = line.split_whitespace().collect();
                                    if parts.len() >= 2 {
                                        return Ok(Some(VersionDetection {
                                            version: parts[1].to_string(),
                                            source: VersionSource::LocalFile,
                                            source_path: Some(file_path),
                                        }));
                                    }
                                }
                            }
                        }
                    } else {
                        // Simple version file
                        if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await {
                            let version = content.trim().to_string();
                            if !version.is_empty() && !version.starts_with('#') {
                                return Ok(Some(VersionDetection {
                                    version,
                                    source: VersionSource::LocalFile,
                                    source_path: Some(file_path),
                                }));
                            }
                        }
                    }
                }
            }

            // Check manifest files
            for (manifest_file, pattern) in &config.manifest_files {
                let file_path = current.join(manifest_file);
                if file_path.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&file_path).await {
                        if let Ok(re) = Regex::new(pattern) {
                            if let Some(caps) = re.captures(&content) {
                                if let Some(version) = caps.get(1) {
                                    return Ok(Some(VersionDetection {
                                        version: version.as_str().to_string(),
                                        source: VersionSource::Manifest,
                                        source_path: Some(file_path),
                                    }));
                                }
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        Ok(None)
    }
}

#[async_trait]
impl Provider for SystemEnvironmentProvider {
    fn id(&self) -> &str {
        self.env_type.id()
    }

    fn display_name(&self) -> &str {
        self.env_type.display_name()
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([Capability::List])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        // Lower priority than version managers
        50
    }

    async fn is_available(&self) -> bool {
        if let Ok(Some(_)) = self.detect_system_version().await {
            return true;
        }
        false
    }

    async fn search(
        &self,
        _query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        Ok(vec![])
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        Err(CogniaError::Provider(
            "System provider does not support package info".into(),
        ))
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Return the installed system version
        if let Ok(Some((version, _))) = self.detect_system_version().await {
            Ok(vec![VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn install(&self, _request: InstallRequest) -> CogniaResult<InstallReceipt> {
        Err(CogniaError::Provider(
            "System provider does not support installation. Use a version manager or system package manager.".into(),
        ))
    }

    async fn uninstall(&self, _request: UninstallRequest) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support uninstallation. Use your system package manager.".into(),
        ))
    }

    async fn list_installed(&self, _filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            Ok(vec![InstalledPackage {
                name: self.env_type.env_type().to_string(),
                version,
                provider: self.id().to_string(),
                install_path: path,
                installed_at: String::new(),
                is_global: true,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for SystemEnvironmentProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            Ok(vec![InstalledVersion {
                version,
                install_path: path,
                size: None,
                installed_at: None,
                is_current: true,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        // Check cache first
        {
            let cache = self.cached_version.read().await;
            if let Some(ref version) = *cache {
                return Ok(Some(version.clone()));
            }
        }

        // Detect and cache
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            {
                let mut cache = self.cached_version.write().await;
                *cache = Some(version.clone());
            }
            {
                let mut path_cache = self.cached_path.write().await;
                *path_cache = Some(path);
            }
            return Ok(Some(version));
        }

        Ok(None)
    }

    async fn set_global_version(&self, _version: &str) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support version switching. Use a version manager like fnm, pyenv, or goenv.".into(),
        ))
    }

    async fn set_local_version(&self, _project_path: &Path, _version: &str) -> CogniaResult<()> {
        Err(CogniaError::Provider(
            "System provider does not support local version files. Use a version manager.".into(),
        ))
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        // First check for project-specific version files
        if let Ok(Some(detection)) = self.detect_from_project_files(start_path).await {
            return Ok(Some(detection));
        }

        // Fall back to system executable
        if let Ok(Some((version, path))) = self.detect_system_version().await {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemExecutable,
                source_path: Some(path),
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, _version: &str) -> CogniaResult<EnvModifications> {
        // System installations are already in PATH
        Ok(EnvModifications::new())
    }

    fn version_file_name(&self) -> &str {
        let config = self.env_type.detection_config();
        config.version_files.first().unwrap_or(&".version")
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_system_go_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Go);
        let available = provider.is_available().await;
        println!("Go system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Go version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_system_node_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Node);
        let available = provider.is_available().await;
        println!("Node system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Node version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_system_python_detection() {
        let provider = SystemEnvironmentProvider::new(SystemEnvironmentType::Python);
        let available = provider.is_available().await;
        println!("Python system available: {}", available);

        if available {
            let version = provider.get_current_version().await.unwrap();
            println!("Python version: {:?}", version);
        }
    }

    #[tokio::test]
    async fn test_all_system_environments() {
        for env_type in SystemEnvironmentType::all() {
            let provider = SystemEnvironmentProvider::new(env_type);
            let available = provider.is_available().await;
            println!("{:?} available: {}", env_type, available);
        }
    }
}
