use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::Dependency;
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

/// Xmake/Xrepo - C/C++ Build System & Package Manager (v2.9+)
///
/// Xrepo is the cross-platform C/C++ package manager built on top of Xmake.
/// It supports packages from the xmake-repo, as well as third-party sources
/// (vcpkg, conan, conda, etc.).
///
/// Key CLI commands used:
///   - `xrepo install [-y] [-f configs] [-k kind] [-m mode] "name [ver]"` — Install
///   - `xrepo remove [-y] "name [ver]"` — Remove a package
///   - `xrepo search <query>` — Search packages in repositories
///   - `xrepo info <pkg>` — Get package information
///   - `xrepo fetch [--json] [--deps] <pkg>` — Fetch library info (supports JSON)
///   - `xrepo scan [--packages pattern]` — List ALL globally installed packages
///   - `xrepo clean [--cache]` — Clear caches and unused packages
///   - `xrepo env --show/--list/--add/--remove/-b` — Virtual environments
///   - `xrepo export -o <dir> <pkg>` / `xrepo import <dir>` — Export/import
///   - `xrepo download [-o dir] "name [ver]"` — Download source only
///   - `xrepo add-repo/rm-repo/list-repo/update-repo` — Repository management
///   - `xmake --version` — Version info
pub struct XmakeProvider;

impl XmakeProvider {
    pub fn new() -> Self {
        Self
    }

    fn make_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(120))
    }

    fn make_long_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(300))
    }

    async fn run_xmake(args: &[&str]) -> CogniaResult<String> {
        let opts = Self::make_opts();
        let out = process::execute("xmake", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn run_xrepo(args: &[&str]) -> CogniaResult<String> {
        let opts = Self::make_opts();
        let out = process::execute("xrepo", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run xrepo and return combined stdout+stderr (some info goes to stderr)
    async fn run_xrepo_combined(args: &[&str]) -> CogniaResult<String> {
        let opts = Self::make_opts();
        let out = process::execute("xrepo", args, Some(opts)).await?;
        if out.success {
            let combined = if out.stdout.is_empty() {
                out.stderr
            } else {
                format!("{}\n{}", out.stdout, out.stderr)
            };
            Ok(combined)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run xrepo and return stdout regardless of exit code (some commands like scan
    /// may still produce useful output on non-zero exit).
    async fn run_xrepo_lenient(args: &[&str]) -> CogniaResult<String> {
        let opts = Self::make_opts();
        let out = process::execute("xrepo", args, Some(opts)).await?;
        let combined = if out.stdout.is_empty() {
            out.stderr
        } else {
            format!("{}\n{}", out.stdout, out.stderr)
        };
        Ok(combined)
    }

    fn get_xmake_packages_dir() -> Option<PathBuf> {
        // Check XMAKE_PKG_INSTALLDIR or default ~/.xmake/packages
        std::env::var("XMAKE_PKG_INSTALLDIR")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".xmake").join("packages"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join(".xmake").join("packages"))
                }
            })
    }

    /// Parse `xrepo search` output
    /// Format:
    /// ```text
    /// The package names:
    ///     zlib:
    ///     -> zlib-1.3.1: A Massively Spiffy Yet Delicately Unobtrusive Compression Library (in builtin-repo)
    /// ```
    /// Or newer format:
    /// ```text
    /// zlib:
    ///     -> zlib: A Massively Spiffy Yet Delicately Unobtrusive Compression Library (in xmake-repo)
    /// ```
    fn parse_search_output(output: &str) -> Vec<(String, Option<String>, Option<String>)> {
        let mut results = Vec::new();

        for line in output.lines() {
            let trimmed = line.trim();

            // Match lines like "-> name-version: description (in repo)"
            // or "-> name: description (in repo)"
            if let Some(arrow_rest) = trimmed.strip_prefix("->") {
                let arrow_rest = arrow_rest.trim();

                // Split at first ':'
                if let Some(colon_pos) = arrow_rest.find(':') {
                    let name_part = arrow_rest[..colon_pos].trim();
                    let desc_part = arrow_rest[colon_pos + 1..].trim();

                    // Parse name and optional version from "name-version" or just "name"
                    // But be careful: package names can contain hyphens (e.g., "boost-system")
                    // The version typically follows last hyphen + digit pattern
                    let (name, version) = Self::split_name_version(name_part);

                    // Remove "(in repo-name)" suffix from description
                    let description = if let Some(paren_pos) = desc_part.rfind(" (in ") {
                        let d = desc_part[..paren_pos].trim();
                        if d.is_empty() {
                            None
                        } else {
                            Some(d.to_string())
                        }
                    } else {
                        let d = desc_part.trim();
                        if d.is_empty() {
                            None
                        } else {
                            Some(d.to_string())
                        }
                    };

                    if !name.is_empty() {
                        results.push((name, version, description));
                    }
                }
            }
        }

        results
    }

    /// Split "name-1.2.3" into ("name", Some("1.2.3")) or "name" into ("name", None)
    /// Handles names with hyphens like "boost-system" by looking for version-like suffix
    fn split_name_version(s: &str) -> (String, Option<String>) {
        // Find the last hyphen followed by a digit
        let bytes = s.as_bytes();
        for i in (0..bytes.len()).rev() {
            if bytes[i] == b'-' && i + 1 < bytes.len() && bytes[i + 1].is_ascii_digit() {
                let name = s[..i].to_string();
                let version = s[i + 1..].to_string();
                return (name, Some(version));
            }
        }
        (s.to_string(), None)
    }

    /// Parse `xrepo info` output for package details
    /// Output format (varies):
    /// ```text
    /// -> description: A compression library
    /// -> homepage: https://zlib.net
    /// -> license: zlib
    /// -> versions: 1.3.1, 1.3, 1.2.13, ...
    /// -> installdir: /path/to/install
    /// -> platforms: windows, macosx, linux
    /// -> configs:
    /// -> configs (builtin):
    ///     -> shared: Enable shared library. (default: false)
    ///     -> vs_runtime: Set vs compiler runtime. (default: MT)
    ///         -> values: {"MT","MD"}
    /// ```
    fn parse_info_output(output: &str) -> XmakePackageInfo {
        let mut info = XmakePackageInfo::default();
        let mut in_configs_section = false;

        for line in output.lines() {
            let trimmed = line.trim();

            if let Some(rest) = trimmed.strip_prefix("->") {
                let rest = rest.trim();

                // Check if this is a top-level field (not deeply indented config entry)
                let indent_level = line.len() - line.trim_start().len();

                if let Some(val) = rest.strip_prefix("description:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.description = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("homepage:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.homepage = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("license:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.license = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("versions:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.versions = v
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("urls:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.repository = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("deps:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.deps = v
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("installdir:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.installdir = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if let Some(val) = rest.strip_prefix("platforms:") {
                    let v = val.trim();
                    if !v.is_empty() {
                        info.platforms = Some(v.to_string());
                    }
                    in_configs_section = false;
                } else if rest.starts_with("configs") && rest.contains(':') {
                    in_configs_section = true;
                } else if in_configs_section && indent_level >= 8 {
                    // Parse config entry: "name: Description. (default: value)"
                    if let Some(colon_pos) = rest.find(':') {
                        let config_name = rest[..colon_pos].trim();
                        let config_rest = rest[colon_pos + 1..].trim();
                        // Skip sub-entries like "-> values: {"MT","MD"}"
                        if config_name != "values" && !config_name.is_empty() {
                            let (description, default_value) =
                                Self::parse_config_entry(config_rest);
                            info.configs.push(XmakeConfig {
                                name: config_name.to_string(),
                                description,
                                default_value,
                            });
                        }
                    }
                } else {
                    in_configs_section = false;
                }
            }
        }

        info
    }

    /// Parse a config entry description: "Enable debug symbols. (default: false)"
    /// Returns (description, default_value)
    fn parse_config_entry(s: &str) -> (String, Option<String>) {
        if let Some(default_start) = s.rfind("(default:") {
            let desc = s[..default_start].trim().to_string();
            let default_part = &s[default_start + 9..];
            let default_val = default_part
                .trim_end_matches(')')
                .trim()
                .to_string();
            (
                desc,
                if default_val.is_empty() {
                    None
                } else {
                    Some(default_val)
                },
            )
        } else {
            (s.to_string(), None)
        }
    }

    /// Parse `xmake require --list` output for installed packages
    /// Format:
    /// ```text
    /// note: install packages:
    ///   -> zlib v1.3.1 .. ok
    ///   -> libpng v1.6.40 .. ok
    /// ```
    /// Or simpler format from xrepo:
    /// ```text
    /// zlib 1.3.1 /path/to/install
    /// ```
    fn parse_installed_output(output: &str) -> Vec<(String, String)> {
        let mut results = Vec::new();

        for line in output.lines() {
            let trimmed = line.trim();

            // Match "-> name vVersion .. ok" pattern
            if let Some(arrow_rest) = trimmed.strip_prefix("->") {
                let parts: Vec<&str> = arrow_rest.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    let version = parts[1].trim_start_matches('v').to_string();
                    if !name.is_empty() && !version.is_empty() {
                        results.push((name, version));
                    }
                }
            }
            // Also handle simple "name version" lines
            else if !trimmed.is_empty()
                && !trimmed.starts_with("note:")
                && !trimmed.starts_with("error:")
                && !trimmed.starts_with("warning:")
            {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    let version = parts[1].trim_start_matches('v').to_string();
                    // Verify the second part looks like a version
                    if version
                        .chars()
                        .next()
                        .map(|c| c.is_ascii_digit())
                        .unwrap_or(false)
                    {
                        results.push((name, version));
                    }
                }
            }
        }

        results
    }

    /// Get installed version of a specific package.
    /// Tries `xrepo fetch --json` first for reliable JSON output, then falls back
    /// to text parsing of `xrepo fetch --deps`, and finally `xmake require --list`.
    async fn query_installed_version(name: &str) -> CogniaResult<Option<String>> {
        // Primary: try xrepo fetch --json (available since xmake 2.6+)
        if let Ok(output) = Self::run_xrepo_combined(&["fetch", "--json", name]).await {
            if let Some(ver) = Self::parse_fetch_json_version(&output) {
                return Ok(Some(ver));
            }
        }

        // Fallback 1: text output from xrepo fetch --deps
        if let Ok(output) = Self::run_xrepo_combined(&["fetch", "--deps", name]).await {
            for line in output.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("->") {
                    let rest = rest.trim();
                    if let Some(val) = rest.strip_prefix("version:") {
                        let v = val.trim().to_string();
                        if !v.is_empty() {
                            return Ok(Some(v));
                        }
                    }
                }
            }
        }

        // Fallback 2: check xmake require --list output (project-local)
        if let Ok(output) = Self::run_xmake(&["require", "--list"]).await {
            let installed = Self::parse_installed_output(&output);
            for (pkg_name, version) in installed {
                if pkg_name == name {
                    return Ok(Some(version));
                }
            }
        }

        Ok(None)
    }

    /// Parse JSON output from `xrepo fetch --json`.
    /// Returns the version string if found.
    fn parse_fetch_json_version(output: &str) -> Option<String> {
        // The output may contain non-JSON lines (warnings, etc.) before/after the JSON.
        // Find the first '{' and last '}' to extract JSON.
        let start = output.find('{')?;
        let end = output.rfind('}')? + 1;
        if start >= end {
            return None;
        }
        let json_str = &output[start..end];
        let json: serde_json::Value = serde_json::from_str(json_str).ok()?;
        json.get("version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Parse `xrepo scan` output for globally installed packages.
    /// Format:
    /// ```text
    /// zlib-1.3.1 <hash> plat: windows, arch: x64
    ///   configs: shared=false, debug=false
    /// boost-1.83.0 <hash> plat: linux, arch: x86_64 ${red}unused
    /// ```
    fn parse_scan_output(output: &str) -> Vec<(String, String)> {
        let mut results = Vec::new();

        for line in output.lines() {
            let trimmed = line.trim();

            // Skip empty, note, warning, error lines and indented config lines
            if trimmed.is_empty()
                || trimmed.starts_with("note:")
                || trimmed.starts_with("error:")
                || trimmed.starts_with("warning:")
                || trimmed.starts_with("configs:")
                || trimmed.starts_with("WARN")
            {
                continue;
            }

            // Skip indented sub-lines (configs, etc.)
            if line.starts_with("  ") || line.starts_with("\t") {
                continue;
            }

            // The first token should be "name-version" or "name-version hash ..."
            let first_token = trimmed.split_whitespace().next().unwrap_or("");
            if first_token.is_empty() {
                continue;
            }

            // Strip ANSI color codes that xmake may embed (e.g., ${red})
            let clean_token = Self::strip_xmake_colors(first_token);

            let (name, version) = Self::split_name_version(&clean_token);
            if !name.is_empty() {
                if let Some(ver) = version {
                    results.push((name, ver));
                }
            }
        }

        results
    }

    /// Strip xmake color markers like `${red}`, `${clear}`, etc.
    fn strip_xmake_colors(s: &str) -> String {
        let mut result = String::with_capacity(s.len());
        let mut chars = s.chars().peekable();
        while let Some(ch) = chars.next() {
            if ch == '$' && chars.peek() == Some(&'{') {
                // Skip until '}'
                chars.next(); // consume '{'
                while let Some(c) = chars.next() {
                    if c == '}' {
                        break;
                    }
                }
            } else {
                result.push(ch);
            }
        }
        result
    }

    /// Parse `xrepo list-repo` output.
    /// Format: one repo per line, e.g.:
    /// ```text
    /// xmake-repo https://github.com/xmake-io/xmake-repo.git master
    /// myrepo https://github.com/mygroup/myrepo.git
    /// ```
    #[allow(dead_code)]
    fn parse_list_repo_output(output: &str) -> Vec<(String, String, Option<String>)> {
        let mut repos = Vec::new();
        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with("WARN")
                || trimmed.starts_with("note:")
            {
                continue;
            }
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let url = parts[1].to_string();
                let branch = parts.get(2).map(|s| s.to_string());
                repos.push((name, url, branch));
            }
        }
        repos
    }
}

impl Default for XmakeProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Default)]
struct XmakePackageInfo {
    description: Option<String>,
    homepage: Option<String>,
    license: Option<String>,
    repository: Option<String>,
    versions: Vec<String>,
    deps: Vec<String>,
    configs: Vec<XmakeConfig>,
    installdir: Option<String>,
    platforms: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct XmakeConfig {
    name: String,
    description: String,
    default_value: Option<String>,
}

#[async_trait]
impl Provider for XmakeProvider {
    fn id(&self) -> &str {
        "xmake"
    }
    fn display_name(&self) -> &str {
        "Xmake/Xrepo (C/C++ Package Manager)"
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
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }
    fn priority(&self) -> i32 {
        68
    }

    async fn is_available(&self) -> bool {
        // Check both xmake and xrepo are available
        if process::which("xmake").await.is_none() {
            return false;
        }
        // Verify xmake works
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        match process::execute("xmake", &["--version"], Some(opts)).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);

        // Use `xrepo search <query>`
        let out = Self::run_xrepo_combined(&["search", query]).await?;
        let results = Self::parse_search_output(&out);

        Ok(results
            .into_iter()
            .take(limit)
            .map(|(name, version, description)| PackageSummary {
                name,
                description,
                latest_version: version,
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Use `xrepo info <name>` or `xmake require --info <name>`
        let out = Self::run_xrepo_combined(&["info", name]).await;

        let info = if let Ok(output) = out {
            Self::parse_info_output(&output)
        } else {
            // Fallback to xmake require --info
            let fallback = Self::run_xmake(&["require", "--info", name]).await;
            if let Ok(output) = fallback {
                Self::parse_info_output(&output)
            } else {
                XmakePackageInfo::default()
            }
        };

        let versions: Vec<VersionInfo> = info
            .versions
            .into_iter()
            .map(|v| VersionInfo {
                version: v,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: info.description,
            homepage: info.homepage.or_else(|| {
                Some(format!(
                    "https://xrepo.xmake.io/#/packages/{}/{}",
                    name.chars().next().unwrap_or('_'),
                    name
                ))
            }),
            license: info.license,
            repository: info.repository,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        // Get versions from xrepo info
        let out = Self::run_xrepo_combined(&["info", name]).await;

        if let Ok(output) = out {
            let info = Self::parse_info_output(&output);
            if !info.versions.is_empty() {
                return Ok(info
                    .versions
                    .into_iter()
                    .map(|v| VersionInfo {
                        version: v,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    })
                    .collect());
            }
        }

        Ok(vec![])
    }

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Try xrepo info to get deps
        let out = Self::run_xrepo_combined(&["info", name]).await;

        if let Ok(output) = out {
            let info = Self::parse_info_output(&output);
            if !info.deps.is_empty() {
                return Ok(info
                    .deps
                    .into_iter()
                    .map(|dep_name| Dependency {
                        name: dep_name,
                        constraint: crate::resolver::VersionConstraint::Any,
                    })
                    .collect());
            }
        }

        // Fallback: try xmake require --info for dependency info
        let out = Self::run_xmake(&["require", "--info", name]).await;
        if let Ok(output) = out {
            let info = Self::parse_info_output(&output);
            if !info.deps.is_empty() {
                return Ok(info
                    .deps
                    .into_iter()
                    .map(|dep_name| Dependency {
                        name: dep_name,
                        constraint: crate::resolver::VersionConstraint::Any,
                    })
                    .collect());
            }
        }

        Ok(vec![])
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        Self::query_installed_version(name).await
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        // Build the package spec: "name version" or just "name"
        let pkg_spec = if let Some(v) = &req.version {
            format!("{} {}", req.name, v)
        } else {
            req.name.clone()
        };

        // For force reinstall: remove first, then install
        if req.force {
            let _ = Self::run_xrepo(&["remove", "-y", &req.name]).await;
        }

        // Use xrepo install for global installation with long timeout
        let opts = Self::make_long_opts();
        let out = process::execute("xrepo", &["install", "-y", &pkg_spec], Some(opts)).await?;
        if !out.success {
            return Err(CogniaError::Provider(out.stderr));
        }

        // Get installed version
        let actual_version = Self::query_installed_version(&req.name)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_xmake_packages_dir()
            .unwrap_or_else(|| PathBuf::from(".xmake").join("packages"));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        // xrepo remove [-y] "name [version]"
        let pkg_spec = if let Some(v) = &req.version {
            format!("{} {}", req.name, v)
        } else {
            req.name.clone()
        };
        Self::run_xrepo(&["remove", "-y", &pkg_spec]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let install_path = Self::get_xmake_packages_dir().unwrap_or_default();
        let mut packages = Vec::new();

        // Primary: use `xrepo scan` for global package listing
        if let Ok(output) = Self::run_xrepo_lenient(&["scan"]).await {
            packages = Self::parse_scan_output(&output);
        }

        // Fallback: try `xmake require --list` for project-local packages
        if packages.is_empty() {
            if let Ok(output) = Self::run_xmake(&["require", "--list"]).await {
                packages = Self::parse_installed_output(&output);
            }
        }

        let mut seen = HashSet::new();

        Ok(packages
            .into_iter()
            .filter_map(|(name, version)| {
                if name.is_empty() {
                    return None;
                }

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                if !seen.insert(name.clone()) {
                    return None;
                }

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

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            // Get available versions from repository
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
impl SystemPackageProvider for XmakeProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = Self::run_xmake(&["--version"]).await?;
        // Output: "xmake v2.9.3+HEAD.xxx, ..."
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("xmake") {
                // Extract version like "v2.9.3" or "2.9.3"
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    let ver = parts[1]
                        .trim_start_matches('v')
                        .split('+')
                        .next()
                        .unwrap_or("")
                        .split(',')
                        .next()
                        .unwrap_or("");
                    if !ver.is_empty() {
                        return Ok(ver.to_string());
                    }
                }
            }
        }
        Ok(out.lines().next().unwrap_or("unknown").trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        if let Some(path) = process::which("xmake").await {
            Ok(PathBuf::from(path))
        } else {
            Err(CogniaError::Provider("xmake executable not found".into()))
        }
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "Install xmake: https://xmake.io/#/guide/installation \
             (Windows: winget install xmake, macOS: brew install xmake, \
             Linux: bash <(curl -fsSL https://xmake.io/shget.text))"
                .to_string(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        // xrepo update-repo refreshes all global repository indices
        Self::run_xrepo(&["update-repo"]).await?;
        Ok(())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        // xrepo install will install the latest version
        let opts = Self::make_long_opts();
        let out = process::execute("xrepo", &["install", "-y", name], Some(opts)).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let updates = self.check_updates(&[]).await?;
        let mut upgraded = Vec::new();
        for update in &updates {
            if self.upgrade_package(&update.name).await.is_ok() {
                upgraded.push(update.name.clone());
            }
        }
        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(Self::query_installed_version(name).await?.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_name_version() {
        let (name, version) = XmakeProvider::split_name_version("zlib-1.3.1");
        assert_eq!(name, "zlib");
        assert_eq!(version, Some("1.3.1".to_string()));
    }

    #[test]
    fn test_split_name_version_no_version() {
        let (name, version) = XmakeProvider::split_name_version("zlib");
        assert_eq!(name, "zlib");
        assert_eq!(version, None);
    }

    #[test]
    fn test_split_name_version_hyphenated_name() {
        let (name, version) = XmakeProvider::split_name_version("boost-system-1.83.0");
        assert_eq!(name, "boost-system");
        assert_eq!(version, Some("1.83.0".to_string()));
    }

    #[test]
    fn test_parse_search_output() {
        let output = r#"The package names:
    zlib:
        -> zlib-1.3.1: A Massively Spiffy Yet Delicately Unobtrusive Compression Library (in builtin-repo)
    pcre2:
        -> pcre2-10.42: A Perl Compatible Regular Expressions Library (in xmake-repo)
"#;
        let results = XmakeProvider::parse_search_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "zlib");
        assert_eq!(results[0].1, Some("1.3.1".to_string()));
        assert!(results[0].2.as_ref().unwrap().contains("Compression"));
        assert_eq!(results[1].0, "pcre2");
        assert_eq!(results[1].1, Some("10.42".to_string()));
    }

    #[test]
    fn test_parse_search_output_no_version() {
        let output = r#"The package names:
    zlib:
        -> zlib: A Massively Spiffy Yet Delicately Unobtrusive Compression Library (in xmake-repo)
"#;
        let results = XmakeProvider::parse_search_output(output);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "zlib");
        assert_eq!(results[0].1, None);
    }

    #[test]
    fn test_parse_info_output() {
        let output = r#"require(zlib):
    -> description: A Massively Spiffy Yet Delicately Unobtrusive Compression Library
    -> homepage: http://www.zlib.net
    -> license: zlib
    -> versions: 1.3.1, 1.3, 1.2.13, 1.2.12, 1.2.11
    -> deps: 
    -> configs:
        -> shared: Enable shared library. (default: false)
        -> cflags: Set the C compiler flags.
"#;
        let info = XmakeProvider::parse_info_output(output);
        assert_eq!(
            info.description.as_deref(),
            Some("A Massively Spiffy Yet Delicately Unobtrusive Compression Library")
        );
        assert_eq!(info.homepage.as_deref(), Some("http://www.zlib.net"));
        assert_eq!(info.license.as_deref(), Some("zlib"));
        assert_eq!(
            info.versions,
            vec!["1.3.1", "1.3", "1.2.13", "1.2.12", "1.2.11"]
        );
    }

    #[test]
    fn test_parse_installed_output() {
        let output = r#"note: install packages:
    -> zlib v1.3.1 .. ok
    -> libpng v1.6.40 .. ok
    -> openssl v3.2.0 .. ok
"#;
        let results = XmakeProvider::parse_installed_output(output);
        assert_eq!(results.len(), 3);
        assert_eq!(results[0], ("zlib".to_string(), "1.3.1".to_string()));
        assert_eq!(results[1], ("libpng".to_string(), "1.6.40".to_string()));
        assert_eq!(results[2], ("openssl".to_string(), "3.2.0".to_string()));
    }

    #[test]
    fn test_parse_installed_output_empty() {
        let output = "note: no packages installed\n";
        let results = XmakeProvider::parse_installed_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_info_output_with_configs() {
        let output = r#"require(zlib):
    -> description: A Massively Spiffy Yet Delicately Unobtrusive Compression Library
    -> homepage: http://www.zlib.net
    -> license: zlib
    -> versions: 1.3.1, 1.3
    -> installdir: /Users/ruki/.xmake/packages/z/zlib/1.3.1/abc123
    -> platforms: iphoneos, mingw@windows, macosx, linux
    -> configs:
    -> configs (builtin):
        -> debug: Enable debug symbols. (default: false)
        -> shared: Enable shared library. (default: false)
        -> cflags: Set the C compiler flags.
        -> vs_runtime: Set vs compiler runtime. (default: MT)
            -> values: {"MT","MD"}
"#;
        let info = XmakeProvider::parse_info_output(output);
        assert_eq!(info.description.as_deref(), Some("A Massively Spiffy Yet Delicately Unobtrusive Compression Library"));
        assert_eq!(info.installdir.as_deref(), Some("/Users/ruki/.xmake/packages/z/zlib/1.3.1/abc123"));
        assert_eq!(info.platforms.as_deref(), Some("iphoneos, mingw@windows, macosx, linux"));
        assert!(info.configs.len() >= 3);
        assert_eq!(info.configs[0].name, "debug");
        assert_eq!(info.configs[0].default_value.as_deref(), Some("false"));
        assert_eq!(info.configs[1].name, "shared");
        assert_eq!(info.configs[2].name, "cflags");
        assert_eq!(info.configs[2].default_value, None);
    }

    #[test]
    fn test_parse_info_output_with_deps() {
        let output = r#"require(libpng):
    -> description: The official PNG reference library
    -> versions: 1.6.40
    -> deps: zlib, cmake
"#;
        let info = XmakeProvider::parse_info_output(output);
        assert_eq!(info.deps, vec!["zlib", "cmake"]);
    }

    #[test]
    fn test_parse_config_entry() {
        let (desc, default) = XmakeProvider::parse_config_entry("Enable debug symbols. (default: false)");
        assert_eq!(desc, "Enable debug symbols.");
        assert_eq!(default.as_deref(), Some("false"));
    }

    #[test]
    fn test_parse_config_entry_no_default() {
        let (desc, default) = XmakeProvider::parse_config_entry("Set the C compiler flags.");
        assert_eq!(desc, "Set the C compiler flags.");
        assert_eq!(default, None);
    }

    #[test]
    fn test_parse_fetch_json_version() {
        let output = r#"WARN: some warning
{"name":"zlib","version":"1.3.1","license":"zlib","plat":"windows","arch":"x64"}
"#;
        let ver = XmakeProvider::parse_fetch_json_version(output);
        assert_eq!(ver.as_deref(), Some("1.3.1"));
    }

    #[test]
    fn test_parse_fetch_json_version_no_json() {
        let output = "no json here\n";
        let ver = XmakeProvider::parse_fetch_json_version(output);
        assert!(ver.is_none());
    }

    #[test]
    fn test_parse_scan_output() {
        let output = r#"zlib-1.3.1 abc123def plat: windows, arch: x64
  configs: shared=false, debug=false
boost-1.83.0 def456ghi plat: linux, arch: x86_64
openssl-3.2.0 ghi789jkl plat: windows, arch: x64
"#;
        let results = XmakeProvider::parse_scan_output(output);
        assert_eq!(results.len(), 3);
        assert_eq!(results[0], ("zlib".to_string(), "1.3.1".to_string()));
        assert_eq!(results[1], ("boost".to_string(), "1.83.0".to_string()));
        assert_eq!(results[2], ("openssl".to_string(), "3.2.0".to_string()));
    }

    #[test]
    fn test_parse_scan_output_with_colors() {
        let output = "zlib-1.3.1 abc123 plat: windows ${red}unused\n";
        let results = XmakeProvider::parse_scan_output(output);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "zlib");
        assert_eq!(results[0].1, "1.3.1");
    }

    #[test]
    fn test_parse_scan_output_empty() {
        let output = "note: no packages found\n";
        let results = XmakeProvider::parse_scan_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_strip_xmake_colors() {
        assert_eq!(XmakeProvider::strip_xmake_colors("hello${red}world"), "helloworld");
        assert_eq!(XmakeProvider::strip_xmake_colors("${clear}text"), "text");
        assert_eq!(XmakeProvider::strip_xmake_colors("no colors"), "no colors");
    }

    #[test]
    fn test_parse_list_repo_output() {
        let output = r#"xmake-repo https://github.com/xmake-io/xmake-repo.git master
myrepo https://github.com/mygroup/myrepo.git
"#;
        let repos = XmakeProvider::parse_list_repo_output(output);
        assert_eq!(repos.len(), 2);
        assert_eq!(repos[0].0, "xmake-repo");
        assert_eq!(repos[0].1, "https://github.com/xmake-io/xmake-repo.git");
        assert_eq!(repos[0].2.as_deref(), Some("master"));
        assert_eq!(repos[1].0, "myrepo");
        assert_eq!(repos[1].2, None);
    }

    #[test]
    fn test_capabilities_include_upgrade_and_update_index() {
        let provider = XmakeProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::UpdateIndex));
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Search));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = XmakeProvider::new();
        assert_eq!(provider.id(), "xmake");
        assert_eq!(provider.display_name(), "Xmake/Xrepo (C/C++ Package Manager)");
        assert_eq!(provider.priority(), 68);
    }

    #[test]
    fn test_homepage_url_format() {
        // Verify the URL pattern includes both first char and full name
        let url = format!(
            "https://xrepo.xmake.io/#/packages/{}/{}",
            "zlib".chars().next().unwrap_or('_'),
            "zlib"
        );
        assert_eq!(url, "https://xrepo.xmake.io/#/packages/z/zlib");
    }

    #[test]
    fn test_split_name_version_trailing_hyphen() {
        let (name, version) = XmakeProvider::split_name_version("boost-system");
        assert_eq!(name, "boost-system");
        assert_eq!(version, None);
    }
}
