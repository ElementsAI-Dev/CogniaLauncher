use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use sha2::{Digest, Sha256};
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
        Self {
            zig_dir: Self::detect_zig_dir(),
            client: crate::platform::proxy::get_shared_client(),
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

    /// Get the download URL and optional SHA256 hash for a specific version and the current platform.
    async fn get_download_url(&self, version: &str) -> CogniaResult<(String, Option<String>)> {
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

        let platform_entry = entry.get(platform_key).ok_or_else(|| {
            CogniaError::Provider(format!(
                "No download for platform {} version {}",
                platform_key, version
            ))
        })?;

        let tarball = platform_entry
            .get("tarball")
            .and_then(|t| t.as_str())
            .ok_or_else(|| {
                CogniaError::Provider(format!(
                    "No tarball URL for platform {} version {}",
                    platform_key, version
                ))
            })?;

        let shasum = platform_entry
            .get("shasum")
            .and_then(|s| s.as_str())
            .map(String::from);

        Ok((tarball.to_string(), shasum))
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

    /// Extract Zig version from a `mise.toml` / `.mise.toml` file.
    pub fn parse_mise_toml_zig_version(content: &str) -> Option<String> {
        let mut in_tools = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed == "[tools]" {
                in_tools = true;
                continue;
            }
            if trimmed.starts_with('[') {
                in_tools = false;
                continue;
            }
            if in_tools {
                if let Some(rest) = trimmed.strip_prefix("zig") {
                    let rest = rest.trim();
                    if let Some(value) = rest.strip_prefix('=') {
                        let version = value.trim().trim_matches('"').trim_matches('\'').trim();
                        if !version.is_empty() {
                            return Some(version.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    /// Get directory modification time as RFC3339 string for installed_at.
    fn dir_installed_at(path: &Path) -> Option<String> {
        std::fs::metadata(path)
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            })
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
            Capability::Update,
            Capability::ProjectLocal,
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

        // Try to find release_date from the download index for this version
        let release_date = if version != "zig" {
            self.fetch_available_versions()
                .await
                .ok()
                .and_then(|versions| {
                    versions
                        .into_iter()
                        .find(|(v, _)| v == version)
                        .and_then(|(_, date)| date)
                })
        } else {
            None
        };

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(format!("Zig {}", version)),
            description: Some("Zig — General-purpose programming language and toolchain".into()),
            homepage: Some("https://ziglang.org".into()),
            license: Some("MIT".into()),
            repository: Some("https://github.com/ziglang/zig".into()),
            versions: vec![VersionInfo {
                version: version.to_string(),
                release_date,
                deprecated: false,
                yanked: false,
            }],
            provider: self.id().into(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        let version = name.strip_prefix("zig@").unwrap_or(name);
        let versions_dir = match self.versions_dir() {
            Ok(d) => d,
            Err(_) => return Ok(None),
        };
        let install_path = versions_dir.join(version);
        let zig_binary = if cfg!(windows) {
            install_path.join("zig.exe")
        } else {
            install_path.join("zig")
        };
        if zig_binary.exists() {
            Ok(Some(version.to_string()))
        } else {
            Ok(None)
        }
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

        // Get download URL and expected checksum
        let (download_url, expected_shasum) = self.get_download_url(&actual_version).await?;

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

        // Verify SHA256 checksum if provided by the download index
        if let Some(ref expected) = expected_shasum {
            let mut hasher = Sha256::new();
            hasher.update(&bytes);
            let actual = hex::encode(hasher.finalize());
            if actual != *expected {
                return Err(CogniaError::Provider(format!(
                    "Checksum mismatch for Zig {}: expected {}, got {}",
                    actual_version, expected, actual
                )));
            }
        }

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
            .map(|(version, path)| {
                let installed_at =
                    Self::dir_installed_at(&path).unwrap_or_default();
                InstalledPackage {
                    name: format!("zig@{}", version),
                    version,
                    provider: self.id().into(),
                    install_path: path,
                    installed_at,
                    is_global: true,
                }
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.scan_installed_versions().unwrap_or_default();
        if installed.is_empty() {
            return Ok(vec![]);
        }

        let versions = self.fetch_available_versions().await.unwrap_or_default();
        let latest_stable = versions
            .iter()
            .find(|(v, _)| !v.contains('-'))
            .map(|(v, _)| v.clone());

        let Some(latest) = latest_stable else {
            return Ok(vec![]);
        };

        let mut updates = Vec::new();
        for (version, _) in &installed {
            if !version.contains('-') && *version != latest {
                updates.push(UpdateInfo {
                    name: format!("zig@{}", version),
                    current_version: version.clone(),
                    latest_version: latest.clone(),
                    provider: self.id().into(),
                });
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl EnvironmentProvider for ZigProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let current = self.get_current_version().await?.unwrap_or_default();
        let installed = self.scan_installed_versions()?;

        Ok(installed
            .into_iter()
            .map(|(version, path)| {
                let installed_at = Self::dir_installed_at(&path);
                InstalledVersion {
                    is_current: version == current,
                    version,
                    install_path: path,
                    size: None,
                    installed_at,
                }
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

            // 3. Check mise.toml / .mise.toml
            for mise_name in &["mise.toml", ".mise.toml"] {
                let mise_file = current.join(mise_name);
                if mise_file.exists() {
                    if let Ok(content) =
                        crate::platform::fs::read_file_string(&mise_file).await
                    {
                        if let Some(version) = Self::parse_mise_toml_zig_version(&content) {
                            return Ok(Some(VersionDetection {
                                version,
                                source: VersionSource::LocalFile,
                                source_path: Some(mise_file),
                            }));
                        }
                    }
                }
            }

            // 4. Check build.zig.zon for minimum_zig_version
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
        let version_path = self.versions_dir()?.join(version);
        let mut mods = EnvModifications::new().prepend_path(&version_path);
        let lib_dir = version_path.join("lib");
        if lib_dir.exists() {
            mods = mods.set_var("ZIG_LIB_DIR", lib_dir.to_string_lossy().to_string());
        }
        Ok(mods)
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

    async fn get_version(&self) -> CogniaResult<String> {
        self.get_zig_version().await
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        if let Some(path) = process::which("zig").await {
            return Ok(PathBuf::from(path));
        }
        // Fallback to managed current symlink
        if let Ok(zig_dir) = self.zig_dir() {
            let current_bin = if cfg!(windows) {
                zig_dir.join("current").join("zig.exe")
            } else {
                zig_dir.join("current").join("zig")
            };
            if current_bin.exists() {
                return Ok(current_bin);
            }
        }
        Err(CogniaError::Provider("zig not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        if cfg!(windows) {
            Some("winget install zig.zig  OR  scoop install zig".into())
        } else if cfg!(target_os = "macos") {
            Some("brew install zig".into())
        } else {
            Some("Download from https://ziglang.org/download/".into())
        }
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
    use std::fs;

    // ── Helper: create a ZigProvider with a custom zig_dir ──

    fn provider_with_dir(dir: &Path) -> ZigProvider {
        ZigProvider {
            zig_dir: Some(dir.to_path_buf()),
            client: reqwest::Client::new(),
        }
    }

    /// Create a fake Zig installation directory with a dummy binary.
    fn create_fake_zig_install(versions_dir: &Path, version: &str) -> PathBuf {
        let version_path = versions_dir.join(version);
        fs::create_dir_all(&version_path).unwrap();
        let binary_name = if cfg!(windows) { "zig.exe" } else { "zig" };
        fs::write(version_path.join(binary_name), b"fake-zig-binary").unwrap();
        version_path
    }

    // ════════════════════════════════════════════════════════════════
    //  Provider metadata & basic trait methods
    // ════════════════════════════════════════════════════════════════

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
        assert!(provider.capabilities().contains(&Capability::Update));
        assert!(provider.capabilities().contains(&Capability::ProjectLocal));
        assert_eq!(provider.capabilities().len(), 8);
        assert_eq!(provider.priority(), 80);
    }

    #[test]
    fn test_supported_platforms() {
        let provider = ZigProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 3);
    }

    #[test]
    fn test_version_file_name() {
        let provider = ZigProvider::new();
        assert_eq!(provider.version_file_name(), ".zig-version");
    }

    #[test]
    fn test_requires_elevation() {
        let provider = ZigProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
        assert!(!provider.requires_elevation("update"));
    }

    #[test]
    fn test_default_trait() {
        let provider = ZigProvider::default();
        assert_eq!(provider.id(), "zig");
        assert!(provider.zig_dir.is_some());
    }

    // ════════════════════════════════════════════════════════════════
    //  Platform key detection
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_get_platform_key() {
        let key = ZigProvider::get_platform_key();
        assert!(key.is_some(), "Platform key should be available");
        let key = key.unwrap();
        assert!(
            key.contains('-'),
            "Platform key should be arch-os format: {}",
            key
        );
        // Must match one of the known platform keys
        let valid_keys = [
            "x86_64-windows", "aarch64-windows", "x86-windows",
            "x86_64-macos", "aarch64-macos",
            "x86_64-linux", "aarch64-linux", "arm-linux", "x86-linux",
        ];
        assert!(
            valid_keys.contains(&key),
            "Platform key '{}' not in valid set",
            key
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  Version output parsing
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_parse_zig_version_stable() {
        assert_eq!(
            ZigProvider::parse_zig_version_output("0.13.0\n"),
            Some("0.13.0".to_string())
        );
    }

    #[test]
    fn test_parse_zig_version_dev() {
        assert_eq!(
            ZigProvider::parse_zig_version_output("0.16.0-dev.2637+6a9510c0e\n"),
            Some("0.16.0-dev.2637+6a9510c0e".to_string())
        );
    }

    #[test]
    fn test_parse_zig_version_empty() {
        assert_eq!(ZigProvider::parse_zig_version_output(""), None);
        assert_eq!(ZigProvider::parse_zig_version_output("   \n"), None);
        assert_eq!(ZigProvider::parse_zig_version_output("\n\n"), None);
    }

    #[test]
    fn test_parse_zig_version_multiline() {
        // Only the first line should be used
        let output = "0.13.0\nsome other garbage\n";
        assert_eq!(
            ZigProvider::parse_zig_version_output(output),
            Some("0.13.0".to_string())
        );
    }

    #[test]
    fn test_parse_zig_version_with_leading_whitespace() {
        assert_eq!(
            ZigProvider::parse_zig_version_output("  0.13.0  \n"),
            Some("0.13.0".to_string())
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  build.zig.zon parsing
    // ════════════════════════════════════════════════════════════════

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
    fn test_parse_build_zig_zon_dev_version() {
        let content = r#".{
    .minimum_zig_version = "0.14.0-dev.367+a69f40316",
}"#;
        assert_eq!(
            ZigProvider::parse_build_zig_zon_version(content),
            Some("0.14.0-dev.367+a69f40316".to_string())
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
    fn test_parse_build_zig_zon_extra_whitespace() {
        let content = r#".{
    .minimum_zig_version  =  "0.12.0",
}"#;
        assert_eq!(
            ZigProvider::parse_build_zig_zon_version(content),
            Some("0.12.0".to_string())
        );
    }

    // ════════════════════════════════════════════════════════════════
    //  mise.toml parsing
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_parse_mise_toml_zig_version() {
        let content = "[tools]\nzig = \"0.13.0\"\ndeno = \"1.45.0\"\n";
        assert_eq!(
            ZigProvider::parse_mise_toml_zig_version(content),
            Some("0.13.0".to_string())
        );
    }

    #[test]
    fn test_parse_mise_toml_zig_version_single_quotes() {
        let content = "[tools]\nzig = '0.14.0'\n";
        assert_eq!(
            ZigProvider::parse_mise_toml_zig_version(content),
            Some("0.14.0".to_string())
        );
    }

    #[test]
    fn test_parse_mise_toml_no_zig() {
        let content = "[tools]\nnode = \"20.0.0\"\n";
        assert_eq!(ZigProvider::parse_mise_toml_zig_version(content), None);
    }

    #[test]
    fn test_parse_mise_toml_empty() {
        assert_eq!(ZigProvider::parse_mise_toml_zig_version(""), None);
    }

    #[test]
    fn test_parse_mise_toml_zig_in_wrong_section() {
        // zig key outside of [tools] should NOT match
        let content = "[settings]\nzig = \"0.13.0\"\n";
        assert_eq!(ZigProvider::parse_mise_toml_zig_version(content), None);
    }

    #[test]
    fn test_parse_mise_toml_zig_after_section_switch() {
        // zig in [tools] then another section resets state
        let content = "[tools]\nnode = \"20\"\n[settings]\nzig = \"0.13.0\"\n";
        assert_eq!(ZigProvider::parse_mise_toml_zig_version(content), None);
    }

    #[test]
    fn test_parse_mise_toml_zig_with_spaces() {
        let content = "[tools]\n  zig  =  \"0.14.0\"  \n";
        assert_eq!(
            ZigProvider::parse_mise_toml_zig_version(content),
            Some("0.14.0".to_string())
        );
    }

    #[test]
    fn test_parse_mise_toml_no_prefix_collision() {
        // "zigbee" should NOT match as "zig"
        let content = "[tools]\nzigbee = \"1.0.0\"\n";
        assert_eq!(ZigProvider::parse_mise_toml_zig_version(content), None);
    }

    // ════════════════════════════════════════════════════════════════
    //  Download index parsing
    // ════════════════════════════════════════════════════════════════

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
    fn test_parse_download_index_shasum_extraction() {
        let json = serde_json::json!({
            "0.13.0": {
                "x86_64-windows": {
                    "tarball": "https://ziglang.org/builds/zig.zip",
                    "shasum": "abcdef1234567890"
                }
            }
        });
        let entry = json.get("0.13.0").unwrap();
        let platform = entry.get("x86_64-windows").unwrap();
        let shasum = platform.get("shasum").and_then(|s| s.as_str());
        assert_eq!(shasum, Some("abcdef1234567890"));
    }

    // ════════════════════════════════════════════════════════════════
    //  Directory & filesystem helpers
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_detect_zig_dir() {
        let dir = ZigProvider::detect_zig_dir();
        assert!(dir.is_some(), "Zig dir should be detectable");
    }

    #[test]
    fn test_zig_dir_returns_correct_path() {
        let tmp = tempfile::tempdir().unwrap();
        let provider = provider_with_dir(tmp.path());
        assert_eq!(provider.zig_dir().unwrap(), tmp.path());
    }

    #[test]
    fn test_zig_dir_none_returns_error() {
        let provider = ZigProvider {
            zig_dir: None,
            client: reqwest::Client::new(),
        };
        assert!(provider.zig_dir().is_err());
    }

    #[test]
    fn test_versions_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let provider = provider_with_dir(tmp.path());
        assert_eq!(provider.versions_dir().unwrap(), tmp.path().join("versions"));
    }

    #[test]
    fn test_dir_installed_at_nonexistent() {
        let result = ZigProvider::dir_installed_at(Path::new("/nonexistent/path/zig-test"));
        assert!(result.is_none());
    }

    #[test]
    fn test_dir_installed_at_real_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let result = ZigProvider::dir_installed_at(tmp.path());
        assert!(result.is_some(), "Temp dir should have metadata");
        let ts = result.unwrap();
        assert!(ts.contains('T'), "Should be RFC3339 format: {}", ts);
        // Basic RFC3339 validation: contains date separators
        assert!(ts.contains('-'), "RFC3339 should contain dashes: {}", ts);
    }

    // ════════════════════════════════════════════════════════════════
    //  scan_installed_versions (filesystem tests)
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_scan_installed_versions_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();
        let provider = provider_with_dir(tmp.path());
        let versions = provider.scan_installed_versions().unwrap();
        assert!(versions.is_empty());
    }

    #[test]
    fn test_scan_installed_versions_nonexistent_dir() {
        let tmp = tempfile::tempdir().unwrap();
        // versions dir doesn't exist at all
        let provider = provider_with_dir(tmp.path());
        let versions = provider.scan_installed_versions().unwrap();
        assert!(versions.is_empty());
    }

    #[test]
    fn test_scan_installed_versions_with_installs() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");
        create_fake_zig_install(&versions_dir, "0.12.0");

        let provider = provider_with_dir(tmp.path());
        let versions = provider.scan_installed_versions().unwrap();
        assert_eq!(versions.len(), 2);
        // Should be sorted descending
        assert_eq!(versions[0].0, "0.13.0");
        assert_eq!(versions[1].0, "0.12.0");
    }

    #[test]
    fn test_scan_installed_versions_ignores_non_zig_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");

        // Create a valid install
        create_fake_zig_install(&versions_dir, "0.13.0");

        // Create a directory WITHOUT a zig binary — should be skipped
        let fake_dir = versions_dir.join("not-zig");
        fs::create_dir_all(&fake_dir).unwrap();
        fs::write(fake_dir.join("something-else.txt"), b"nope").unwrap();

        let provider = provider_with_dir(tmp.path());
        let versions = provider.scan_installed_versions().unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].0, "0.13.0");
    }

    #[test]
    fn test_scan_installed_versions_ignores_files() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();

        // Create a file (not dir) — should be skipped
        fs::write(versions_dir.join("0.13.0"), b"i am a file").unwrap();

        let provider = provider_with_dir(tmp.path());
        let versions = provider.scan_installed_versions().unwrap();
        assert!(versions.is_empty());
    }

    // ════════════════════════════════════════════════════════════════
    //  find_extracted_dir
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_find_extracted_dir_single_subdir() {
        let tmp = tempfile::tempdir().unwrap();
        let sub = tmp.path().join("zig-linux-x86_64-0.13.0");
        fs::create_dir_all(&sub).unwrap();

        let result = ZigProvider::find_extracted_dir(tmp.path()).unwrap();
        assert_eq!(result, sub);
    }

    #[test]
    fn test_find_extracted_dir_no_subdir() {
        let tmp = tempfile::tempdir().unwrap();
        // No subdirectory, just files
        fs::write(tmp.path().join("zig.exe"), b"binary").unwrap();

        let result = ZigProvider::find_extracted_dir(tmp.path()).unwrap();
        assert_eq!(result, tmp.path());
    }

    #[test]
    fn test_find_extracted_dir_multiple_subdirs() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("dir1")).unwrap();
        fs::create_dir_all(tmp.path().join("dir2")).unwrap();

        let result = ZigProvider::find_extracted_dir(tmp.path()).unwrap();
        // With multiple dirs, returns the temp_dir itself
        assert_eq!(result, tmp.path());
    }

    // ════════════════════════════════════════════════════════════════
    //  get_env_modifications
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_get_env_modifications_path_prepend() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        let mods = provider.get_env_modifications("0.13.0").unwrap();
        assert_eq!(mods.path_prepend.len(), 1);
        assert_eq!(mods.path_prepend[0], versions_dir.join("0.13.0"));
    }

    #[test]
    fn test_get_env_modifications_zig_lib_dir_when_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        let version_path = create_fake_zig_install(&versions_dir, "0.13.0");
        // Create lib dir
        let lib_dir = version_path.join("lib");
        fs::create_dir_all(&lib_dir).unwrap();

        let provider = provider_with_dir(tmp.path());
        let mods = provider.get_env_modifications("0.13.0").unwrap();
        assert_eq!(
            mods.set_variables.get("ZIG_LIB_DIR"),
            Some(&lib_dir.to_string_lossy().to_string())
        );
    }

    #[test]
    fn test_get_env_modifications_no_zig_lib_dir_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");
        // No lib dir created

        let provider = provider_with_dir(tmp.path());
        let mods = provider.get_env_modifications("0.13.0").unwrap();
        assert!(mods.set_variables.get("ZIG_LIB_DIR").is_none());
    }

    // ════════════════════════════════════════════════════════════════
    //  get_install_instructions
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_get_install_instructions() {
        let provider = ZigProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some(), "Install instructions should be available");
        let text = instructions.unwrap();
        assert!(!text.is_empty());
        assert!(
            text.to_lowercase().contains("zig"),
            "Instructions should mention zig: {}",
            text
        );
        // Platform-specific check
        if cfg!(windows) {
            assert!(text.contains("winget"), "Windows instructions should mention winget");
        } else if cfg!(target_os = "macos") {
            assert!(text.contains("brew"), "macOS instructions should mention brew");
        } else {
            assert!(text.contains("ziglang.org"), "Linux instructions should mention ziglang.org");
        }
    }

    // ════════════════════════════════════════════════════════════════
    //  SHA256 checksum verification
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_sha256_checksum_computation() {
        let data = b"hello zig world";
        let mut hasher = Sha256::new();
        hasher.update(data);
        let hash = hex::encode(hasher.finalize());
        // Known SHA256 of "hello zig world"
        assert_eq!(hash.len(), 64, "SHA256 hex should be 64 chars");
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

        // Verify reproducibility
        let mut hasher2 = Sha256::new();
        hasher2.update(data);
        let hash2 = hex::encode(hasher2.finalize());
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_sha256_different_data_different_hash() {
        let mut h1 = Sha256::new();
        h1.update(b"data1");
        let hash1 = hex::encode(h1.finalize());

        let mut h2 = Sha256::new();
        h2.update(b"data2");
        let hash2 = hex::encode(h2.finalize());

        assert_ne!(hash1, hash2);
    }

    // ════════════════════════════════════════════════════════════════
    //  Async tests: get_installed_version, list_installed, is_available
    // ════════════════════════════════════════════════════════════════

    #[tokio::test]
    async fn test_get_installed_version_found() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        let result = provider.get_installed_version("zig@0.13.0").await.unwrap();
        assert_eq!(result, Some("0.13.0".to_string()));
    }

    #[tokio::test]
    async fn test_get_installed_version_not_found() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();

        let provider = provider_with_dir(tmp.path());
        let result = provider.get_installed_version("zig@0.99.0").await.unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_get_installed_version_without_prefix() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        // Without zig@ prefix should also work
        let result = provider.get_installed_version("0.13.0").await.unwrap();
        assert_eq!(result, Some("0.13.0".to_string()));
    }

    #[tokio::test]
    async fn test_get_installed_version_no_zig_dir() {
        let provider = ZigProvider {
            zig_dir: None,
            client: reqwest::Client::new(),
        };
        let result = provider.get_installed_version("zig@0.13.0").await.unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_is_available_with_zig_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let provider = provider_with_dir(tmp.path());
        assert!(provider.is_available().await);
    }

    #[tokio::test]
    async fn test_list_installed_with_filter() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");
        create_fake_zig_install(&versions_dir, "0.12.0");

        let provider = provider_with_dir(tmp.path());

        // No filter — should return all
        let all = provider
            .list_installed(InstalledFilter {
                name_filter: None,
                ..Default::default()
            })
            .await
            .unwrap();
        assert_eq!(all.len(), 2);

        // Filter by version substring
        let filtered = provider
            .list_installed(InstalledFilter {
                name_filter: Some("0.13".into()),
                ..Default::default()
            })
            .await
            .unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].version, "0.13.0");
    }

    #[tokio::test]
    async fn test_list_installed_installed_at_populated() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        let packages = provider
            .list_installed(InstalledFilter::default())
            .await
            .unwrap();
        assert_eq!(packages.len(), 1);
        // installed_at should be populated (not empty)
        assert!(
            !packages[0].installed_at.is_empty(),
            "installed_at should be populated from filesystem metadata"
        );
        assert!(
            packages[0].installed_at.contains('T'),
            "installed_at should be RFC3339: {}",
            packages[0].installed_at
        );
    }

    #[tokio::test]
    async fn test_list_installed_versions_installed_at_populated() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        let versions = provider.list_installed_versions().await.unwrap();
        assert_eq!(versions.len(), 1);
        assert!(
            versions[0].installed_at.is_some(),
            "installed_at should be Some from filesystem metadata"
        );
    }

    #[tokio::test]
    async fn test_is_package_installed_true() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        create_fake_zig_install(&versions_dir, "0.13.0");

        let provider = provider_with_dir(tmp.path());
        assert!(provider.is_package_installed("0.13.0").await.unwrap());
    }

    #[tokio::test]
    async fn test_is_package_installed_false() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();

        let provider = provider_with_dir(tmp.path());
        assert!(!provider.is_package_installed("0.99.0").await.unwrap());
    }

    #[tokio::test]
    async fn test_uninstall_nonexistent_version() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();

        let provider = provider_with_dir(tmp.path());
        let result = provider
            .uninstall(UninstallRequest {
                name: "zig".into(),
                version: Some("0.99.0".into()),
                force: false,
            })
            .await;
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("not installed"), "Error should mention not installed: {}", err);
    }

    #[tokio::test]
    async fn test_uninstall_requires_version() {
        let tmp = tempfile::tempdir().unwrap();
        let provider = provider_with_dir(tmp.path());
        let result = provider
            .uninstall(UninstallRequest {
                name: "zig".into(),
                version: None,
                force: false,
            })
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_uninstall_success() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        let version_path = create_fake_zig_install(&versions_dir, "0.13.0");
        assert!(version_path.exists());

        let provider = provider_with_dir(tmp.path());
        provider
            .uninstall(UninstallRequest {
                name: "zig".into(),
                version: Some("0.13.0".into()),
                force: false,
            })
            .await
            .unwrap();
        assert!(!version_path.exists(), "Version directory should be removed");
    }

    // ════════════════════════════════════════════════════════════════
    //  detect_version (async filesystem tests)
    // ════════════════════════════════════════════════════════════════

    #[tokio::test]
    async fn test_detect_version_from_zig_version_file() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join(".zig-version"), "0.13.0\n").unwrap();

        let provider = provider_with_dir(tmp.path());
        let detection = provider.detect_version(tmp.path()).await.unwrap();
        assert!(detection.is_some());
        let det = detection.unwrap();
        assert_eq!(det.version, "0.13.0");
        assert!(matches!(det.source, VersionSource::LocalFile));
    }

    #[tokio::test]
    async fn test_detect_version_from_tool_versions() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join(".tool-versions"), "zig 0.12.0\nnode 20.0.0\n").unwrap();

        let provider = provider_with_dir(tmp.path());
        let detection = provider.detect_version(tmp.path()).await.unwrap();
        assert!(detection.is_some());
        let det = detection.unwrap();
        assert_eq!(det.version, "0.12.0");
    }

    #[tokio::test]
    async fn test_detect_version_from_mise_toml() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(
            tmp.path().join("mise.toml"),
            "[tools]\nzig = \"0.14.0\"\n",
        )
        .unwrap();

        let provider = provider_with_dir(tmp.path());
        let detection = provider.detect_version(tmp.path()).await.unwrap();
        assert!(detection.is_some());
        let det = detection.unwrap();
        assert_eq!(det.version, "0.14.0");
        assert!(matches!(det.source, VersionSource::LocalFile));
    }

    #[tokio::test]
    async fn test_detect_version_from_dot_mise_toml() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(
            tmp.path().join(".mise.toml"),
            "[tools]\nzig = \"0.11.0\"\n",
        )
        .unwrap();

        let provider = provider_with_dir(tmp.path());
        let detection = provider.detect_version(tmp.path()).await.unwrap();
        assert!(detection.is_some());
        assert_eq!(detection.unwrap().version, "0.11.0");
    }

    #[tokio::test]
    async fn test_detect_version_from_build_zig_zon() {
        let tmp = tempfile::tempdir().unwrap();
        let zon = r#".{
    .name = "test",
    .minimum_zig_version = "0.12.0",
}"#;
        fs::write(tmp.path().join("build.zig.zon"), zon).unwrap();

        let provider = provider_with_dir(tmp.path());
        let detection = provider.detect_version(tmp.path()).await.unwrap();
        assert!(detection.is_some());
        let det = detection.unwrap();
        assert_eq!(det.version, "0.12.0");
        assert!(matches!(det.source, VersionSource::Manifest));
    }

    #[tokio::test]
    async fn test_detect_version_priority_order() {
        let tmp = tempfile::tempdir().unwrap();
        // Create all version sources — .zig-version should win
        fs::write(tmp.path().join(".zig-version"), "0.13.0").unwrap();
        fs::write(tmp.path().join(".tool-versions"), "zig 0.12.0\n").unwrap();
        fs::write(
            tmp.path().join("mise.toml"),
            "[tools]\nzig = \"0.11.0\"\n",
        )
        .unwrap();
        let zon = r#".{ .minimum_zig_version = "0.10.0" }"#;
        fs::write(tmp.path().join("build.zig.zon"), zon).unwrap();

        let provider = provider_with_dir(tmp.path());
        let det = provider.detect_version(tmp.path()).await.unwrap().unwrap();
        assert_eq!(det.version, "0.13.0", ".zig-version should have highest priority");
    }

    #[tokio::test]
    async fn test_detect_version_empty_zig_version_file_falls_through() {
        let tmp = tempfile::tempdir().unwrap();
        // Empty .zig-version should be skipped
        fs::write(tmp.path().join(".zig-version"), "  \n").unwrap();
        fs::write(tmp.path().join(".tool-versions"), "zig 0.12.0\n").unwrap();

        let provider = provider_with_dir(tmp.path());
        let det = provider.detect_version(tmp.path()).await.unwrap().unwrap();
        assert_eq!(det.version, "0.12.0", "Should fall through to .tool-versions");
    }

    // ════════════════════════════════════════════════════════════════
    //  set_global_version
    // ════════════════════════════════════════════════════════════════

    #[tokio::test]
    async fn test_set_global_version_not_installed() {
        let tmp = tempfile::tempdir().unwrap();
        let versions_dir = tmp.path().join("versions");
        fs::create_dir_all(&versions_dir).unwrap();

        let provider = provider_with_dir(tmp.path());
        let result = provider.set_global_version("0.99.0").await;
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("not installed"), "Error: {}", err);
    }
}
