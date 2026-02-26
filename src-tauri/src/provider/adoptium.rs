use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

const API_BASE: &str = "https://api.adoptium.net/v3";

/// Adoptium Temurin JDK — Cross-platform Java version manager
///
/// This provider manages Eclipse Temurin JDK versions by downloading pre-built
/// binaries from the Adoptium API v3. It stores multiple JDK versions under a
/// local directory and can switch between them via symlinks/junctions.
///
/// Works on Windows, macOS, and Linux — filling the gap where SDKMAN is
/// unavailable (Windows).
pub struct AdoptiumProvider {
    jdks_dir: Option<PathBuf>,
    client: Client,
}

impl AdoptiumProvider {
    pub fn new() -> Self {
        Self {
            jdks_dir: Self::detect_jdks_dir(),
            client: crate::platform::proxy::get_shared_client(),
        }
    }

    fn detect_jdks_dir() -> Option<PathBuf> {
        crate::platform::fs::get_cognia_dir().map(|d| d.join("jdks"))
    }

    fn jdks_dir(&self) -> CogniaResult<PathBuf> {
        self.jdks_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("JDK directory not found".into()))
    }

    fn versions_dir(&self) -> CogniaResult<PathBuf> {
        Ok(self.jdks_dir()?.join("versions"))
    }

    /// Get the platform OS string for the Adoptium API.
    fn get_api_os() -> &'static str {
        if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "mac"
        } else {
            "linux"
        }
    }

    /// Get the platform architecture string for the Adoptium API.
    fn get_api_arch() -> &'static str {
        if cfg!(target_arch = "x86_64") {
            "x64"
        } else if cfg!(target_arch = "aarch64") {
            "aarch64"
        } else if cfg!(target_arch = "x86") {
            "x32"
        } else if cfg!(target_arch = "arm") {
            "arm"
        } else {
            "x64"
        }
    }

    /// Fetch available release feature versions from the Adoptium API.
    async fn fetch_available_releases(&self) -> CogniaResult<AvailableReleases> {
        let url = format!("{}/info/available_releases", API_BASE);
        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "Adoptium API error: {}",
                response.status()
            )));
        }

        response
            .json::<AvailableReleases>()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))
    }

    /// Fetch GA release assets for a specific feature version on the current platform.
    async fn fetch_feature_releases(
        &self,
        feature_version: u32,
    ) -> CogniaResult<Vec<ReleaseAsset>> {
        let os = Self::get_api_os();
        let arch = Self::get_api_arch();
        let url = format!(
            "{}/assets/feature_releases/{}/ga?os={}&architecture={}&image_type=jdk&jvm_impl=hotspot&vendor=eclipse&page_size=20&sort_order=DESC",
            API_BASE, feature_version, os, arch
        );

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "Adoptium API error for JDK {}: {}",
                feature_version,
                response.status()
            )));
        }

        response
            .json::<Vec<ReleaseAsset>>()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))
    }

    /// Get the direct download URL for the latest build of a feature version.
    #[allow(dead_code)]
    fn get_download_url(feature_version: u32) -> String {
        let os = Self::get_api_os();
        let arch = Self::get_api_arch();
        format!(
            "{}/binary/latest/{}/ga/{}/{}/jdk/hotspot/normal/eclipse",
            API_BASE, feature_version, os, arch
        )
    }

    /// Parse a full JDK version string like "21.0.3+9" or "21.0.3" into
    /// its feature version number (e.g. 21).
    pub fn parse_feature_version(version: &str) -> Option<u32> {
        version
            .split('.')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
    }

    /// Scan the versions directory for installed JDK versions.
    fn scan_installed_versions(&self) -> CogniaResult<Vec<(String, PathBuf)>> {
        let versions_dir = self.versions_dir()?;
        if !versions_dir.exists() {
            return Ok(vec![]);
        }

        let mut versions = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        // Skip hidden/temp directories
                        if name.starts_with('.') {
                            continue;
                        }
                        // Verify it has a java binary
                        if Self::find_java_binary(&path).is_some() {
                            versions.push((name.to_string(), path));
                        }
                    }
                }
            }
        }

        // Sort descending by version
        versions.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(versions)
    }

    /// Find the java binary within a JDK installation directory.
    /// JDK archives may extract to a nested structure like jdk-21.0.3+9/ or
    /// Contents/Home/ on macOS.
    fn find_java_binary(base: &Path) -> Option<PathBuf> {
        let binary_name = if cfg!(windows) {
            "java.exe"
        } else {
            "java"
        };

        // Direct: base/bin/java
        let direct = base.join("bin").join(binary_name);
        if direct.exists() {
            return Some(direct);
        }

        // macOS: base/Contents/Home/bin/java
        let macos = base.join("Contents").join("Home").join("bin").join(binary_name);
        if macos.exists() {
            return Some(macos);
        }

        // Check one level of subdirectory (common for extracted archives)
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let sub = entry.path();
                if sub.is_dir() {
                    let sub_bin = sub.join("bin").join(binary_name);
                    if sub_bin.exists() {
                        return Some(sub_bin);
                    }
                    // macOS nested
                    let sub_macos = sub.join("Contents").join("Home").join("bin").join(binary_name);
                    if sub_macos.exists() {
                        return Some(sub_macos);
                    }
                }
            }
        }

        None
    }

    /// Get the JAVA_HOME path for a specific installed version.
    fn get_java_home(&self, version: &str) -> CogniaResult<PathBuf> {
        let version_path = self.versions_dir()?.join(version);
        if !version_path.exists() {
            return Err(CogniaError::Provider(format!(
                "JDK {} is not installed",
                version
            )));
        }

        // Find the actual JAVA_HOME (may be nested)
        let bin_name = if cfg!(windows) {
            "java.exe"
        } else {
            "java"
        };

        // Direct
        if version_path.join("bin").join(bin_name).exists() {
            return Ok(version_path);
        }

        // macOS Contents/Home
        let macos_home = version_path.join("Contents").join("Home");
        if macos_home.join("bin").join(bin_name).exists() {
            return Ok(macos_home);
        }

        // One-level subdirectory
        if let Ok(entries) = std::fs::read_dir(&version_path) {
            for entry in entries.flatten() {
                let sub = entry.path();
                if sub.is_dir() {
                    if sub.join("bin").join(bin_name).exists() {
                        return Ok(sub);
                    }
                    let sub_macos = sub.join("Contents").join("Home");
                    if sub_macos.join("bin").join(bin_name).exists() {
                        return Ok(sub_macos);
                    }
                }
            }
        }

        Ok(version_path)
    }

    /// Read the current symlink to determine the active version.
    fn read_current_link(&self) -> Option<String> {
        let current = self.jdks_dir().ok()?.join("current");
        if !current.exists() && !current.is_symlink() {
            return None;
        }

        // Read the symlink target
        let target = std::fs::read_link(&current).ok()?;
        // Extract version from the last component of the target path
        target
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
    }

    /// Get java version from `java -version` (output goes to stderr).
    async fn get_java_version_from_binary(&self) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
        let output = process::execute("java", &["-version"], Some(opts)).await?;

        // java -version outputs to stderr
        let text = if output.stderr.is_empty() {
            &output.stdout
        } else {
            &output.stderr
        };

        Self::parse_java_version_output(text)
            .ok_or_else(|| CogniaError::Provider("Could not parse Java version".into()))
    }

    /// Parse java -version output to extract the version string.
    /// Handles both modern format `"21.0.3+9"` and JDK 8 format `"1.8.0_412"`.
    pub fn parse_java_version_output(text: &str) -> Option<String> {
        let re = regex::Regex::new(
            r#"version "(\d+(?:\.\d+)*(?:[_+]\d+)?)""#,
        )
        .ok()?;
        re.captures(text)
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
    }

    /// Parse .java-version file content.
    pub fn parse_java_version_file(content: &str) -> Option<String> {
        let trimmed = content.trim();
        if trimmed.is_empty() {
            return None;
        }
        // Could be "21", "21.0.3", "21.0.3+9", or "temurin-21.0.3+9.0.LTS"
        // For Adoptium, we care about the numeric part
        let version = trimmed
            .strip_prefix("temurin-")
            .or(Some(trimmed))?;
        // Remove trailing LTS/metadata
        let version = version.split(".LTS").next().unwrap_or(version);
        Some(version.trim().to_string())
    }

    /// Parse .sdkmanrc for java version.
    pub fn parse_sdkmanrc_java(content: &str) -> Option<String> {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with('#') || line.is_empty() {
                continue;
            }
            if let Some(rest) = line.strip_prefix("java=") {
                let version = rest.trim();
                if !version.is_empty() {
                    return Some(version.to_string());
                }
            }
        }
        None
    }

    /// Find the extracted JDK directory inside a temp extraction directory.
    fn find_extracted_dir(temp_dir: &Path) -> CogniaResult<PathBuf> {
        let entries: Vec<_> = std::fs::read_dir(temp_dir)
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?
            .flatten()
            .filter(|e| e.path().is_dir())
            .collect();

        if entries.len() == 1 {
            Ok(entries[0].path())
        } else {
            Ok(temp_dir.to_path_buf())
        }
    }
}

impl Default for AdoptiumProvider {
    fn default() -> Self {
        Self::new()
    }
}

// ── Adoptium API response types ──

#[derive(Debug, Deserialize)]
pub struct AvailableReleases {
    pub available_lts_releases: Vec<u32>,
    pub available_releases: Vec<u32>,
    pub most_recent_feature_release: u32,
    pub most_recent_feature_version: u32,
    pub most_recent_lts: u32,
    #[serde(default)]
    pub tip_version: u32,
}

#[derive(Debug, Deserialize)]
pub struct ReleaseAsset {
    pub binary: BinaryInfo,
    pub release_name: String,
    pub vendor: Option<String>,
    pub version: VersionData,
}

#[derive(Debug, Deserialize)]
pub struct BinaryInfo {
    pub architecture: String,
    pub image_type: String,
    pub os: String,
    pub package: PackageInfo,
}

#[derive(Debug, Deserialize)]
pub struct PackageInfo {
    pub checksum: Option<String>,
    pub link: String,
    pub name: String,
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct VersionData {
    pub major: u32,
    pub minor: u32,
    pub security: u32,
    #[serde(default)]
    pub build: u32,
    pub semver: Option<String>,
    pub openjdk_version: Option<String>,
}

impl VersionData {
    pub fn full_version(&self) -> String {
        if self.build > 0 {
            format!("{}.{}.{}+{}", self.major, self.minor, self.security, self.build)
        } else {
            format!("{}.{}.{}", self.major, self.minor, self.security)
        }
    }
}

// ── Provider trait ──

#[async_trait]
impl Provider for AdoptiumProvider {
    fn id(&self) -> &str {
        "adoptium"
    }

    fn display_name(&self) -> &str {
        "Adoptium Temurin JDK"
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
        82
    }

    async fn is_available(&self) -> bool {
        // Always available — uses REST API, no local tool dependency.
        // We just need a writable jdks directory.
        self.jdks_dir.is_some()
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let releases = self.fetch_available_releases().await?;

        let results: Vec<PackageSummary> = releases
            .available_releases
            .iter()
            .rev()
            .filter(|v| {
                if query.is_empty() {
                    return true;
                }
                let vs = v.to_string();
                vs.contains(query) || format!("jdk-{}", v).contains(query)
            })
            .map(|v| {
                let is_lts = releases.available_lts_releases.contains(v);
                let label = if is_lts {
                    format!("JDK {} (LTS)", v)
                } else {
                    format!("JDK {}", v)
                };
                PackageSummary {
                    name: format!("jdk@{}", v),
                    description: Some(format!(
                        "Eclipse Temurin {} — {}",
                        label,
                        if is_lts { "Long Term Support" } else { "Feature Release" }
                    )),
                    latest_version: Some(v.to_string()),
                    provider: self.id().to_string(),
                }
            })
            .collect();

        Ok(results)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<super::traits::PackageInfo> {
        let version_str = name
            .strip_prefix("jdk@")
            .or_else(|| name.strip_prefix("java@"))
            .unwrap_or(name);

        let feature_version = Self::parse_feature_version(version_str).unwrap_or_else(|| {
            version_str.parse::<u32>().unwrap_or(21)
        });

        let assets = self.fetch_feature_releases(feature_version).await?;

        let versions: Vec<VersionInfo> = assets
            .iter()
            .map(|a| VersionInfo {
                version: a.version.full_version(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        let _latest = versions.first().map(|v| v.version.clone());

        Ok(super::traits::PackageInfo {
            name: name.to_string(),
            display_name: Some(format!("Eclipse Temurin JDK {}", feature_version)),
            description: Some(format!(
                "Eclipse Temurin JDK {} — Production-ready, open-source Java runtime",
                feature_version
            )),
            homepage: Some("https://adoptium.net".into()),
            license: Some("GPL-2.0-with-classpath-exception".into()),
            repository: Some("https://github.com/adoptium/temurin-build".into()),
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let version_str = name
            .strip_prefix("jdk@")
            .or_else(|| name.strip_prefix("java@"))
            .unwrap_or(name);

        let feature_version = Self::parse_feature_version(version_str).unwrap_or_else(|| {
            version_str.parse::<u32>().unwrap_or(21)
        });

        let assets = self.fetch_feature_releases(feature_version).await?;

        Ok(assets
            .into_iter()
            .map(|a| VersionInfo {
                version: a.version.full_version(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req.version.as_deref().unwrap_or("21");

        // Parse the feature version number
        let feature_version = Self::parse_feature_version(version).unwrap_or_else(|| {
            version.parse::<u32>().unwrap_or(21)
        });

        // Get the actual version info from the API
        let assets = self.fetch_feature_releases(feature_version).await?;
        let asset = assets.first().ok_or_else(|| {
            CogniaError::Provider(format!("No JDK {} releases found for this platform", feature_version))
        })?;

        let actual_version = asset.version.full_version();
        let versions_dir = self.versions_dir()?;
        let install_path = versions_dir.join(&actual_version);

        if install_path.exists() && !req.force {
            return Ok(InstallReceipt {
                name: "jdk".to_string(),
                version: actual_version,
                provider: self.id().to_string(),
                install_path,
                files: vec![],
                installed_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        // Download the archive
        let download_url = &asset.binary.package.link;
        let response = self
            .client
            .get(download_url)
            .timeout(Duration::from_secs(600))
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "Download failed: {}",
                response.status()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        // Ensure versions directory exists
        tokio::fs::create_dir_all(&versions_dir)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Extract archive to a temporary directory
        let temp_dir = versions_dir.join(format!(".{}-tmp", actual_version));
        if temp_dir.exists() {
            tokio::fs::remove_dir_all(&temp_dir)
                .await
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }
        tokio::fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Determine archive extension from package name
        let archive_ext = if asset.binary.package.name.ends_with(".zip") {
            "zip"
        } else if asset.binary.package.name.ends_with(".tar.gz") {
            "tar.gz"
        } else {
            "tar.gz"
        };
        let archive_filename = format!(".{}-download.{}", actual_version, archive_ext);
        let archive_path = versions_dir.join(&archive_filename);

        tokio::fs::write(&archive_path, &bytes)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Extract using shared infrastructure
        let extract_result =
            crate::core::installer::extract_archive(&archive_path, &temp_dir).await;
        let _ = tokio::fs::remove_file(&archive_path).await;
        extract_result.map_err(|e| CogniaError::Provider(format!("Extraction failed: {}", e)))?;

        // Move extracted content to final install path
        if install_path.exists() {
            tokio::fs::remove_dir_all(&install_path)
                .await
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }

        let extracted_dir = Self::find_extracted_dir(&temp_dir)?;
        tokio::fs::rename(&extracted_dir, &install_path)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        let _ = tokio::fs::remove_dir_all(&temp_dir).await;

        Ok(InstallReceipt {
            name: "jdk".to_string(),
            version: actual_version,
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

        let install_path = self.versions_dir()?.join(&version);
        if !install_path.exists() {
            return Err(CogniaError::Provider(format!(
                "JDK {} is not installed",
                version
            )));
        }

        tokio::fs::remove_dir_all(&install_path)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let installed = self.scan_installed_versions()?;

        let packages: Vec<InstalledPackage> = installed
            .into_iter()
            .filter(|(version, _)| {
                filter.name_filter.as_ref().map_or(true, |f| {
                    version.contains(f) || format!("jdk@{}", version).contains(f)
                })
            })
            .map(|(version, path)| InstalledPackage {
                name: format!("jdk@{}", version),
                version,
                provider: self.id().into(),
                install_path: path,
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.scan_installed_versions()?;
        let mut updates = Vec::new();

        for (version, _) in &installed {
            let feature = match Self::parse_feature_version(version) {
                Some(v) => v,
                None => continue,
            };

            if let Ok(assets) = self.fetch_feature_releases(feature).await {
                if let Some(latest) = assets.first() {
                    let latest_version = latest.version.full_version();
                    if latest_version != *version {
                        updates.push(UpdateInfo {
                            name: format!("jdk@{}", version),
                            current_version: version.clone(),
                            latest_version,
                            provider: self.id().into(),
                        });
                    }
                }
            }
        }

        Ok(updates)
    }
}

// ── EnvironmentProvider trait ──

#[async_trait]
impl EnvironmentProvider for AdoptiumProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let current = self.get_current_version().await?.unwrap_or_default();
        let installed = self.scan_installed_versions()?;

        Ok(installed
            .into_iter()
            .map(|(version, path)| InstalledVersion {
                is_current: version == current,
                version,
                install_path: path,
                size: None,
                installed_at: None,
            })
            .collect())
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        // 1. Check our current symlink
        if let Some(version) = self.read_current_link() {
            return Ok(Some(version));
        }

        // 2. Fall back to java -version
        match self.get_java_version_from_binary().await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        let version_path = self.versions_dir()?.join(version);
        if !version_path.exists() {
            return Err(CogniaError::Provider(format!(
                "JDK {} is not installed. Install it first.",
                version
            )));
        }

        let current_link = self.jdks_dir()?.join("current");

        // Remove existing symlink/junction
        if current_link.exists() || current_link.is_symlink() {
            #[cfg(windows)]
            {
                if current_link.is_dir() {
                    let _ = std::fs::remove_dir(&current_link);
                } else {
                    let _ = std::fs::remove_file(&current_link);
                }
            }
            #[cfg(not(windows))]
            {
                let _ = std::fs::remove_file(&current_link);
            }
        }

        // Create symlink/junction
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&version_path, &current_link)
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(&version_path, &current_link)
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }

        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let version_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&version_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();
        loop {
            // 1. .java-version
            let java_version_file = current.join(".java-version");
            if java_version_file.exists() {
                if let Ok(content) =
                    crate::platform::fs::read_file_string(&java_version_file).await
                {
                    if let Some(version) = Self::parse_java_version_file(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(java_version_file),
                        }));
                    }
                }
            }

            // 2. .sdkmanrc
            let sdkmanrc = current.join(".sdkmanrc");
            if sdkmanrc.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&sdkmanrc).await {
                    if let Some(version) = Self::parse_sdkmanrc_java(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::LocalFile,
                            source_path: Some(sdkmanrc),
                        }));
                    }
                }
            }

            // 3. .tool-versions
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("java ") {
                            let version = line.strip_prefix("java ").unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            // 4. pom.xml
            let pom = current.join("pom.xml");
            if pom.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&pom).await {
                    if let Some(version) = Self::extract_java_version_from_pom(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::Manifest,
                            source_path: Some(pom),
                        }));
                    }
                }
            }

            // 5. build.gradle / build.gradle.kts
            for gradle_file in &["build.gradle", "build.gradle.kts"] {
                let gradle_path = current.join(gradle_file);
                if gradle_path.exists() {
                    if let Ok(content) =
                        crate::platform::fs::read_file_string(&gradle_path).await
                    {
                        if let Some(version) = Self::extract_java_version_from_gradle(&content) {
                            return Ok(Some(VersionDetection {
                                version,
                                source: VersionSource::Manifest,
                                source_path: Some(gradle_path),
                            }));
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 6. Fall back to current version
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
        let java_home = self.get_java_home(version)?;
        let bin_path = java_home.join("bin");
        Ok(EnvModifications::new()
            .set_var("JAVA_HOME", java_home.to_string_lossy().to_string())
            .prepend_path(bin_path))
    }

    fn version_file_name(&self) -> &str {
        ".java-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

// ── SystemPackageProvider trait ──

#[async_trait]
impl SystemPackageProvider for AdoptiumProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.scan_installed_versions()?;
        Ok(versions.iter().any(|(v, _)| v == name))
    }
}

// ── Manifest parsing helpers ──

impl AdoptiumProvider {
    /// Extract Java version from pom.xml content.
    pub fn extract_java_version_from_pom(content: &str) -> Option<String> {
        // <java.version>21</java.version> or <maven.compiler.release>21</maven.compiler.release>
        let patterns = [
            r"<java\.version>(\d+(?:\.\d+)*)</java\.version>",
            r"<maven\.compiler\.release>(\d+)</maven\.compiler\.release>",
            r"<maven\.compiler\.source>(\d+(?:\.\d+)*)</maven\.compiler\.source>",
            r"<maven\.compiler\.target>(\d+(?:\.\d+)*)</maven\.compiler\.target>",
        ];

        for pattern in &patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                if let Some(caps) = re.captures(content) {
                    if let Some(m) = caps.get(1) {
                        let version = m.as_str();
                        // Skip Maven variables like ${java.version}
                        if !version.starts_with('$') {
                            return Some(version.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    /// Extract Java version from build.gradle or build.gradle.kts content.
    pub fn extract_java_version_from_gradle(content: &str) -> Option<String> {
        let patterns = [
            r#"sourceCompatibility\s*=\s*['"]?(\d+)['"]?"#,
            r#"targetCompatibility\s*=\s*['"]?(\d+)['"]?"#,
            r"JavaVersion\.VERSION_(\d+)",
            r"JavaLanguageVersion\.of\((\d+)\)",
            r#"jvmTarget\s*=\s*['"](\d+)['"]"#,
        ];

        for pattern in &patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                if let Some(caps) = re.captures(content) {
                    if let Some(m) = caps.get(1) {
                        return Some(m.as_str().to_string());
                    }
                }
            }
        }
        None
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = AdoptiumProvider::new();
        assert_eq!(provider.id(), "adoptium");
        assert_eq!(provider.display_name(), "Adoptium Temurin JDK");
        assert!(provider.capabilities().contains(&Capability::Install));
        assert!(provider.capabilities().contains(&Capability::Uninstall));
        assert!(provider.capabilities().contains(&Capability::Search));
        assert!(provider.capabilities().contains(&Capability::List));
        assert!(provider.capabilities().contains(&Capability::VersionSwitch));
        assert!(provider.capabilities().contains(&Capability::MultiVersion));
        assert_eq!(provider.priority(), 82);
        assert_eq!(
            provider.supported_platforms(),
            vec![Platform::Windows, Platform::MacOS, Platform::Linux]
        );
    }

    #[test]
    fn test_get_api_os() {
        let os = AdoptiumProvider::get_api_os();
        assert!(
            ["windows", "mac", "linux"].contains(&os),
            "API OS should be valid: {}",
            os
        );
    }

    #[test]
    fn test_get_api_arch() {
        let arch = AdoptiumProvider::get_api_arch();
        assert!(
            ["x64", "aarch64", "x32", "arm"].contains(&arch),
            "API arch should be valid: {}",
            arch
        );
    }

    #[test]
    fn test_parse_feature_version() {
        assert_eq!(AdoptiumProvider::parse_feature_version("21"), Some(21));
        assert_eq!(AdoptiumProvider::parse_feature_version("21.0.3"), Some(21));
        assert_eq!(
            AdoptiumProvider::parse_feature_version("21.0.3+9"),
            Some(21)
        );
        assert_eq!(AdoptiumProvider::parse_feature_version("8"), Some(8));
        assert_eq!(AdoptiumProvider::parse_feature_version("17.0.11"), Some(17));
        assert_eq!(AdoptiumProvider::parse_feature_version(""), None);
        assert_eq!(AdoptiumProvider::parse_feature_version("abc"), None);
    }

    #[test]
    fn test_parse_java_version_output() {
        // Standard java -version output
        let output = r#"openjdk version "21.0.3" 2024-04-16 LTS
OpenJDK Runtime Environment Temurin-21.0.3+9 (build 21.0.3+9-LTS)
OpenJDK 64-Bit Server VM Temurin-21.0.3+9 (build 21.0.3+9-LTS, mixed mode, sharing)"#;
        assert_eq!(
            AdoptiumProvider::parse_java_version_output(output),
            Some("21.0.3".to_string())
        );

        // JDK 8 format
        let output8 = r#"openjdk version "1.8.0_412"
OpenJDK Runtime Environment (Temurin)(build 1.8.0_412-b08)
OpenJDK 64-Bit Server VM (Temurin)(build 25.412-b08, mixed mode)"#;
        assert_eq!(
            AdoptiumProvider::parse_java_version_output(output8),
            Some("1.8.0_412".to_string())
        );

        // Version with build number
        let output_build = r#"openjdk version "21.0.3+9""#;
        assert_eq!(
            AdoptiumProvider::parse_java_version_output(output_build),
            Some("21.0.3+9".to_string())
        );

        // Empty
        assert_eq!(AdoptiumProvider::parse_java_version_output(""), None);
    }

    #[test]
    fn test_parse_java_version_file() {
        assert_eq!(
            AdoptiumProvider::parse_java_version_file("21"),
            Some("21".to_string())
        );
        assert_eq!(
            AdoptiumProvider::parse_java_version_file("21.0.3+9"),
            Some("21.0.3+9".to_string())
        );
        assert_eq!(
            AdoptiumProvider::parse_java_version_file("temurin-21.0.3+9.0.LTS"),
            Some("21.0.3+9.0".to_string())
        );
        assert_eq!(
            AdoptiumProvider::parse_java_version_file("  17.0.11  \n"),
            Some("17.0.11".to_string())
        );
        assert_eq!(AdoptiumProvider::parse_java_version_file(""), None);
        assert_eq!(AdoptiumProvider::parse_java_version_file("   "), None);
    }

    #[test]
    fn test_parse_sdkmanrc_java() {
        let content = "# SDKMAN config\njava=21.0.3-tem\nkotlin=2.0.0\n";
        assert_eq!(
            AdoptiumProvider::parse_sdkmanrc_java(content),
            Some("21.0.3-tem".to_string())
        );

        let content_no_java = "kotlin=2.0.0\nscala=3.4.1\n";
        assert_eq!(AdoptiumProvider::parse_sdkmanrc_java(content_no_java), None);

        let empty = "";
        assert_eq!(AdoptiumProvider::parse_sdkmanrc_java(empty), None);
    }

    #[test]
    fn test_parse_available_releases() {
        let json = r#"{
            "available_lts_releases": [8, 11, 17, 21],
            "available_releases": [8, 11, 17, 21, 22, 23],
            "most_recent_feature_release": 23,
            "most_recent_feature_version": 24,
            "most_recent_lts": 21,
            "tip_version": 24
        }"#;

        let releases: AvailableReleases = serde_json::from_str(json).unwrap();
        assert_eq!(releases.available_lts_releases, vec![8, 11, 17, 21]);
        assert_eq!(releases.available_releases, vec![8, 11, 17, 21, 22, 23]);
        assert_eq!(releases.most_recent_lts, 21);
        assert_eq!(releases.most_recent_feature_release, 23);
    }

    #[test]
    fn test_parse_release_asset() {
        let json = r#"{
            "binary": {
                "architecture": "x64",
                "image_type": "jdk",
                "os": "windows",
                "package": {
                    "checksum": "abc123",
                    "link": "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3+9/OpenJDK21U-jdk_x64_windows_hotspot_21.0.3_9.zip",
                    "name": "OpenJDK21U-jdk_x64_windows_hotspot_21.0.3_9.zip",
                    "size": 198000000
                }
            },
            "release_name": "jdk-21.0.3+9",
            "vendor": "eclipse",
            "version": {
                "major": 21,
                "minor": 0,
                "security": 3,
                "build": 9,
                "semver": "21.0.3+9",
                "openjdk_version": "21.0.3+9"
            }
        }"#;

        let asset: ReleaseAsset = serde_json::from_str(json).unwrap();
        assert_eq!(asset.version.major, 21);
        assert_eq!(asset.version.minor, 0);
        assert_eq!(asset.version.security, 3);
        assert_eq!(asset.version.build, 9);
        assert_eq!(asset.version.full_version(), "21.0.3+9");
        assert_eq!(asset.binary.os, "windows");
        assert_eq!(asset.binary.architecture, "x64");
        assert!(asset.binary.package.link.contains("adoptium"));
        assert!(asset.binary.package.name.ends_with(".zip"));
    }

    #[test]
    fn test_version_data_full_version() {
        let v1 = VersionData {
            major: 21,
            minor: 0,
            security: 3,
            build: 9,
            semver: None,
            openjdk_version: None,
        };
        assert_eq!(v1.full_version(), "21.0.3+9");

        let v2 = VersionData {
            major: 17,
            minor: 0,
            security: 11,
            build: 0,
            semver: None,
            openjdk_version: None,
        };
        assert_eq!(v2.full_version(), "17.0.11");
    }

    #[test]
    fn test_extract_java_version_from_pom() {
        let pom = r#"<project>
  <properties>
    <java.version>21</java.version>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
  </properties>
</project>"#;
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_pom(pom),
            Some("21".to_string())
        );

        let pom_release = r#"<properties>
    <maven.compiler.release>17</maven.compiler.release>
</properties>"#;
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_pom(pom_release),
            Some("17".to_string())
        );

        // Maven variable — should be skipped
        let pom_var = r#"<maven.compiler.source>${java.version}</maven.compiler.source>"#;
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_pom(pom_var),
            None
        );

        assert_eq!(
            AdoptiumProvider::extract_java_version_from_pom("<project></project>"),
            None
        );
    }

    #[test]
    fn test_extract_java_version_from_gradle() {
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle("sourceCompatibility = 21"),
            Some("21".to_string())
        );
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle("sourceCompatibility = '17'"),
            Some("17".to_string())
        );
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle(
                "sourceCompatibility = JavaVersion.VERSION_11"
            ),
            Some("11".to_string())
        );
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle(
                "java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }"
            ),
            Some("21".to_string())
        );
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle(r#"jvmTarget = "21""#),
            Some("21".to_string())
        );
        assert_eq!(
            AdoptiumProvider::extract_java_version_from_gradle("apply plugin: 'java'"),
            None
        );
    }

    #[test]
    fn test_detect_jdks_dir() {
        let dir = AdoptiumProvider::detect_jdks_dir();
        assert!(dir.is_some(), "JDKs dir should be detectable");
        let dir = dir.unwrap();
        assert!(
            dir.to_string_lossy().contains("jdks"),
            "Dir should end with jdks: {:?}",
            dir
        );
    }
}
