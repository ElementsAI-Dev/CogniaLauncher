use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

/// Nix - Purely functional package manager
///
/// Nix provides reproducible, declarative, and reliable package management.
/// Supports both `nix profile` (new CLI) and `nix-env` (legacy CLI).
/// Packages come from Nixpkgs, the largest repository of Nix packages.
pub struct NixProvider {
    /// Cached detection of whether the new `nix` CLI is available (Nix 2.4+)
    use_new_cli: OnceLock<bool>,
}

impl NixProvider {
    pub fn new() -> Self {
        Self {
            use_new_cli: OnceLock::new(),
        }
    }

    /// Check and cache whether the new `nix profile` CLI is available (Nix 2.4+).
    /// The result is cached in `self.use_new_cli` after the first detection.
    async fn should_use_new_cli(&self) -> bool {
        if let Some(&cached) = self.use_new_cli.get() {
            return cached;
        }
        let detected = if let Ok(out) = process::execute("nix", &["profile", "--help"], None).await
        {
            out.success
        } else {
            false
        };
        *self.use_new_cli.get_or_init(|| detected)
    }

    async fn run_nix(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let out = process::execute("nix", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn run_nix_env(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(300));
        let out = process::execute("nix-env", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get Nix store path
    fn nix_store_path() -> PathBuf {
        PathBuf::from("/nix/store")
    }

    /// Get user profile path
    fn profile_path() -> PathBuf {
        if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".nix-profile")
        } else {
            PathBuf::from("/nix/var/nix/profiles/default")
        }
    }
}

impl Default for NixProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for NixProvider {
    fn id(&self) -> &str {
        "nix"
    }

    fn display_name(&self) -> &str {
        "Nix Package Manager"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        70
    }

    async fn is_available(&self) -> bool {
        // Check for nix-env (legacy) or nix (new)
        if process::which("nix").await.is_some() {
            if let Ok(out) = process::execute("nix", &["--version"], None).await {
                if out.success && !out.stdout.is_empty() {
                    return true;
                }
            }
        }
        if process::which("nix-env").await.is_some() {
            if let Ok(out) = process::execute("nix-env", &["--version"], None).await {
                return out.success;
            }
        }
        false
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);

        // Try new nix search first (outputs JSON)
        if let Ok(out) = self.run_nix(&["search", "nixpkgs", query, "--json"]).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
                if let Some(obj) = json.as_object() {
                    return Ok(obj
                        .iter()
                        .take(limit)
                        .filter_map(|(key, val)| {
                            // Key format: "legacyPackages.x86_64-linux.package_name"
                            let name = key.rsplit('.').next()?.to_string();
                            let description = val["description"].as_str().map(|s| s.to_string());
                            let version = val["version"].as_str().map(|s| s.to_string());

                            Some(PackageSummary {
                                name,
                                description,
                                latest_version: version,
                                provider: self.id().into(),
                            })
                        })
                        .collect());
                }
            }
        }

        // Fallback to nix-env search
        let out = self.run_nix_env(&["-qaP", query]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                let attr = parts.first()?.to_string();
                // Extract package name from attribute path (e.g., "nixpkgs.hello" -> "hello")
                let name = attr.rsplit('.').next().unwrap_or(&attr).to_string();

                Some(PackageSummary {
                    name,
                    description: None,
                    latest_version: parts.get(1).map(|s| s.to_string()),
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try nix search for metadata
        let search_arg = format!("^{}$", name);
        if let Ok(out) = self
            .run_nix(&["search", "nixpkgs", &search_arg, "--json"])
            .await
        {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
                if let Some(obj) = json.as_object() {
                    if let Some((_, val)) = obj.iter().next() {
                        return Ok(PackageInfo {
                            name: name.into(),
                            display_name: Some(val["pname"].as_str().unwrap_or(name).to_string()),
                            description: val["description"].as_str().map(|s| s.to_string()),
                            homepage: None,
                            license: None,
                            repository: Some("https://github.com/NixOS/nixpkgs".into()),
                            versions: val["version"]
                                .as_str()
                                .map(|v| {
                                    vec![VersionInfo {
                                        version: v.to_string(),
                                        release_date: None,
                                        deprecated: false,
                                        yanked: false,
                                    }]
                                })
                                .unwrap_or_default(),
                            provider: self.id().into(),
                        });
                    }
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: None,
            homepage: None,
            license: None,
            repository: Some("https://github.com/NixOS/nixpkgs".into()),
            versions: vec![],
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Nix packages typically have a single version from the current channel
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let use_new = self.should_use_new_cli().await;

        if use_new {
            let pkg = format!("nixpkgs#{}", req.name);
            self.run_nix(&["profile", "install", &pkg]).await?;
        } else {
            self.run_nix_env(&["-iA", &format!("nixpkgs.{}", req.name)])
                .await?;
        }

        // Get installed version
        let actual_version = if let Ok(info) = self.get_package_info(&req.name).await {
            info.versions
                .first()
                .map(|v| v.version.clone())
                .unwrap_or_else(|| "unknown".into())
        } else {
            "unknown".into()
        };

        // Resolve install path: new CLI uses nix store, legacy uses user profile
        let install_path = if use_new {
            Self::nix_store_path()
        } else {
            Self::profile_path()
        };

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
        // Check installed packages
        let out = self.run_nix_env(&["-q", name]).await;
        if let Ok(output) = out {
            let line = output.trim();
            if !line.is_empty() {
                // Output format: "package-name-version"
                // Try to extract version from the end
                if let Some(pos) = line.rfind('-') {
                    let potential_version = &line[pos + 1..];
                    if potential_version
                        .chars()
                        .next()
                        .is_some_and(|c| c.is_ascii_digit())
                    {
                        return Ok(Some(potential_version.to_string()));
                    }
                }
                return Ok(Some(line.to_string()));
            }
        }
        Ok(None)
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let use_new = self.should_use_new_cli().await;

        if use_new {
            // nix profile remove requires index or regex
            let pkg = format!("nixpkgs#{}", req.name);
            self.run_nix(&["profile", "remove", &pkg]).await?;
        } else {
            self.run_nix_env(&["-e", &req.name]).await?;
        }

        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let use_new = self.should_use_new_cli().await;
        let nix_store = Self::nix_store_path();

        if use_new {
            // nix profile list --json
            if let Ok(out) = self.run_nix(&["profile", "list", "--json"]).await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&out) {
                    if let Some(elements) = json["elements"].as_array() {
                        return Ok(elements
                            .iter()
                            .filter_map(|elem| {
                                let store_paths = elem["storePaths"].as_array()?;
                                let store_path = store_paths.first()?["path"]
                                    .as_str()
                                    .or_else(|| store_paths.first()?.as_str())?;

                                // Extract name from store path: /nix/store/hash-name-version
                                let path_part = store_path.rsplit('/').next()?;
                                let name_version =
                                    path_part.split_once('-').map(|(_, rest)| rest)?;

                                let (name, version) = if let Some(pos) = name_version.rfind('-') {
                                    let potential_ver = &name_version[pos + 1..];
                                    if potential_ver
                                        .chars()
                                        .next()
                                        .is_some_and(|c| c.is_ascii_digit())
                                    {
                                        (name_version[..pos].to_string(), potential_ver.to_string())
                                    } else {
                                        (name_version.to_string(), "unknown".to_string())
                                    }
                                } else {
                                    (name_version.to_string(), "unknown".to_string())
                                };

                                if let Some(ref name_filter) = filter.name_filter {
                                    if !name.contains(name_filter) {
                                        return None;
                                    }
                                }

                                Some(InstalledPackage {
                                    name,
                                    version,
                                    provider: "nix".into(),
                                    install_path: PathBuf::from(store_path),
                                    installed_at: String::new(),
                                    is_global: true,
                                })
                            })
                            .collect());
                    }
                }
            }
        }

        // Fallback: nix-env -q
        let out = self.run_nix_env(&["-q", "--out-path"]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                let full_name = parts.first()?.to_string();
                let install_path = parts
                    .get(1)
                    .map(PathBuf::from)
                    .unwrap_or_else(|| nix_store.join(&full_name));

                // Parse "name-version" format
                let (name, version) = if let Some(pos) = full_name.rfind('-') {
                    let potential_ver = &full_name[pos + 1..];
                    if potential_ver
                        .chars()
                        .next()
                        .is_some_and(|c| c.is_ascii_digit())
                    {
                        (full_name[..pos].to_string(), potential_ver.to_string())
                    } else {
                        (full_name.clone(), "unknown".to_string())
                    }
                } else {
                    (full_name.clone(), "unknown".to_string())
                };

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version,
                    provider: "nix".into(),
                    install_path,
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // nix-env -u --dry-run shows what would be upgraded
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("nix-env", &["-u", "--dry-run"], Some(opts)).await;

        if let Ok(result) = out {
            let output =
                if result.stderr.contains("upgrading") || result.stderr.contains("would upgrade") {
                    &result.stderr
                } else {
                    &result.stdout
                };

            return Ok(output
                .lines()
                .filter(|l| l.contains("upgrading") || l.contains("would upgrade"))
                .filter_map(|line| {
                    // Format: "upgrading 'package-old' to 'package-new'"
                    let parts: Vec<&str> = line.split('\'').collect();
                    if parts.len() >= 4 {
                        let old_full = parts[1];
                        let new_full = parts[3];

                        let extract_name_ver = |s: &str| -> (String, String) {
                            if let Some(pos) = s.rfind('-') {
                                let ver = &s[pos + 1..];
                                if ver.chars().next().is_some_and(|c| c.is_ascii_digit()) {
                                    return (s[..pos].to_string(), ver.to_string());
                                }
                            }
                            (s.to_string(), "unknown".to_string())
                        };

                        let (name, current) = extract_name_ver(old_full);
                        let (_, latest) = extract_name_ver(new_full);

                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
                            provider: "nix".into(),
                        })
                    } else {
                        None
                    }
                })
                .collect());
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for NixProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false // Nix uses per-user profiles by default
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.get_installed_version(name).await?.is_some())
    }
}
