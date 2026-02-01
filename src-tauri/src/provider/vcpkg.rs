use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct VcpkgProvider {
    vcpkg_root: Option<PathBuf>,
}

impl VcpkgProvider {
    pub fn new() -> Self {
        let vcpkg_root = std::env::var("VCPKG_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    Some(PathBuf::from("C:\\vcpkg"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join("vcpkg"))
                }
            });
        Self { vcpkg_root }
    }

    fn get_vcpkg_exe(&self) -> String {
        if cfg!(windows) {
            self.vcpkg_root
                .as_ref()
                .map(|p| p.join("vcpkg.exe").to_string_lossy().to_string())
                .unwrap_or_else(|| "vcpkg".to_string())
        } else {
            self.vcpkg_root
                .as_ref()
                .map(|p| p.join("vcpkg").to_string_lossy().to_string())
                .unwrap_or_else(|| "vcpkg".to_string())
        }
    }

    async fn run_vcpkg(&self, args: &[&str]) -> CogniaResult<String> {
        let exe = self.get_vcpkg_exe();
        let out = process::execute(&exe, args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }
}

impl Default for VcpkgProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for VcpkgProvider {
    fn id(&self) -> &str {
        "vcpkg"
    }
    fn display_name(&self) -> &str {
        "vcpkg (C++ Package Manager)"
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
        70
    }

    async fn is_available(&self) -> bool {
        if let Some(root) = &self.vcpkg_root {
            let exe = if cfg!(windows) {
                root.join("vcpkg.exe")
            } else {
                root.join("vcpkg")
            };
            exe.exists()
        } else {
            process::which("vcpkg").await.is_some()
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let out = self.run_vcpkg(&["search", query]).await?;
        let limit = options.limit.unwrap_or(20);

        Ok(out
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with("The result") && !l.starts_with("If your"))
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].trim();
                let description = parts.get(1).map(|s| s.trim().to_string());

                Some(PackageSummary {
                    name: name.into(),
                    description,
                    latest_version: None,
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_vcpkg(&["search", name]).await?;

        let mut description = None;
        let mut version = None;

        for line in out.lines() {
            if line.starts_with(name) || line.contains(name) {
                let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
                if let Some(desc) = parts.get(1) {
                    description = Some(desc.trim().to_string());
                }
                // Extract version if present in format name[version]
                if let Some(start) = line.find('[') {
                    if let Some(end) = line.find(']') {
                        version = Some(line[start + 1..end].to_string());
                    }
                }
                break;
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!("https://vcpkg.io/en/package/{}", name)),
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
        // vcpkg typically uses port versions, get from x-history
        let out = self.run_vcpkg(&["x-history", name]).await;

        if let Ok(history) = out {
            let versions: Vec<VersionInfo> = history
                .lines()
                .filter(|l| !l.is_empty() && !l.starts_with("Version"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    parts.first().map(|v| VersionInfo {
                        version: v.to_string(),
                        release_date: parts.get(1).map(|s| s.to_string()),
                        deprecated: false,
                        yanked: false,
                    })
                })
                .collect();

            if !versions.is_empty() {
                return Ok(versions);
            }
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}@{}", req.name, v)
        } else {
            req.name.clone()
        };

        self.run_vcpkg(&["install", &pkg]).await?;

        let install_path = self
            .vcpkg_root
            .as_ref()
            .map(|r| r.join("installed"))
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
        self.run_vcpkg(&["remove", &req.name]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_vcpkg(&["list"]).await?;
        let install_path = self
            .vcpkg_root
            .as_ref()
            .map(|r| r.join("installed"))
            .unwrap_or_default();

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.is_empty() {
                    return None;
                }

                let name_ver: Vec<&str> = parts[0].split_whitespace().collect();
                let name = name_ver.first()?.to_string();

                if let Some(name_filter) = &filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                let version = name_ver.get(1).unwrap_or(&"").to_string();

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: install_path.clone(),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_vcpkg(&["upgrade", "--dry-run"]).await;

        if let Ok(output) = out {
            let updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| l.contains("->"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split("->").collect();
                    if parts.len() >= 2 {
                        let name_current: Vec<&str> = parts[0].trim().split(':').collect();
                        let name = name_current.first()?.trim().to_string();
                        let current = name_current.get(1).unwrap_or(&"").trim().to_string();
                        let latest = parts[1].trim().to_string();

                        Some(UpdateInfo {
                            name,
                            current_version: current,
                            latest_version: latest,
                            provider: self.id().into(),
                        })
                    } else {
                        None
                    }
                })
                .collect();

            return Ok(updates);
        }

        Ok(vec![])
    }
}

#[async_trait]
impl SystemPackageProvider for VcpkgProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_vcpkg(&["list", name]).await;
        Ok(out
            .map(|s| s.lines().any(|l| l.starts_with(name)))
            .unwrap_or(false))
    }
}
