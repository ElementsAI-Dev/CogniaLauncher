use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct PSGalleryProvider;

impl PSGalleryProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_pwsh(&self, script: &str) -> CogniaResult<String> {
        // Try pwsh first (PowerShell Core), then powershell (Windows PowerShell)
        let pwsh = if cfg!(windows) {
            process::execute("powershell", &["-NoProfile", "-Command", script], None).await
        } else {
            process::execute("pwsh", &["-NoProfile", "-Command", script], None).await
        };

        match pwsh {
            Ok(out) if out.success => Ok(out.stdout),
            Ok(out) => Err(CogniaError::Provider(out.stderr)),
            Err(e) => {
                // Try pwsh on Windows if powershell failed
                if cfg!(windows) {
                    let out =
                        process::execute("pwsh", &["-NoProfile", "-Command", script], None).await?;
                    if out.success {
                        Ok(out.stdout)
                    } else {
                        Err(CogniaError::Provider(out.stderr))
                    }
                } else {
                    Err(e.into())
                }
            }
        }
    }

    fn get_modules_path() -> Option<PathBuf> {
        if cfg!(windows) {
            std::env::var("USERPROFILE").ok().map(|p| {
                PathBuf::from(p)
                    .join("Documents")
                    .join("PowerShell")
                    .join("Modules")
            })
        } else {
            std::env::var("HOME").ok().map(|h| {
                PathBuf::from(h)
                    .join(".local")
                    .join("share")
                    .join("powershell")
                    .join("Modules")
            })
        }
    }
}

impl Default for PSGalleryProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for PSGalleryProvider {
    fn id(&self) -> &str {
        "psgallery"
    }
    fn display_name(&self) -> &str {
        "PowerShell Gallery"
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
        75
    }

    async fn is_available(&self) -> bool {
        // Check if PowerShell is available
        if cfg!(windows) {
            process::which("powershell").await.is_some() || process::which("pwsh").await.is_some()
        } else {
            process::which("pwsh").await.is_some()
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let script = format!(
            "Find-Module -Name '*{}*' -Repository PSGallery | Select-Object -First {} | ForEach-Object {{ \"$($_.Name)|$($_.Version)|$($_.Description)\" }}",
            query, limit
        );

        let out = self.run_pwsh(&script).await?;

        let packages: Vec<PackageSummary> = out
            .lines()
            .filter(|l| !l.is_empty() && l.contains('|'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, '|').collect();
                if parts.len() >= 2 {
                    Some(PackageSummary {
                        name: parts[0].trim().into(),
                        description: parts.get(2).map(|s| s.trim().into()),
                        latest_version: Some(parts[1].trim().into()),
                        provider: self.id().into(),
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(packages)
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let script = format!(
            "Find-Module -Name '{}' -Repository PSGallery | Select-Object -First 1 | ForEach-Object {{ \"$($_.Name)|$($_.Version)|$($_.Description)|$($_.ProjectUri)|$($_.LicenseUri)|$($_.Author)\" }}",
            name
        );

        let out = self.run_pwsh(&script).await?;

        let mut pkg_name = name.to_string();
        let mut version = None;
        let mut description = None;
        let mut homepage = None;
        let mut license = None;

        if let Some(line) = out.lines().next() {
            let parts: Vec<&str> = line.split('|').collect();
            if !parts.is_empty() {
                pkg_name = parts[0].trim().into();
            }
            if parts.len() > 1 {
                version = Some(parts[1].trim().into());
            }
            if parts.len() > 2 && !parts[2].trim().is_empty() {
                description = Some(parts[2].trim().into());
            }
            if parts.len() > 3 && !parts[3].trim().is_empty() {
                homepage = Some(parts[3].trim().into());
            }
            if parts.len() > 4 && !parts[4].trim().is_empty() {
                license = Some(parts[4].trim().into());
            }
        }

        Ok(PackageInfo {
            name: pkg_name.clone(),
            display_name: Some(pkg_name),
            description,
            homepage: homepage.or_else(|| {
                Some(format!(
                    "https://www.powershellgallery.com/packages/{}",
                    name
                ))
            }),
            license,
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
        let script = format!(
            "Find-Module -Name '{}' -Repository PSGallery -AllVersions | Select-Object -First 20 | ForEach-Object {{ $_.Version.ToString() }}",
            name
        );

        let out = self.run_pwsh(&script).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .map(|v| VersionInfo {
                version: v.trim().into(),
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let script = if let Some(v) = &req.version {
            format!(
                "Install-Module -Name '{}' -RequiredVersion '{}' -Repository PSGallery -Force -Scope CurrentUser",
                req.name, v
            )
        } else {
            format!(
                "Install-Module -Name '{}' -Repository PSGallery -Force -Scope CurrentUser",
                req.name
            )
        };

        self.run_pwsh(&script).await?;

        let install_path = Self::get_modules_path()
            .map(|p| p.join(&req.name))
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
        let script = format!("Uninstall-Module -Name '{}' -Force -AllVersions", req.name);
        self.run_pwsh(&script).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let script = "Get-InstalledModule | ForEach-Object { \"$($_.Name)|$($_.Version)|$($_.InstalledLocation)\" }";
        let out = self.run_pwsh(script).await?;
        let modules_path = Self::get_modules_path().unwrap_or_default();

        let packages: Vec<InstalledPackage> = out
            .lines()
            .filter(|l| !l.is_empty() && l.contains('|'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim().to_string();

                    if let Some(name_filter) = &filter.name_filter {
                        if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                            return None;
                        }
                    }

                    let version = parts[1].trim().to_string();
                    let install_path = parts
                        .get(2)
                        .map(|p| PathBuf::from(p.trim()))
                        .unwrap_or_else(|| modules_path.join(&name));

                    Some(InstalledPackage {
                        name,
                        version,
                        provider: self.id().into(),
                        install_path,
                        installed_at: String::new(),
                        is_global: true,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let script = "Get-InstalledModule | ForEach-Object { $online = Find-Module -Name $_.Name -Repository PSGallery -ErrorAction SilentlyContinue; if ($online -and $online.Version -gt $_.Version) { \"$($_.Name)|$($_.Version)|$($online.Version)\" } }";
        let out = self.run_pwsh(script).await;

        if let Ok(output) = out {
            let updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| !l.is_empty() && l.contains('|'))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 3 {
                        let name = parts[0].trim().to_string();

                        if !packages.is_empty() && !packages.contains(&name) {
                            return None;
                        }

                        Some(UpdateInfo {
                            name,
                            current_version: parts[1].trim().into(),
                            latest_version: parts[2].trim().into(),
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
impl SystemPackageProvider for PSGalleryProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false // Using CurrentUser scope
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let script = format!(
            "Get-InstalledModule -Name '{}' -ErrorAction SilentlyContinue",
            name
        );
        let out = self.run_pwsh(&script).await;
        Ok(out.map(|s| !s.is_empty()).unwrap_or(false))
    }
}
