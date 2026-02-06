use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;

pub struct WingetProvider;

impl WingetProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_winget(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("winget", args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a package using winget show
    async fn query_installed_version(&self, id: &str) -> CogniaResult<String> {
        let out = self.run_winget(&["show", "--id", id, "--accept-source-agreements"]).await?;
        
        for line in out.lines() {
            if let Some(version) = line.strip_prefix("Version:") {
                return Ok(version.trim().to_string());
            }
        }
        
        Err(CogniaError::Provider(format!("Version not found for {}", id)))
    }

    /// Parse winget's column-based output by finding the separator line (---) 
    /// and using it to determine column positions.
    /// Returns (data_lines, column_starts) where column_starts are byte offsets.
    fn parse_winget_columns(output: &str) -> (Vec<&str>, Vec<usize>) {
        let lines: Vec<&str> = output.lines().collect();
        let mut separator_idx = None;
        let mut column_starts = Vec::new();

        // Find the separator line containing only dashes and spaces
        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && trimmed.chars().all(|c| c == '-' || c == ' ') {
                separator_idx = Some(i);
                // Determine column boundaries from dash groups
                let mut in_dash = false;
                for (j, ch) in line.char_indices() {
                    if ch == '-' && !in_dash {
                        column_starts.push(j);
                        in_dash = true;
                    } else if ch != '-' {
                        in_dash = false;
                    }
                }
                break;
            }
        }

        let data_lines = if let Some(idx) = separator_idx {
            lines[idx + 1..].to_vec()
        } else {
            // Fallback: skip first 2 lines (header + possible separator)
            if lines.len() > 2 { lines[2..].to_vec() } else { vec![] }
        };

        (data_lines, column_starts)
    }

    /// Extract a column value from a line given column start positions
    fn extract_column(line: &str, col_starts: &[usize], col_index: usize) -> String {
        let start = col_starts.get(col_index).copied().unwrap_or(0);
        let end = col_starts.get(col_index + 1).copied().unwrap_or(line.len());
        if start >= line.len() {
            return String::new();
        }
        let end = end.min(line.len());
        line[start..end].trim().to_string()
    }
}

impl Default for WingetProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for WingetProvider {
    fn id(&self) -> &str {
        "winget"
    }
    fn display_name(&self) -> &str {
        "Windows Package Manager"
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
        vec![Platform::Windows]
    }
    fn priority(&self) -> i32 {
        90
    }

    async fn is_available(&self) -> bool {
        system_detection::is_command_available("winget", &["--version"]).await
    }

    async fn search(&self, query: &str, _: SearchOptions) -> CogniaResult<Vec<PackageSummary>> {
        let out = self
            .run_winget(&["search", query, "--accept-source-agreements"])
            .await?;

        // Winget search output columns: Name, Id, Version, Match, Source
        let (data_lines, col_starts) = Self::parse_winget_columns(&out);

        Ok(data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let name = Self::extract_column(line, &col_starts, 0);
                let id = Self::extract_column(line, &col_starts, 1);
                let version = Self::extract_column(line, &col_starts, 2);

                if name.is_empty() && id.is_empty() {
                    return None;
                }

                // Prefer Id as the package identifier (more reliable)
                let pkg_name = if !id.is_empty() { id } else { name };

                Some(PackageSummary {
                    name: pkg_name,
                    description: None,
                    latest_version: if version.is_empty() { None } else { Some(version) },
                    provider: self.id().into(),
                })
            })
            .take(20)
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self
            .run_winget(&["show", name, "--accept-source-agreements"])
            .await?;
        let mut desc = None;
        let mut version = None;
        let mut homepage = None;

        for line in out.lines() {
            if let Some(stripped) = line.strip_prefix("Description:") {
                desc = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Version:") {
                version = Some(stripped.trim().into());
            }
            if let Some(stripped) = line.strip_prefix("Homepage:") {
                homepage = Some(stripped.trim().into());
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: desc,
            homepage,
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
        let out = self
            .run_winget(&["show", name, "--versions", "--accept-source-agreements"])
            .await?;
        Ok(out
            .lines()
            .skip(2)
            .filter_map(|l| {
                let v = l.trim();
                if !v.is_empty() {
                    Some(VersionInfo {
                        version: v.into(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                } else {
                    None
                }
            })
            .collect())
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec![
            "install",
            "--id",
            &req.name,
            "--accept-package-agreements",
            "--accept-source-agreements",
        ];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }

        let _out = self.run_winget(&args).await?;

        // Get the actual installed version
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        // Winget installs to Program Files typically
        let install_path = std::env::var("ProgramFiles")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\Program Files"));

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
        match self.query_installed_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        self.run_winget(&["uninstall", "--id", &req.name, "--accept-source-agreements"])
            .await?;
        Ok(())
    }

    async fn list_installed(&self, _: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self
            .run_winget(&["list", "--accept-source-agreements"])
            .await?;
        
        let program_files = std::env::var("ProgramFiles")
            .unwrap_or_else(|_| "C:\\Program Files".to_string());

        // Winget list output columns: Name, Id, Version, Available, Source
        let (data_lines, col_starts) = Self::parse_winget_columns(&out);

        Ok(data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let name = Self::extract_column(line, &col_starts, 0);
                let id = Self::extract_column(line, &col_starts, 1);
                let version = Self::extract_column(line, &col_starts, 2);

                if name.is_empty() && id.is_empty() {
                    return None;
                }

                let pkg_id = if !id.is_empty() { id } else { name.clone() };

                Some(InstalledPackage {
                    name: pkg_id.clone(),
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from(&program_files).join(&pkg_id),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self
            .run_winget(&["upgrade", "--accept-source-agreements"])
            .await?;

        // Winget upgrade output columns: Name, Id, Version, Available, Source
        let (data_lines, col_starts) = Self::parse_winget_columns(&out);

        Ok(data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                // Skip summary line like "X upgrades available."
                if line.contains("upgrades available") || line.contains("upgrade available") {
                    return None;
                }

                let id = Self::extract_column(line, &col_starts, 1);
                let current = Self::extract_column(line, &col_starts, 2);
                let available = Self::extract_column(line, &col_starts, 3);

                if id.is_empty() || available.is_empty() {
                    return None;
                }

                if !packages.is_empty() && !packages.contains(&id) {
                    return None;
                }

                Some(UpdateInfo {
                    name: id,
                    current_version: current,
                    latest_version: available,
                    provider: self.id().into(),
                })
            })
            .collect())
    }
}

#[async_trait]
impl SystemPackageProvider for WingetProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_winget(&["--version"]).await?;
        Ok(out.trim().trim_start_matches('v').into())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("winget")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("winget not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("WinGet is included with Windows 11 and App Installer from Microsoft Store on Windows 10.".into())
    }

    async fn update_index(&self) -> CogniaResult<()> {
        self.run_winget(&["source", "update"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_winget(&[
            "upgrade",
            "--id",
            name,
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        self.run_winget(&[
            "upgrade",
            "--all",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .await?;
        Ok(vec!["All packages upgraded".into()])
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self
            .run_winget(&["list", "--id", name, "--accept-source-agreements"])
            .await;
        Ok(out.map(|s| s.lines().count() > 2).unwrap_or(false))
    }
}
