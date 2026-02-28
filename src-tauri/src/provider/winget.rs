use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{env::Platform, process};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Default timeout for query operations (search, list, show, etc.)
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);
/// Long timeout for mutating operations (install, uninstall, upgrade, import, repair).
const LONG_TIMEOUT: Duration = Duration::from_secs(600);

pub struct WingetProvider;

/// Common flags appended to every winget invocation for non-interactive automated use.
const COMMON_FLAGS: &[&str] = &["--accept-source-agreements", "--disable-interactivity"];

/// A pinned package entry from `winget pin list`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetPin {
    pub name: String,
    pub id: String,
    pub version: String,
    pub source: String,
    pub pin_type: String,
}

/// A winget source entry from `winget source list`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetSource {
    pub name: String,
    pub argument: String,
    pub source_type: String,
    pub updated: String,
}

/// Detailed info from `winget --info`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WingetInfo {
    pub version: String,
    pub logs_dir: Option<String>,
    pub is_admin: bool,
    pub sources: Vec<WingetSource>,
}

impl WingetProvider {
    pub fn new() -> Self {
        Self
    }

    /// Execute a winget command with common flags and standard timeout (120s).
    async fn run_winget(&self, args: &[&str]) -> CogniaResult<String> {
        self.run_winget_with_timeout(args, DEFAULT_TIMEOUT).await
    }

    /// Execute a winget command with common flags and long timeout (600s).
    /// Use for install, uninstall, upgrade, import, repair operations.
    async fn run_winget_long(&self, args: &[&str]) -> CogniaResult<String> {
        self.run_winget_with_timeout(args, LONG_TIMEOUT).await
    }

    /// Execute a winget command with common flags and the specified timeout.
    async fn run_winget_with_timeout(
        &self,
        args: &[&str],
        timeout: Duration,
    ) -> CogniaResult<String> {
        let mut full_args: Vec<&str> = args.to_vec();
        for flag in COMMON_FLAGS {
            if !full_args.contains(flag) {
                full_args.push(flag);
            }
        }

        let opts = process::ProcessOptions::new().with_timeout(timeout);

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

    /// Execute a winget command that may return useful stdout on non-zero exit.
    /// Returns stdout regardless of exit code (e.g., `winget upgrade` returns 1 when updates exist).
    async fn run_winget_lenient(&self, args: &[&str]) -> CogniaResult<String> {
        let mut full_args: Vec<&str> = args.to_vec();
        for flag in COMMON_FLAGS {
            if !full_args.contains(flag) {
                full_args.push(flag);
            }
        }

        let opts = process::ProcessOptions::new().with_timeout(DEFAULT_TIMEOUT);
        let out = process::execute("winget", &full_args, Some(opts)).await?;
        Ok(Self::clean_output(&out.stdout))
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

    // ── Pin management ──────────────────────────────────────────────────

    /// List all pinned packages via `winget pin list`.
    pub async fn pin_list(&self) -> CogniaResult<Vec<WingetPin>> {
        let out = self.run_winget(&["pin", "list"]).await?;
        Ok(Self::parse_pin_list(&out))
    }

    /// Add a pin for a package. `pin_type` can be "pinning", "blocking", or "gating".
    pub async fn pin_add(
        &self,
        id: &str,
        version: Option<&str>,
        blocking: bool,
    ) -> CogniaResult<()> {
        let mut args = vec!["pin", "add", "--id", id, "--exact"];
        if let Some(v) = version {
            args.extend(&["--version", v]);
        }
        if blocking {
            args.push("--blocking");
        }
        self.run_winget(&args).await?;
        Ok(())
    }

    /// Remove a pin from a package.
    pub async fn pin_remove(&self, id: &str) -> CogniaResult<()> {
        self.run_winget(&["pin", "remove", "--id", id, "--exact"])
            .await?;
        Ok(())
    }

    /// Reset all pins.
    pub async fn pin_reset(&self) -> CogniaResult<()> {
        self.run_winget(&["pin", "reset", "--force"]).await?;
        Ok(())
    }

    /// Parse `winget pin list` output into structured data.
    fn parse_pin_list(output: &str) -> Vec<WingetPin> {
        let (data_lines, col_starts) = Self::parse_winget_columns(output);
        data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let name = Self::extract_column(line, &col_starts, 0);
                let id = Self::extract_column(line, &col_starts, 1);
                let version = Self::extract_column(line, &col_starts, 2);
                let source = Self::extract_column(line, &col_starts, 3);
                let pin_type = Self::extract_column(line, &col_starts, 4);

                if id.is_empty() {
                    return None;
                }

                Some(WingetPin {
                    name,
                    id,
                    version,
                    source,
                    pin_type,
                })
            })
            .collect()
    }

    // ── Source management ────────────────────────────────────────────────

    /// List all configured sources.
    pub async fn source_list(&self) -> CogniaResult<Vec<WingetSource>> {
        let out = self.run_winget(&["source", "list"]).await?;
        Ok(Self::parse_source_list(&out))
    }

    /// Add a new package source.
    pub async fn source_add(
        &self,
        name: &str,
        url: &str,
        source_type: Option<&str>,
    ) -> CogniaResult<()> {
        let mut args = vec!["source", "add", "--name", name, "--arg", url];
        if let Some(t) = source_type {
            args.extend(&["--type", t]);
        }
        self.run_winget(&args).await?;
        Ok(())
    }

    /// Remove a package source.
    pub async fn source_remove(&self, name: &str) -> CogniaResult<()> {
        self.run_winget(&["source", "remove", "--name", name])
            .await?;
        Ok(())
    }

    /// Reset all sources to default.
    pub async fn source_reset(&self) -> CogniaResult<()> {
        self.run_winget(&["source", "reset", "--force"]).await?;
        Ok(())
    }

    /// Parse `winget source list` output.
    fn parse_source_list(output: &str) -> Vec<WingetSource> {
        let (data_lines, col_starts) = Self::parse_winget_columns(output);
        data_lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|line| {
                let name = Self::extract_column(line, &col_starts, 0);
                let argument = Self::extract_column(line, &col_starts, 1);

                if name.is_empty() {
                    return None;
                }

                Some(WingetSource {
                    name,
                    argument,
                    source_type: String::new(),
                    updated: String::new(),
                })
            })
            .collect()
    }

    // ── Export / Import ──────────────────────────────────────────────────

    /// Export installed packages to a JSON file using native `winget export`.
    pub async fn export_packages(
        &self,
        output_path: &str,
        include_versions: bool,
    ) -> CogniaResult<()> {
        let mut args = vec!["export", "-o", output_path];
        if include_versions {
            args.push("--include-versions");
        }
        self.run_winget(&args).await?;
        Ok(())
    }

    /// Import packages from a JSON file using native `winget import`.
    pub async fn import_packages(
        &self,
        input_path: &str,
        ignore_unavailable: bool,
        ignore_versions: bool,
    ) -> CogniaResult<String> {
        let mut args = vec![
            "import",
            "-i",
            input_path,
            "--accept-package-agreements",
        ];
        if ignore_unavailable {
            args.push("--ignore-unavailable");
        }
        if ignore_versions {
            args.push("--ignore-versions");
        }
        self.run_winget_long(&args).await
    }

    // ── Repair ───────────────────────────────────────────────────────────

    /// Repair an installed package.
    pub async fn repair_package(&self, id: &str) -> CogniaResult<()> {
        self.run_winget_long(&["repair", "--id", id, "--exact", "--silent"])
            .await?;
        Ok(())
    }

    // ── Download (offline installer) ────────────────────────────────────

    /// Download a package installer without installing.
    pub async fn download_installer(
        &self,
        id: &str,
        version: Option<&str>,
        directory: Option<&str>,
    ) -> CogniaResult<String> {
        let mut args = vec!["download", "--id", id, "--exact"];
        if let Some(v) = version {
            args.extend(&["--version", v]);
        }
        if let Some(d) = directory {
            args.extend(&["-d", d]);
        }
        self.run_winget_long(&args).await
    }

    // ── Info ─────────────────────────────────────────────────────────────

    /// Get detailed winget info via `winget --info`.
    pub async fn get_info(&self) -> CogniaResult<WingetInfo> {
        let out = self.run_winget(&["--info"]).await?;
        let version_out = self.run_winget(&["--version"]).await.unwrap_or_default();
        let version = version_out.trim().trim_start_matches('v').to_string();

        let mut logs_dir = None;
        let mut is_admin = false;

        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("Logs") {
                if let Some(path) = trimmed.split_whitespace().last() {
                    if path.contains('\\') || path.contains('/') {
                        logs_dir = Some(path.to_string());
                    }
                }
            }
            if trimmed.contains("Administrator") && trimmed.contains("true") {
                is_admin = true;
            }
        }

        let sources = self.source_list().await.unwrap_or_default();

        Ok(WingetInfo {
            version,
            logs_dir,
            is_admin,
            sources,
        })
    }

    // ── Advanced install with scope/arch/locale ─────────────────────────

    /// Install a package with advanced options (scope, architecture, locale, location).
    pub async fn install_advanced(
        &self,
        id: &str,
        version: Option<&str>,
        scope: Option<&str>,
        architecture: Option<&str>,
        locale: Option<&str>,
        location: Option<&str>,
        force: bool,
    ) -> CogniaResult<String> {
        let mut args = vec![
            "install",
            "--id",
            id,
            "--exact",
            "--accept-package-agreements",
            "--silent",
        ];
        if let Some(v) = version {
            args.extend(&["--version", v]);
        }
        if let Some(s) = scope {
            args.extend(&["--scope", s]);
        }
        if let Some(a) = architecture {
            args.extend(&["--architecture", a]);
        }
        if let Some(l) = locale {
            args.extend(&["--locale", l]);
        }
        if let Some(loc) = location {
            args.extend(&["--location", loc]);
        }
        if force {
            args.push("--force");
        }
        self.run_winget_long(&args).await
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
            Capability::LockVersion,
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

                let display = name.clone();
                let pkg_id = if !id.is_empty() { id } else { name };

                Some(PackageSummary {
                    name: pkg_id,
                    description: if !display.is_empty() {
                        Some(display)
                    } else {
                        None
                    },
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
        let mut repository = None;
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
            } else if let Some(v) = Self::parse_show_field(line, "Publisher Url:") {
                if homepage.is_none() {
                    homepage = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Publisher Support Url:") {
                if repository.is_none() && !v.is_empty() {
                    repository = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "License:") {
                license = Some(v.to_string());
            } else if let Some(v) = Self::parse_show_field(line, "License Url:") {
                if license.is_none() {
                    license = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Copyright:") {
                // Append copyright info to license if present
                if let Some(ref mut lic) = license {
                    lic.push_str(&format!(" ({})", v));
                }
            } else if let Some(v) = Self::parse_show_field(line, "Package Url:") {
                if repository.is_none() && !v.is_empty() {
                    repository = Some(v.to_string());
                }
            } else if let Some(v) = Self::parse_show_field(line, "Description:") {
                if !v.is_empty() {
                    desc_lines.push(v.to_string());
                }
                in_description = true;
            } else if let Some(v) = Self::parse_show_field(line, "Release Notes Url:") {
                if repository.is_none() && !v.is_empty() {
                    repository = Some(v.to_string());
                }
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
            repository,
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

        let _out = self.run_winget_long(&args).await?;

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

        self.run_winget_long(&args).await?;
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
        let out = self.run_winget_lenient(&["upgrade"]).await?;

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
        matches!(op, "install" | "uninstall" | "upgrade" | "repair" | "import")
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
        self.run_winget_long(&[
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
        // Snapshot available upgrades before running
        let before = self
            .check_updates(&[])
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|u| u.name)
            .collect::<HashSet<_>>();

        let _out = self
            .run_winget_long(&[
                "upgrade",
                "--all",
                "--accept-package-agreements",
                "--silent",
                "--include-pinned",
            ])
            .await?;

        // Snapshot remaining upgrades after running
        let after = self
            .check_updates(&[])
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|u| u.name)
            .collect::<HashSet<_>>();

        // Packages that were in `before` but not in `after` were successfully upgraded
        let upgraded: Vec<String> = before.difference(&after).cloned().collect();

        if upgraded.is_empty() {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Ok(upgraded)
        }
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
        assert!(SystemPackageProvider::requires_elevation(
            &provider, "repair"
        ));
        assert!(SystemPackageProvider::requires_elevation(
            &provider, "import"
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

    #[test]
    fn test_capabilities_include_lock_version() {
        let provider = WingetProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::LockVersion));
    }

    #[test]
    fn test_parse_pin_list_standard() {
        let output = "Name          Id                  Version  Source  Pin Type\n------------- ------------------- -------- ------ --------\nPowerToys     Microsoft.PowerToys 0.75.1   winget Pinning\nVS Code       Microsoft.VSCode    1.85.0   winget Blocking\n";
        let pins = WingetProvider::parse_pin_list(output);
        assert_eq!(pins.len(), 2);
        assert_eq!(pins[0].id, "Microsoft.PowerToys");
        assert_eq!(pins[0].pin_type, "Pinning");
        assert_eq!(pins[1].id, "Microsoft.VSCode");
        assert_eq!(pins[1].pin_type, "Blocking");
    }

    #[test]
    fn test_parse_pin_list_empty() {
        let output = "Name  Id  Version  Source  Pin Type\n----- --- -------- ------ --------\n";
        let pins = WingetProvider::parse_pin_list(output);
        assert!(pins.is_empty());
    }

    #[test]
    fn test_parse_source_list_standard() {
        let output = "Name      Arg\n--------- -------------------------------------------\nwinget    https://cdn.winget.microsoft.com/cache\nmsstore   https://storeedgefd.dsx.mp.microsoft.com/v9.0\n";
        let sources = WingetProvider::parse_source_list(output);
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].name, "winget");
        assert!(sources[0].argument.contains("winget.microsoft.com"));
        assert_eq!(sources[1].name, "msstore");
    }

    #[test]
    fn test_parse_source_list_empty() {
        let output = "Name  Arg\n----- ---\n";
        let sources = WingetProvider::parse_source_list(output);
        assert!(sources.is_empty());
    }

    #[test]
    fn test_timeout_constants() {
        assert_eq!(DEFAULT_TIMEOUT.as_secs(), 120);
        assert_eq!(LONG_TIMEOUT.as_secs(), 600);
    }

    #[test]
    fn test_winget_pin_serde() {
        let pin = WingetPin {
            name: "PowerToys".into(),
            id: "Microsoft.PowerToys".into(),
            version: "0.75.*".into(),
            source: "winget".into(),
            pin_type: "Gating".into(),
        };
        let json = serde_json::to_string(&pin).unwrap();
        assert!(json.contains("\"pinType\":\"Gating\""));
        let deserialized: WingetPin = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.pin_type, "Gating");
    }

    #[test]
    fn test_winget_source_serde() {
        let source = WingetSource {
            name: "winget".into(),
            argument: "https://cdn.winget.microsoft.com/cache".into(),
            source_type: "Microsoft.PreIndexed.Package".into(),
            updated: "2024-01-01".into(),
        };
        let json = serde_json::to_string(&source).unwrap();
        assert!(json.contains("\"sourceType\""));
        let deserialized: WingetSource = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "winget");
    }

    #[test]
    fn test_winget_info_serde() {
        let info = WingetInfo {
            version: "1.8.1911".into(),
            logs_dir: Some("C:\\Users\\test\\AppData\\Local\\Packages\\logs".into()),
            is_admin: false,
            sources: vec![],
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"logsDir\""));
        assert!(json.contains("\"isAdmin\":false"));
    }
}
