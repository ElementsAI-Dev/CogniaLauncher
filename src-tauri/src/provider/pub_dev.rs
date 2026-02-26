use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use reqwest::Client;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Dart Pub - Package manager for Dart/Flutter (pub.dev)
///
/// Manages Dart packages via the `dart pub` CLI and pub.dev API.
/// Supports both global package installation and pub.dev search/info.
pub struct PubProvider {
    client: Client,
}

impl PubProvider {
    pub fn new() -> Self {
        Self {
            client: crate::platform::proxy::get_shared_client(),
        }
    }

    async fn run_dart(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("dart", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    async fn has_dart(&self) -> bool {
        process::which("dart").await.is_some()
    }

    async fn has_flutter(&self) -> bool {
        process::which("flutter").await.is_some()
    }

    async fn get_dart_version(&self) -> CogniaResult<String> {
        // dart --version may output to stderr, so use process::execute directly
        // to access both stdout and stderr from a single invocation.
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        let result = process::execute("dart", &["--version"], Some(opts)).await?;
        let text = if !result.stdout.trim().is_empty() {
            &result.stdout
        } else {
            &result.stderr
        };

        parse_dart_version(text)
            .ok_or_else(|| CogniaError::Provider("Could not parse Dart version".into()))
    }

    async fn fetch_package_info_json(&self, name: &str) -> CogniaResult<serde_json::Value> {
        let url = format!("https://pub.dev/api/packages/{}", name);
        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.pub.v2+json")
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "pub.dev API returned {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))
    }
}

impl Default for PubProvider {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse `dart --version` output to extract the version number.
/// Example: "Dart SDK version: 3.3.0 (stable) (Thu Feb 15 2024) on "windows_x64""
fn parse_dart_version(output: &str) -> Option<String> {
    let re = regex::Regex::new(r"Dart SDK version:\s*(\d+\.\d+\.\d+)").ok()?;
    re.captures(output)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

/// Parse `dart pub global list` output into package entries.
/// Each line is formatted as: `<package_name> <version>`
pub fn parse_global_list(stdout: &str) -> Vec<(String, String)> {
    let mut packages = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            packages.push((parts[0].to_string(), parts[1].to_string()));
        }
    }
    packages
}

#[async_trait]
impl Provider for PubProvider {
    fn id(&self) -> &str {
        "pub"
    }

    fn display_name(&self) -> &str {
        "Dart Pub"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        70
    }

    async fn is_available(&self) -> bool {
        if self.has_dart().await {
            return true;
        }
        self.has_flutter().await
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let url = format!("https://pub.dev/api/search?q={}", query);
        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.pub.v2+json")
            .send()
            .await
            .map_err(|e| CogniaError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CogniaError::Network(format!(
                "pub.dev search returned {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CogniaError::Parse(e.to_string()))?;

        let packages = json
            .get("packages")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut results = Vec::new();
        for (i, pkg) in packages.iter().enumerate() {
            if i >= 20 {
                break;
            }
            let name = pkg
                .get("package")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }

            // Fetch individual package info for description and version
            let (description, version) = if let Ok(info) = self.fetch_package_info_json(&name).await
            {
                let desc = info
                    .get("latest")
                    .and_then(|l| l.get("pubspec"))
                    .and_then(|p| p.get("description"))
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string());
                let ver = info
                    .get("latest")
                    .and_then(|l| l.get("version"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                (desc, ver)
            } else {
                (None, None)
            };

            results.push(PackageSummary {
                name,
                description,
                latest_version: version,
                provider: self.id().to_string(),
            });
        }

        Ok(results)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let json = self.fetch_package_info_json(name).await?;

        let latest = json.get("latest");
        let pubspec = latest.and_then(|l| l.get("pubspec"));

        let description = pubspec
            .and_then(|p| p.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let homepage = pubspec
            .and_then(|p| p.get("homepage"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let repository = pubspec
            .and_then(|p| p.get("repository"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let versions_array = json
            .get("versions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let versions: Vec<VersionInfo> = versions_array
            .iter()
            .filter_map(|v| {
                let version = v.get("version").and_then(|v| v.as_str())?.to_string();
                let date = v
                    .get("published")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let retracted = v
                    .get("retracted")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                Some(VersionInfo {
                    version,
                    release_date: date,
                    deprecated: false,
                    yanked: retracted,
                })
            })
            .collect();

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.to_string()),
            description,
            homepage,
            license: None,
            repository,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let name = &req.name;

        // Use dart pub global activate for global installs
        // Syntax: dart pub global activate <name> [--version <version>]
        let version_str;
        let mut args = vec!["pub", "global", "activate", name.as_str()];
        if let Some(ref v) = req.version {
            version_str = v.clone();
            args.push("--version");
            args.push(&version_str);
        }
        self.run_dart(&args).await?;

        let actual_version = req.version.clone().unwrap_or_else(|| "latest".to_string());

        Ok(InstallReceipt {
            name: name.clone(),
            version: actual_version,
            provider: self.id().to_string(),
            install_path: PathBuf::from(""),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_dart(&["pub", "global", "deactivate", &req.name])
            .await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_dart(&["pub", "global", "list"]).await?;
        let packages = parse_global_list(&output);

        let mut result = Vec::new();
        for (name, version) in packages {
            if let Some(ref name_filter) = filter.name_filter {
                if !name.contains(name_filter) {
                    continue;
                }
            }

            result.push(InstalledPackage {
                name,
                version,
                provider: self.id().into(),
                install_path: PathBuf::from(""),
                installed_at: String::new(),
                is_global: true,
            });
        }

        Ok(result)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in packages {
            let current = installed.iter().find(|p| &p.name == pkg);
            if let Some(current) = current {
                if let Ok(info) = self.fetch_package_info_json(&current.name).await {
                    let latest = info
                        .get("latest")
                        .and_then(|l| l.get("version"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if !latest.is_empty() && latest != current.version {
                        updates.push(UpdateInfo {
                            name: current.name.clone(),
                            current_version: current.version.clone(),
                            latest_version: latest.to_string(),
                            provider: self.id().into(),
                        });
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl SystemPackageProvider for PubProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        self.get_dart_version().await
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        if let Some(path) = process::which("dart").await {
            return Ok(PathBuf::from(path));
        }
        if let Some(path) = process::which("flutter").await {
            return Ok(PathBuf::from(path));
        }
        Err(CogniaError::Provider(
            "Neither dart nor flutter found in PATH".into(),
        ))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "Install Flutter SDK (includes Dart): https://flutter.dev/docs/get-started/install"
                .into(),
        )
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let packages = self.list_installed(InstalledFilter::default()).await?;
        Ok(packages.iter().any(|p| p.name == name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dart_version() {
        assert_eq!(
            parse_dart_version(
                "Dart SDK version: 3.3.0 (stable) (Thu Feb 15 2024) on \"windows_x64\""
            ),
            Some("3.3.0".to_string())
        );
    }

    #[test]
    fn test_parse_dart_version_stderr() {
        assert_eq!(
            parse_dart_version("Dart SDK version: 3.5.4 (stable) (Wed Oct 16 2024)"),
            Some("3.5.4".to_string())
        );
    }

    #[test]
    fn test_parse_dart_version_invalid() {
        assert_eq!(parse_dart_version("not a version"), None);
        assert_eq!(parse_dart_version(""), None);
    }

    #[test]
    fn test_parse_global_list() {
        let output = "fvm 3.2.1\ndevtools 2.28.1\nwebdev 3.3.0\n";
        let result = parse_global_list(output);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], ("fvm".to_string(), "3.2.1".to_string()));
        assert_eq!(result[1], ("devtools".to_string(), "2.28.1".to_string()));
        assert_eq!(result[2], ("webdev".to_string(), "3.3.0".to_string()));
    }

    #[test]
    fn test_parse_global_list_empty() {
        assert!(parse_global_list("").is_empty());
        assert!(parse_global_list("   \n  \n").is_empty());
    }

    #[test]
    fn test_parse_global_list_single_word() {
        // Lines with only one word should be skipped
        let output = "incomplete\nfvm 3.2.1\n";
        let result = parse_global_list(output);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], ("fvm".to_string(), "3.2.1".to_string()));
    }

    #[test]
    fn test_parse_dart_version_dev_channel() {
        assert_eq!(
            parse_dart_version(
                "Dart SDK version: 3.4.0-282.1.beta (beta) (Thu Mar 14 2024) on \"linux_x64\""
            ),
            Some("3.4.0".to_string())
        );
    }

    #[test]
    fn test_parse_dart_version_only_version_line() {
        // Some Dart versions only output the version line without platform info
        assert_eq!(
            parse_dart_version("Dart SDK version: 2.19.6"),
            Some("2.19.6".to_string())
        );
    }

    #[test]
    fn test_parse_dart_version_multiline() {
        // In some cases dart --version may emit extra lines
        let output =
            "Some preamble\nDart SDK version: 3.3.0 (stable) (Thu Feb 15 2024)\nSome footer";
        assert_eq!(parse_dart_version(output), Some("3.3.0".to_string()));
    }

    #[test]
    fn test_parse_global_list_extra_whitespace() {
        let output = "  fvm   3.2.1  \n  devtools   2.28.1  \n";
        let result = parse_global_list(output);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], ("fvm".to_string(), "3.2.1".to_string()));
        assert_eq!(result[1], ("devtools".to_string(), "2.28.1".to_string()));
    }

    #[test]
    fn test_parse_global_list_extra_fields_ignored() {
        // dart pub global list may include extra info after version
        let output = "fvm 3.2.1 (activated globally)\n";
        let result = parse_global_list(output);
        assert_eq!(result.len(), 1);
        // Only first two fields are used
        assert_eq!(result[0], ("fvm".to_string(), "3.2.1".to_string()));
    }

    #[test]
    fn test_provider_id_and_display_name() {
        let provider = PubProvider::new();
        assert_eq!(provider.id(), "pub");
        assert_eq!(provider.display_name(), "Dart Pub");
    }

    #[test]
    fn test_provider_capabilities() {
        let provider = PubProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(!caps.contains(&Capability::VersionSwitch));
        assert!(!caps.contains(&Capability::MultiVersion));
    }

    #[test]
    fn test_provider_supported_platforms() {
        let provider = PubProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_provider_priority() {
        let provider = PubProvider::new();
        assert_eq!(provider.priority(), 70);
    }

    #[test]
    fn test_requires_elevation_is_false() {
        let provider = PubProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }

    #[test]
    fn test_get_install_instructions() {
        let provider = PubProvider::new();
        let instructions = provider.get_install_instructions();
        assert!(instructions.is_some());
        let text = instructions.unwrap();
        assert!(
            text.contains("flutter.dev"),
            "Expected flutter.dev in instructions: {}",
            text
        );
    }

    #[test]
    fn test_default_creates_provider() {
        let provider = PubProvider::default();
        assert_eq!(provider.id(), "pub");
    }
}
