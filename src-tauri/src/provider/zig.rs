use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Zig — A general-purpose programming language and toolchain
///
/// This provider manages Zig versions by downloading pre-built binaries from
/// the official ziglang.org download index. It stores multiple versions under
/// a local directory and can switch between them.
pub struct ZigProvider {
    zig_dir: Option<PathBuf>,
    client: Client,
}

impl ZigProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        Self {
            zig_dir: Self::detect_zig_dir(),
            client,
        }
    }

    fn detect_zig_dir() -> Option<PathBuf> {
        if cfg!(windows) {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("zig"))
                .or_else(|| {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".zig"))
                })
        } else {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".zig"))
        }
    }

    fn zig_dir(&self) -> CogniaResult<PathBuf> {
        self.zig_dir
            .clone()
            .ok_or_else(|| CogniaError::Provider("Zig directory not found".into()))
    }

    fn versions_dir(&self) -> CogniaResult<PathBuf> {
        Ok(self.zig_dir()?.join("versions"))
    }

    async fn run_zig(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(30));
        let output = process::execute("zig", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// Parse the output of `zig version` to extract the version string.
    fn parse_zig_version_output(output: &str) -> Option<String> {
        let trimmed = output.trim();
        if trimmed.is_empty() {
            return None;
        }
        // `zig version` outputs a plain version string like "0.13.0" or
        // "0.16.0-dev.2637+6a9510c0e"
        let version = trimmed.lines().next()?.trim().to_string();
        if version.is_empty() {
            None
        } else {
            Some(version)
        }
    }

    async fn get_zig_version(&self) -> CogniaResult<String> {
        let output = self.run_zig(&["version"]).await?;
        Self::parse_zig_version_output(&output)
            .ok_or_else(|| CogniaError::Provider("Could not parse Zig version".into()))
    }

    /// Determine the platform key used in the Zig download index.
    fn get_platform_key() -> Option<&'static str> {
        let os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            return None;
        };

        let arch = if cfg!(target_arch = "x86_64") {
            "x86_64"
        } else if cfg!(target_arch = "aarch64") {
            "aarch64"
        } else if cfg!(target_arch = "x86") {
            "x86"
        } else if cfg!(target_arch = "arm") {
            "arm"
        } else {
            return None;
        };

        Some(match (arch, os) {
            ("x86_64", "windows") => "x86_64-windows",
            ("aarch64", "windows") => "aarch64-windows",
            ("x86", "windows") => "x86-windows",
            ("x86_64", "macos") => "x86_64-macos",
            ("aarch64", "macos") => "aarch64-macos",
            ("x86_64", "linux") => "x86_64-linux",
            ("aarch64", "linux") => "aarch64-linux",
            ("arm", "linux") => "arm-linux",
            ("x86", "linux") => "x86-linux",
            _ => return None,
        })
    }

    /// Fetch the official Zig download index and return available versions.
    async fn fetch_available_versions(&self) -> CogniaResult<Vec<(String, Option<String>)>> {
        let url = "https://ziglang.org/download/index.json";

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "Failed to fetch Zig versions: {}",
                response.status()
            )));
        }

        let index: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))?;

        let platform_key = Self::get_platform_key();

        let obj = index
            .as_object()
            .ok_or_else(|| CogniaError::Parse("Invalid download index format".into()))?;

        let mut versions: Vec<(String, Option<String>)> = Vec::new();
        for (key, value) in obj {
            // The "master" key has a nested "version" field with the real version string.
            let version_str = if key == "master" {
                value
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or(key)
                    .to_string()
            } else {
                key.clone()
            };

            // Determine release date if available.
            let date = value.get("date").and_then(|d| d.as_str()).map(String::from);

            // Only include versions that have a build for the current platform.
            if let Some(pk) = platform_key {
                if value.get(pk).is_some() {
                    versions.push((version_str, date));
                }
            } else {
                versions.push((version_str, date));
            }
        }

        // Sort: stable versions (no '-') first in descending order, then dev versions.
        versions.sort_by(|a, b| {
            let a_stable = !a.0.contains('-');
            let b_stable = !b.0.contains('-');
            match (a_stable, b_stable) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => b.0.cmp(&a.0),
            }
        });

        Ok(versions)
    }

    /// Get the download URL for a specific version and the current platform.
    async fn get_download_url(&self, version: &str) -> CogniaResult<String> {
        let url = "https://ziglang.org/download/index.json";
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        let index: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))?;

        let platform_key = Self::get_platform_key()
            .ok_or_else(|| CogniaError::Provider("Unsupported platform".into()))?;

        // Find the version entry. Could be a direct key or "master".
        let entry = index.get(version).or_else(|| {
            // Check if version matches the master's "version" field.
            index.get("master").and_then(|m| {
                let master_ver = m.get("version").and_then(|v| v.as_str()).unwrap_or("");
                if master_ver == version {
                    Some(m)
                } else {
                    None
                }
            })
        });

        let entry = entry.ok_or_else(|| {
            CogniaError::Provider(format!("Version {} not found in index", version))
        })?;

        let tarball = entry
            .get(platform_key)
            .and_then(|p| p.get("tarball"))
            .and_then(|t| t.as_str())
            .ok_or_else(|| {
                CogniaError::Provider(format!(
                    "No download for platform {} version {}",
                    platform_key, version
                ))
            })?;

        Ok(tarball.to_string())
    }

    /// Scan the versions directory for installed Zig versions.
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
                        // Verify it's actually a Zig installation by checking for the binary
                        let zig_binary = if cfg!(windows) {
                            path.join("zig.exe")
                        } else {
                            path.join("zig")
                        };
                        if zig_binary.exists() {
                            versions.push((name.to_string(), path));
                        }
                    }
                }
            }
        }

        versions.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(versions)
    }

    /// Extract `.minimum_zig_version` from a `build.zig.zon` file.
    pub fn parse_build_zig_zon_version(content: &str) -> Option<String> {
        let re = regex::Regex::new(r#"\.minimum_zig_version\s*=\s*"([^"]+)""#).ok()?;
        re.captures(content)
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
    }
}

impl Default for ZigProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ZigProvider {
    fn id(&self) -> &str {
        "zig"
    }

    fn display_name(&self) -> &str {
        "Zig"
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
        // The provider is always "available" in the registry sense — it can manage
        // versions even if zig is not yet installed on PATH.
        // Check if we have a usable zig_dir or zig is on PATH.
        if self.zig_dir.is_some() {
            return true;
        }
        if process::which("zig").await.is_some() {
            return true;
        }
        false
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let versions = self.fetch_available_versions().await?;

        let results: Vec<PackageSummary> = versions
            .iter()
            .filter(|(v, _)| v.contains(query) || query.is_empty())
            .take(20)
            .map(|(version, _)| PackageSummary {
                name: format!("zig@{}", version),
                description: Some(
                    "Zig — General-purpose programming language and toolchain".into(),
                ),
                latest_version: Some(version.clone()),
                provider: self.id().to_string(),
            })
            .collect();

        Ok(results)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let version = name.strip_prefix("zig@").unwrap_or(name);

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Zig {}", version)),
            description: Some("Zig — General-purpose programming language and toolchain".into()),
            homepage: Some("https://ziglang.org".into()),
            license: Some("MIT".into()),
            repository: Some("https://github.com/ziglang/zig".into()),
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
        let versions = self.fetch_available_versions().await?;

        Ok(versions
            .into_iter()
            .map(|(version, date)| VersionInfo {
                version,
                release_date: date,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let version = req.version.as_deref().unwrap_or("latest");

        // Resolve "latest" to the actual latest stable version.
        let actual_version = if version == "latest" {
            let versions = self.fetch_available_versions().await?;
            versions
                .iter()
                .find(|(v, _)| !v.contains('-'))
                .or(versions.first())
                .map(|(v, _)| v.clone())
                .ok_or_else(|| CogniaError::Provider("No Zig versions available".into()))?
        } else {
            version.to_string()
        };

        let versions_dir = self.versions_dir()?;
        let install_path = versions_dir.join(&actual_version);

        if install_path.exists() && !req.force {
            return Ok(InstallReceipt {
                name: "zig".to_string(),
                version: actual_version,
                provider: self.id().to_string(),
                install_path,
                files: vec![],
                installed_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        // Get download URL
        let download_url = self.get_download_url(&actual_version).await?;

        // Download the archive
        let response = self
            .client
            .get(&download_url)
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

        // Extract archive to a temporary directory, then move
        let temp_dir = versions_dir.join(format!(".{}-tmp", actual_version));
        if temp_dir.exists() {
            tokio::fs::remove_dir_all(&temp_dir)
                .await
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }
        tokio::fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Save to temp file first, then extract using shell commands
        let archive_ext = if download_url.ends_with(".zip") {
            "zip"
        } else {
            "tar.xz"
        };
        let archive_path =
            versions_dir.join(format!(".{}-download.{}", actual_version, archive_ext));
        tokio::fs::write(&archive_path, &bytes)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Extract using shell commands (same approach as core::installer)
        let extract_result =
            crate::core::installer::extract_archive(&archive_path, &temp_dir).await;
        // Cleanup archive file regardless of result
        let _ = tokio::fs::remove_file(&archive_path).await;
        extract_result.map_err(|e| CogniaError::Provider(format!("Extraction failed: {}", e)))?;

        // The archive typically extracts to a subdirectory like zig-<platform>-<version>/
        // Move its contents to the final install path.
        if install_path.exists() {
            tokio::fs::remove_dir_all(&install_path)
                .await
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;
        }

        // Find the extracted subdirectory
        let extracted_dir = Self::find_extracted_dir(&temp_dir)?;
        tokio::fs::rename(&extracted_dir, &install_path)
            .await
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?;

        // Cleanup temp
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;

        Ok(InstallReceipt {
            name: "zig".to_string(),
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
                "Zig {} is not installed",
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
                    version.contains(f) || format!("zig@{}", version).contains(f)
                })
            })
            .map(|(version, path)| InstalledPackage {
                name: format!("zig@{}", version),
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
        let current = match self.get_zig_version().await {
            Ok(v) => v,
            Err(_) => return Ok(vec![]),
        };

        let versions = self.fetch_available_versions().await.unwrap_or_default();
        // Find latest stable version
        if let Some((latest, _)) = versions.iter().find(|(v, _)| !v.contains('-')) {
            if *latest != current {
                return Ok(vec![UpdateInfo {
                    name: "zig".into(),
                    current_version: current,
                    latest_version: latest.clone(),
                    provider: self.id().into(),
                }]);
            }
        }

        Ok(vec![])
    }
}

#[async_trait]
impl EnvironmentProvider for ZigProvider {
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
        match self.get_zig_version().await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        let version_path = self.versions_dir()?.join(version);
        if !version_path.exists() {
            return Err(CogniaError::Provider(format!(
                "Zig {} is not installed. Install it first.",
                version
            )));
        }

        let current_link = self.zig_dir()?.join("current");

        // Remove existing symlink/junction
        if current_link.exists() || current_link.is_symlink() {
            #[cfg(windows)]
            {
                if current_link.is_dir() {
                    // On Windows, junctions are removed with remove_dir
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
        let version_files = [".zig-version"];

        let mut current = start_path.to_path_buf();
        loop {
            // 1. Check version files
            for file_name in &version_files {
                let version_file = current.join(file_name);
                if version_file.exists() {
                    if let Ok(content) = crate::platform::fs::read_file_string(&version_file).await
                    {
                        let version = content.trim().to_string();
                        if !version.is_empty() {
                            return Ok(Some(VersionDetection {
                                version,
                                source: VersionSource::LocalFile,
                                source_path: Some(version_file),
                            }));
                        }
                    }
                }
            }

            // 2. Check .tool-versions
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("zig ") {
                            let version = line.strip_prefix("zig ").unwrap_or("").trim();
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

            // 3. Check build.zig.zon for minimum_zig_version
            let build_zig_zon = current.join("build.zig.zon");
            if build_zig_zon.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&build_zig_zon).await {
                    if let Some(version) = Self::parse_build_zig_zon_version(&content) {
                        return Ok(Some(VersionDetection {
                            version,
                            source: VersionSource::Manifest,
                            source_path: Some(build_zig_zon),
                        }));
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 4. Fall back to current version
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
        let version_path = self.versions_dir()?.join(version);
        Ok(EnvModifications::new().prepend_path(version_path))
    }

    fn version_file_name(&self) -> &str {
        ".zig-version"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl SystemPackageProvider for ZigProvider {
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

// ── Archive helpers ──

impl ZigProvider {
    /// Find the extracted subdirectory inside the temp directory.
    /// Zig archives typically extract to a directory like `zig-linux-x86_64-0.13.0/`.
    fn find_extracted_dir(temp_dir: &Path) -> CogniaResult<PathBuf> {
        let entries: Vec<_> = std::fs::read_dir(temp_dir)
            .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))?
            .flatten()
            .filter(|e| e.path().is_dir())
            .collect();

        if entries.len() == 1 {
            Ok(entries[0].path())
        } else {
            // If there's no single subdirectory, the temp_dir itself is the content
            Ok(temp_dir.to_path_buf())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let provider = ZigProvider::new();
        assert_eq!(provider.id(), "zig");
        assert_eq!(provider.display_name(), "Zig");
        assert!(provider.capabilities().contains(&Capability::Install));
        assert!(provider.capabilities().contains(&Capability::Uninstall));
        assert!(provider.capabilities().contains(&Capability::Search));
        assert!(provider.capabilities().contains(&Capability::List));
        assert!(provider.capabilities().contains(&Capability::VersionSwitch));
        assert!(provider.capabilities().contains(&Capability::MultiVersion));
        assert_eq!(provider.priority(), 80);
    }

    #[test]
    fn test_get_platform_key() {
        let key = ZigProvider::get_platform_key();
        // Should always produce a key on supported CI/development platforms
        assert!(key.is_some(), "Platform key should be available");
        let key = key.unwrap();
        assert!(
            key.contains('-'),
            "Platform key should be arch-os format: {}",
            key
        );
    }

    #[test]
    fn test_parse_zig_version_stable() {
        let output = "0.13.0\n";
        assert_eq!(
            ZigProvider::parse_zig_version_output(output),
            Some("0.13.0".to_string())
        );
    }

    #[test]
    fn test_parse_zig_version_dev() {
        let output = "0.16.0-dev.2637+6a9510c0e\n";
        assert_eq!(
            ZigProvider::parse_zig_version_output(output),
            Some("0.16.0-dev.2637+6a9510c0e".to_string())
        );
    }

    #[test]
    fn test_parse_zig_version_empty() {
        assert_eq!(ZigProvider::parse_zig_version_output(""), None);
        assert_eq!(ZigProvider::parse_zig_version_output("   \n"), None);
    }

    #[test]
    fn test_parse_build_zig_zon_version() {
        let content = r#".{
    .name = "my-project",
    .version = "0.1.0",
    .minimum_zig_version = "0.13.0",
    .dependencies = .{},
}"#;
        assert_eq!(
            ZigProvider::parse_build_zig_zon_version(content),
            Some("0.13.0".to_string())
        );
    }

    #[test]
    fn test_parse_build_zig_zon_no_version() {
        let content = r#".{
    .name = "my-project",
    .version = "0.1.0",
    .dependencies = .{},
}"#;
        assert_eq!(ZigProvider::parse_build_zig_zon_version(content), None);
    }

    #[test]
    fn test_parse_download_index() {
        let json = serde_json::json!({
            "0.13.0": {
                "date": "2024-06-07",
                "x86_64-linux": {
                    "tarball": "https://ziglang.org/builds/zig-x86_64-linux-0.13.0.tar.xz",
                    "shasum": "abc123",
                    "size": "12345"
                }
            },
            "master": {
                "version": "0.16.0-dev.2637+6a9510c0e",
                "date": "2026-02-20",
                "x86_64-linux": {
                    "tarball": "https://ziglang.org/builds/zig-x86_64-linux-0.16.0-dev.tar.xz",
                    "shasum": "def456",
                    "size": "67890"
                }
            }
        });

        let obj = json.as_object().unwrap();
        let mut versions = Vec::new();
        for (key, value) in obj {
            let version_str = if key == "master" {
                value
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or(key)
                    .to_string()
            } else {
                key.clone()
            };
            versions.push(version_str);
        }

        assert!(versions.contains(&"0.13.0".to_string()));
        assert!(versions.contains(&"0.16.0-dev.2637+6a9510c0e".to_string()));
    }

    #[test]
    fn test_detect_zig_dir() {
        let dir = ZigProvider::detect_zig_dir();
        // Should produce some path on any platform
        assert!(dir.is_some(), "Zig dir should be detectable");
    }
}
