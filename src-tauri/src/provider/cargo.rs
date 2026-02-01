use super::api::get_api_client;
use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct CargoProvider;

impl CargoProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_cargo(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("cargo", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    fn get_cargo_home() -> Option<PathBuf> {
        std::env::var("CARGO_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".cargo"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join(".cargo"))
                }
            })
    }
}

impl Default for CargoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for CargoProvider {
    fn id(&self) -> &str {
        "cargo"
    }
    fn display_name(&self) -> &str {
        "Cargo (Rust Package Manager)"
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
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        process::which("cargo").await.is_some()
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let api = get_api_client();

        // Use crates.io API for faster and more reliable search
        if let Ok(packages) = api.search_crates(query, limit).await {
            return Ok(packages
                .into_iter()
                .map(|p| PackageSummary {
                    name: p.name,
                    description: p.description,
                    latest_version: Some(p.max_version),
                    provider: self.id().into(),
                })
                .collect());
        }

        // Fallback to cargo CLI with timeout
        let limit_str = limit.to_string();
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(30));
        let out = process::execute(
            "cargo",
            &["search", query, "--limit", &limit_str],
            Some(opts),
        )
        .await;

        if let Ok(result) = out {
            if result.success {
                // Parse cargo search output: name = "version"    # description
                let packages: Vec<PackageSummary> = result
                    .stdout
                    .lines()
                    .filter(|l| !l.is_empty() && l.contains('='))
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.splitn(2, '=').collect();
                        if parts.len() >= 2 {
                            let name = parts[0].trim().to_string();
                            let rest = parts[1].trim();
                            let version = rest
                                .split('#')
                                .next()
                                .map(|v| v.trim().trim_matches('"').to_string());
                            let description = rest.split('#').nth(1).map(|d| d.trim().to_string());

                            Some(PackageSummary {
                                name,
                                description,
                                latest_version: version,
                                provider: self.id().into(),
                            })
                        } else {
                            None
                        }
                    })
                    .collect();

                return Ok(packages);
            }
        }

        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let api = get_api_client();

        // Use crates.io API first
        if let Ok(crate_info) = api.get_crate(name).await {
            let versions: Vec<VersionInfo> = crate_info
                .versions
                .into_iter()
                .map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            return Ok(PackageInfo {
                name: crate_info.name.clone(),
                display_name: Some(crate_info.name),
                description: crate_info.description,
                homepage: crate_info
                    .homepage
                    .or_else(|| Some(format!("https://crates.io/crates/{}", name))),
                license: None,
                repository: crate_info.repository,
                versions: if versions.is_empty() {
                    vec![VersionInfo {
                        version: crate_info.max_version,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                } else {
                    versions
                },
                provider: self.id().into(),
            });
        }

        // Fallback to cargo CLI
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(15));
        let out = process::execute("cargo", &["search", name, "--limit", "1"], Some(opts)).await;

        let mut description = None;
        let mut version = None;

        if let Ok(result) = out {
            if result.success {
                for line in result.stdout.lines() {
                    if line.starts_with(name) || line.contains(&format!("{} =", name)) {
                        let parts: Vec<&str> = line.splitn(2, '=').collect();
                        if parts.len() >= 2 {
                            let rest = parts[1].trim();
                            version = rest
                                .split('#')
                                .next()
                                .map(|v| v.trim().trim_matches('"').to_string());
                            description = rest.split('#').nth(1).map(|d| d.trim().to_string());
                        }
                        break;
                    }
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!("https://crates.io/crates/{}", name)),
            license: None,
            repository: None,
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
        // cargo doesn't have a direct versions command
        // We can use cargo info (if available) or search
        let out = self.run_cargo(&["search", name, "--limit", "1"]).await?;

        for line in out.lines() {
            if line.starts_with(name) || line.contains(&format!("{} =", name)) {
                let parts: Vec<&str> = line.splitn(2, '=').collect();
                if parts.len() >= 2 {
                    let version = parts[1]
                        .trim()
                        .split('#')
                        .next()
                        .map(|v| v.trim().trim_matches('"').to_string());

                    if let Some(v) = version {
                        return Ok(vec![VersionInfo {
                            version: v,
                            release_date: None,
                            deprecated: false,
                            yanked: false,
                        }]);
                    }
                }
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name];
        let ver;
        if let Some(v) = &req.version {
            ver = format!("--version={}", v);
            args.push(&ver);
        }

        self.run_cargo(&args).await?;

        let install_path = Self::get_cargo_home()
            .map(|p| p.join("bin"))
            .unwrap_or_default();

        Ok(InstallReceipt {
            name: req.name,
            version: req.version.unwrap_or_default(),
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_cargo(&["uninstall", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_cargo(&["install", "--list"]).await?;
        let cargo_bin = Self::get_cargo_home()
            .map(|p| p.join("bin"))
            .unwrap_or_default();

        let mut packages = Vec::new();
        let mut current_name: Option<String> = None;
        let mut current_version: Option<String> = None;

        for line in out.lines() {
            if !line.starts_with(' ') && !line.is_empty() {
                // New package line: name v0.1.0:
                if let Some(name) = current_name.take() {
                    if let Some(version) = current_version.take() {
                        if filter
                            .name_filter
                            .as_ref()
                            .map_or(true, |f| name.contains(f))
                        {
                            packages.push(InstalledPackage {
                                name,
                                version,
                                provider: self.id().into(),
                                install_path: cargo_bin.clone(),
                                installed_at: String::new(),
                                is_global: true,
                            });
                        }
                    }
                }

                // Parse new package
                let parts: Vec<&str> = line.trim_end_matches(':').split_whitespace().collect();
                if parts.len() >= 2 {
                    current_name = Some(parts[0].to_string());
                    current_version = Some(parts[1].trim_start_matches('v').to_string());
                }
            }
        }

        // Don't forget the last package
        if let Some(name) = current_name {
            if let Some(version) = current_version {
                if filter
                    .name_filter
                    .as_ref()
                    .map_or(true, |f| name.contains(f))
                {
                    packages.push(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path: cargo_bin,
                        installed_at: String::new(),
                        is_global: true,
                    });
                }
            }
        }

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // cargo doesn't have native outdated check for installed binaries
        // We'd need cargo-update crate for this, so return empty for now
        // or implement by comparing installed versions with crates.io

        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            // Get latest version from search
            if let Ok(versions) = self.get_versions(&pkg.name).await {
                if let Some(latest) = versions.first() {
                    if latest.version != pkg.version {
                        updates.push(UpdateInfo {
                            name: pkg.name,
                            current_version: pkg.version,
                            latest_version: latest.version.clone(),
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
impl SystemPackageProvider for CargoProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_cargo(&["install", "--list"]).await;
        Ok(out
            .map(|s| s.lines().any(|l| l.starts_with(name)))
            .unwrap_or(false))
    }
}
