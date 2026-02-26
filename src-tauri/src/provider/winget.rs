use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

pub struct WingetProvider;

/// Common flags appended to every winget invocation for non-interactive automated use.
const COMMON_FLAGS: &[&str] = &["--accept-source-agreements", "--disable-interactivity"];

impl WingetProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a winget command with common flags and a generous timeout.
    /// Merges stdout for the caller; returns an error only when exit code != 0.
    async fn run_winget(&self, args: &[&str]) -> CogniaResult<String> {
        let mut full_args: Vec<&str> = args.to_vec();
        for flag in COMMON_FLAGS {
            if !full_args.contains(flag) {
                full_args.push(flag);
            }
        }

        let opts = process::ProcessOptions::new().with_timeout(Duration::from_secs(120));

        let out = process::execute("winget", &full_args, Some(opts)).await?;

        // Clean potential UTF-16 BOM / null bytes that winget may emit
        let stdout = Self::clean_output(&out.stdout);

        if out.success {
            Ok(stdout)
        } else {
            let stderr = Self::clean_output(&out.stderr);
            // Some winget operations write useful output to stdout even on non-zero exit
            let msg = if stderr.trim().is_empty() {
                stdout
            } else {
                stderr
            };
            Err(CogniaError::Provider(msg))
        }
    }

    /// Strip null bytes and UTF-8 BOM that winget sometimes emits on Windows.
    fn clean_output(raw: &str) -> String {
        raw.replace('\0', "")
            .trim_start_matches('\u{feff}')
            .to_string()
    }

    /// Query the locally-installed version of a package via `winget list --id --exact`.
    /// This is more reliable than `winget show` which queries the source catalog.
    async fn query_installed_version(&self, id: &str) -> CogniaResult<String> {
        let out = self.run_winget(&["list", "--id", id, "--exact"]).await?;

        let (data_lines, col_starts) = Self::parse_winget_columns(&out);

        for line in &data_lines {
            if line.trim().is_empty() {
                continue;
            }
            let pkg_id = Self::extract_column(line, &col_starts, 1);
            let version = Self::extract_column(line, &col_starts, 2);
            // Match by ID (case-insensitive) to handle winget's mixed casing
            if pkg_id.eq_ignore_ascii_case(id) && !version.is_empty() {
                return Ok(version);
            }
        }

        // Fallback: take the first data row's version if only one result
        if data_lines.len() == 1 {
            let version = Self::extract_column(data_lines[0], &col_starts, 2);
            if !version.is_empty() {
                return Ok(version);
            }
        }

        Err(CogniaError::Provider(format!(
            "Installed version not found for {}",
            id
        )))
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
            if lines.len() > 2 {
                lines[2..].to_vec()
            } else {
                vec![]
            }
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

    /// Parse a key-value field from `winget show` output.
    /// Handles both single-line ("Key: Value") and skips empty values.
    fn parse_show_field<'a>(line: &'a str, prefix: &str) -> Option<&'a str> {
        line.strip_prefix(prefix).map(|v| v.trim())
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
            Capability::Upgrade,
            Capability::UpdateIndex,
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

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(25);
        let limit_str = limit.to_string();

        let out = self
            .run_winget(&["search", query, "--count", &limit_str])
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

                Some(PackageSummary {
                    // Prefer Id as the package identifier (more reliable for install)
                    name: if !id.is_empty() { id } else { name },
                    description: None,
                    latest_version: if version.is_empty() {
                        None
                    } else {
                        Some(version)
                    },
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try exact ID match first, fallback to name search
        let out = match self.run_winget(&["show", "--id", name, "--exact"]).await {
            Ok(o) => o,
            Err(_) => self.run_winget(&["show", name]).await?,
        };

        let mut display_name = None;
        let mut desc = None;
        let mut version = None;
        let mut homepage = None;
        let mut license = None;
        let mut author = None;
        // Track multi-line description
        let mut in_description = false;
        let mut desc_lines: Vec<String> = Vec::new();

        for line in out.lines() {
            // Multi-line description: indented continuation lines
            if in_description {
                if line.starts_with(' ') || line.starts_with('\t') {
                    desc_lines.push(line.trim().to_string());
                    continue;
                } else {
                    in_description = false;
                }
            }

            if let Some(v) = Self::parse_show_field(line, "Found ") {
                // "Found <DisplayName> [<Id>]"
                if let Some(bracket_start) = v.rfind('[') {
                    display_name = Some(v[..bracket_start].trim().to_string());
                } else {
                    display_name = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Version:") {
                version = Some(v.to_string());
            } else if let Some(v) = Self::parse_show_field(line, "Publisher:") {
                author = Some(v.to_string());
            } else if let Some(v) = Self::parse_show_field(line, "Author:") {
                if author.is_none() {
                    author = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Homepage:") {
                homepage = Some(v.to_string());
            } else if let Some(v) = Self::parse_show_field(line, "License:") {
                license = Some(v.to_string());
            } else if let Some(v) = Self::parse_show_field(line, "License Url:") {
                if license.is_none() {
                    license = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Description:") {
                if !v.is_empty() {
                    desc_lines.push(v.to_string());
                }
                in_description = true;
            }
        }

        if !desc_lines.is_empty() {
            desc = Some(desc_lines.join(" "));
        }

        // Construct display_name from author if not extracted from "Found" line
        let effective_display_name = display_name
            .or_else(|| author.clone().map(|a| format!("{} ({})", name, a)))
            .unwrap_or_else(|| name.to_string());

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(effective_display_name),
            description: desc,
            homepage,
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
        // Try exact ID match first, fallback to name search
        let out = match self
            .run_winget(&["show", "--id", name, "--versions", "--exact"])
            .await
        {
            Ok(o) => o,
            Err(_) => self.run_winget(&["show", name, "--versions"]).await?,
        };

        // `winget show --versions` output has a header line, separator line, then version rows.
        // Use the column parser to reliably skip the header/separator.
        let (data_lines, _col_starts) = Self::parse_winget_columns(&out);

        Ok(data_lines
            .iter()
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
            "--exact",
            "--accept-package-agreements",
            "--silent",
        ];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }
        if req.force {
            args.push("--force");
        }

        let _out = self.run_winget(&args).await?;

        // Get the actual installed version via `winget list`
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::new(),
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
        let mut args = vec!["uninstall", "--id", &req.name, "--exact", "--silent"];
        let ver;
        if let Some(v) = &req.version {
            ver = v.clone();
            args.extend(&["--version", &ver]);
        }
        if req.force {
            args.push("--force");
        }

        self.run_winget(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let mut args = vec!["list"];
        let name_filter;
        if let Some(ref name) = filter.name_filter {
            name_filter = name.clone();
            args.extend(&["--query", &name_filter]);
        }

        let out = self.run_winget(&args).await?;

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
                    name: pkg_id,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::new(),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_winget(&["upgrade"]).await?;

        // Winget upgrade output columns: Name, Id, Version, Available, Source
        let (data_lines, col_starts) = Self::parse_winget_columns(&out);

        Ok(data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                // Skip summary lines like "X upgrades available." or
                // lines containing only counts/footer text
                let trimmed = line.trim();
                if trimmed.contains("upgrades available")
                    || trimmed.contains("upgrade available")
                    || trimmed.contains("pinned")
                {
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
            "--exact",
            "--accept-package-agreements",
            "--silent",
        ])
        .await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = self
            .run_winget(&[
                "upgrade",
                "--all",
                "--accept-package-agreements",
                "--silent",
                "--include-pinned",
            ])
            .await?;

        // Parse output to report which packages were upgraded
        let mut upgraded = Vec::new();
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("Successfully installed")
                || trimmed.contains("successfully installed")
            {
                upgraded.push(trimmed.to_string());
            }
        }
        if upgraded.is_empty() {
            upgraded.push("All packages upgraded".into());
        }
        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_winget(&["list", "--id", name, "--exact"]).await;

        match out {
            Ok(output) => {
                let (data_lines, _) = Self::parse_winget_columns(&output);
                Ok(!data_lines.iter().all(|l| l.trim().is_empty()))
            }
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_winget_columns_standard() {
        // Real winget output uses fixed-width columns with space-separated dash groups
        let output = "Name           Id                   Version  Match        Source\n-------------- -------------------- -------- ------------ ------\nPowerToys      Microsoft.PowerToys  0.75.1   Tag: tools   winget\nVisual Studio  Microsoft.VS.2022    17.8.0                winget\n";
        let (data_lines, col_starts) = WingetProvider::parse_winget_columns(output);

        assert_eq!(data_lines.len(), 2);
        assert!(col_starts.len() >= 4, "col_starts={:?}", col_starts);

        let name = WingetProvider::extract_column(data_lines[0], &col_starts, 0);
        let id = WingetProvider::extract_column(data_lines[0], &col_starts, 1);
        let version = WingetProvider::extract_column(data_lines[0], &col_starts, 2);

        assert_eq!(name, "PowerToys");
        assert_eq!(id, "Microsoft.PowerToys");
        assert_eq!(version, "0.75.1");
    }

    #[test]
    fn test_parse_winget_columns_empty_fields() {
        let output = "Name         Id           Version  Available\n------------ ------------ -------- ---------\nSomeApp      Some.App     1.0.0    2.0.0\nOtherApp     Other.App    3.0.0\n";
        let (data_lines, col_starts) = WingetProvider::parse_winget_columns(output);

        assert_eq!(data_lines.len(), 2);
        assert!(col_starts.len() >= 4, "col_starts={:?}", col_starts);

        let available1 = WingetProvider::extract_column(data_lines[0], &col_starts, 3);
        assert_eq!(available1, "2.0.0");

        // Second row has no Available column
        let available2 = WingetProvider::extract_column(data_lines[1], &col_starts, 3);
        assert!(available2.is_empty());
    }

    #[test]
    fn test_parse_winget_columns_no_separator() {
        let output = "Header line\nSecond line\nData line 1\nData line 2";
        let (data_lines, col_starts) = WingetProvider::parse_winget_columns(output);

        // Fallback: skip first 2 lines
        assert_eq!(data_lines.len(), 2);
        assert!(col_starts.is_empty());
    }

    #[test]
    fn test_parse_winget_columns_versions_output() {
        let output = "\
Version
-----------
1.2.3
1.2.2
1.2.1
1.0.0
";
        let (data_lines, col_starts) = WingetProvider::parse_winget_columns(output);

        assert_eq!(data_lines.len(), 4);
        assert_eq!(col_starts.len(), 1);
        assert_eq!(data_lines[0].trim(), "1.2.3");
        assert_eq!(data_lines[3].trim(), "1.0.0");
    }

    #[test]
    fn test_parse_winget_columns_upgrade_summary() {
        let output = "Name          Id                Version  Available  Source\n------------- ----------------- -------- ---------- ------\nPowerToys     Microsoft.PT      0.74.0   0.75.1     winget\n3 upgrades available.\n";
        let (data_lines, col_starts) = WingetProvider::parse_winget_columns(output);

        assert!(col_starts.len() >= 4, "col_starts={:?}", col_starts);
        // The summary line is included in data_lines but should be filtered by check_updates
        let non_empty: Vec<_> = data_lines.iter().filter(|l| !l.trim().is_empty()).collect();
        assert!(non_empty.len() >= 1);

        // Verify we can extract the upgrade info
        let id = WingetProvider::extract_column(data_lines[0], &col_starts, 1);
        let current = WingetProvider::extract_column(data_lines[0], &col_starts, 2);
        let available = WingetProvider::extract_column(data_lines[0], &col_starts, 3);
        assert_eq!(id, "Microsoft.PT");
        assert_eq!(current, "0.74.0");
        assert_eq!(available, "0.75.1");
    }

    #[test]
    fn test_clean_output_null_bytes() {
        let raw = "H\0e\0l\0l\0o";
        let cleaned = WingetProvider::clean_output(raw);
        assert_eq!(cleaned, "Hello");
    }

    #[test]
    fn test_clean_output_bom() {
        let raw = "\u{feff}Version 1.8.0";
        let cleaned = WingetProvider::clean_output(raw);
        assert_eq!(cleaned, "Version 1.8.0");
    }

    #[test]
    fn test_extract_column_out_of_bounds() {
        let col_starts = vec![0, 10, 20];
        let short_line = "Hello";

        // Column index 1 starts at 10, which is past the line length
        let result = WingetProvider::extract_column(short_line, &col_starts, 1);
        assert_eq!(result, "");
    }

    #[test]
    fn test_capabilities_include_upgrade_and_update_index() {
        let provider = WingetProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::UpdateIndex));
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = WingetProvider::new();
        assert_eq!(provider.id(), "winget");
        assert_eq!(provider.display_name(), "Windows Package Manager");
        assert_eq!(provider.priority(), 90);
        assert_eq!(provider.supported_platforms(), vec![Platform::Windows]);
    }

    #[test]
    fn test_parse_show_field() {
        assert_eq!(
            WingetProvider::parse_show_field("Version: 1.2.3", "Version:"),
            Some("1.2.3")
        );
        assert_eq!(
            WingetProvider::parse_show_field("Homepage: https://example.com", "Homepage:"),
            Some("https://example.com")
        );
        assert_eq!(
            WingetProvider::parse_show_field("Description:", "Description:"),
            Some("")
        );
        assert_eq!(
            WingetProvider::parse_show_field("Other field", "Version:"),
            None
        );
    }

    #[test]
    fn test_requires_elevation() {
        let provider = WingetProvider::new();
        assert!(SystemPackageProvider::requires_elevation(
            &provider, "install"
        ));
        assert!(SystemPackageProvider::requires_elevation(
            &provider,
            "uninstall"
        ));
        assert!(SystemPackageProvider::requires_elevation(
            &provider, "upgrade"
        ));
        assert!(!SystemPackageProvider::requires_elevation(
            &provider, "search"
        ));
        assert!(!SystemPackageProvider::requires_elevation(
            &provider, "list"
        ));
    }

    #[test]
    fn test_default_impl() {
        let _provider = WingetProvider::default();
        // Ensure Default impl works
    }
}
