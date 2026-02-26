use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;

/// LuaRocks - The package manager for Lua modules
///
/// Uses `luarocks` CLI for package management.
/// Supports searching, installing, and managing Lua rocks (modules).
pub struct LuaRocksProvider;

impl LuaRocksProvider {
    pub fn new() -> Self {
        Self
    }

    async fn run_luarocks(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let out = process::execute("luarocks", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Get the installed version of a rock using --mversion (O(1) lookup)
    async fn query_installed_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_luarocks(&["show", name, "--mversion"]).await?;
        let version = out.trim().to_string();
        if version.is_empty() {
            Err(CogniaError::Provider(format!("Rock {} not found", name)))
        } else {
            Ok(version)
        }
    }
}

impl Default for LuaRocksProvider {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse `luarocks search` output.
///
/// Format:
/// ```text
/// rockname
///    1.0-1 (rockspec) - https://luarocks.org
///    0.9-1 (src) - https://luarocks.org
///
/// another-rock
///    2.0-1 (rockspec) - https://luarocks.org
/// ```
///
/// Returns a list of (rock_name, Vec<version_string>).
pub fn parse_search_output(output: &str) -> Vec<(String, Vec<String>)> {
    let mut results: Vec<(String, Vec<String>)> = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_versions: Vec<String> = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Search results:") || trimmed.starts_with("==")
        {
            continue;
        }

        // Lines starting with whitespace are version entries under the current rock
        if line.starts_with(' ') || line.starts_with('\t') {
            if current_name.is_some() {
                // Extract version from "   1.0-1 (rockspec) - url"
                if let Some(version) = trimmed.split_whitespace().next() {
                    // Deduplicate: same version can appear with different types (rockspec, src, etc.)
                    if !current_versions.contains(&version.to_string()) {
                        current_versions.push(version.to_string());
                    }
                }
            }
        } else {
            // New rock name - flush previous
            if let Some(name) = current_name.take() {
                if !current_versions.is_empty() {
                    results.push((name, std::mem::take(&mut current_versions)));
                }
            }
            current_name = Some(trimmed.to_string());
            current_versions.clear();
        }
    }

    // Flush last entry
    if let Some(name) = current_name {
        if !current_versions.is_empty() {
            results.push((name, current_versions));
        }
    }

    results
}

/// Parse `luarocks list` output.
///
/// Format:
/// ```text
/// Rocks installed for Lua 5.4
/// ---------------------------
///
/// luafilesystem
///    1.8.0-1 (installed) - /usr/local/lib/luarocks/rocks-5.4
///
/// luasocket
///    3.1.0-1 (installed) - /usr/local/lib/luarocks/rocks-5.4
/// ```
///
/// Returns Vec<(name, version, install_path)>.
pub fn parse_list_output(output: &str) -> Vec<(String, String, String)> {
    let mut results: Vec<(String, String, String)> = Vec::new();
    let mut current_name: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with("Rocks installed")
            || trimmed.starts_with("Installed rocks:")
            || trimmed.starts_with("---")
        {
            continue;
        }

        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(ref name) = current_name {
                // Parse "   1.8.0-1 (installed) - /path/to/rocks"
                let parts: Vec<&str> = trimmed.splitn(2, " (installed)").collect();
                if !parts.is_empty() {
                    let version = parts[0].trim().to_string();
                    let path = if parts.len() >= 2 {
                        parts[1].trim().trim_start_matches('-').trim().to_string()
                    } else {
                        String::new()
                    };
                    results.push((name.clone(), version, path));
                }
            }
        } else {
            current_name = Some(trimmed.to_string());
        }
    }

    results
}

/// Parse `luarocks show` output into a key-value map.
///
/// Format:
/// ```text
/// rockname 1.0-1 - Short description
///
/// Description:
///    Long description text...
/// License:    MIT
/// Homepage:   https://example.com
/// Installed in: /usr/local
/// ```
pub fn parse_show_output(output: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut current_key: Option<String> = None;
    let mut current_value = String::new();

    for (i, line) in output.lines().enumerate() {
        // First line is "name version - summary"
        if i == 0 {
            if let Some(dash_pos) = line.find(" - ") {
                let summary = line[dash_pos + 3..].trim();
                if !summary.is_empty() {
                    map.insert("summary".to_string(), summary.to_string());
                }
                // Extract version from "name version - summary"
                let before_dash = line[..dash_pos].trim();
                if let Some(space_pos) = before_dash.rfind(' ') {
                    let version = before_dash[space_pos + 1..].trim();
                    if !version.is_empty() {
                        map.insert("version".to_string(), version.to_string());
                    }
                }
            }
            continue;
        }

        let trimmed = line.trim();

        // Key-value lines like "License:    MIT" or "Homepage:   https://..."
        if let Some(colon_pos) = trimmed.find(':') {
            let key = trimmed[..colon_pos].trim();
            let value = trimmed[colon_pos + 1..].trim();

            // Known keys from luarocks show output
            let known_keys = [
                "License",
                "Homepage",
                "Installed in",
                "Description",
                "Depends on",
                "Modules",
            ];

            if known_keys.iter().any(|k| key.eq_ignore_ascii_case(k)) {
                // Flush previous key
                if let Some(prev_key) = current_key.take() {
                    let val = current_value.trim().to_string();
                    if !val.is_empty() {
                        map.insert(prev_key.to_lowercase(), val);
                    }
                }

                if !value.is_empty() {
                    map.insert(key.to_lowercase(), value.to_string());
                } else {
                    current_key = Some(key.to_lowercase());
                    current_value.clear();
                }
                continue;
            }
        }

        // Continuation lines (indented)
        if let Some(ref _key) = current_key {
            if !trimmed.is_empty() {
                if !current_value.is_empty() {
                    current_value.push(' ');
                }
                current_value.push_str(trimmed);
            }
        }
    }

    // Flush last key
    if let Some(key) = current_key {
        let val = current_value.trim().to_string();
        if !val.is_empty() {
            map.insert(key, val);
        }
    }

    map
}

#[async_trait]
impl Provider for LuaRocksProvider {
    fn id(&self) -> &str {
        "luarocks"
    }

    fn display_name(&self) -> &str {
        "LuaRocks (Lua Package Manager)"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> i32 {
        75
    }

    async fn is_available(&self) -> bool {
        if process::which("luarocks").await.is_none() {
            return false;
        }
        match process::execute("luarocks", &["--version"], None).await {
            Ok(output) => output.success && !output.stdout.is_empty(),
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);
        let out = self.run_luarocks(&["search", query]).await?;
        let parsed = parse_search_output(&out);

        Ok(parsed
            .into_iter()
            .take(limit)
            .map(|(name, versions)| PackageSummary {
                name,
                description: None,
                latest_version: versions.first().cloned(),
                provider: self.id().into(),
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try local show first (faster, has more info for installed rocks)
        if let Ok(out) = self.run_luarocks(&["show", name]).await {
            let info = parse_show_output(&out);
            let versions = self.get_versions(name).await.unwrap_or_default();

            return Ok(PackageInfo {
                name: name.into(),
                display_name: Some(name.into()),
                description: info
                    .get("summary")
                    .or_else(|| info.get("description"))
                    .cloned(),
                homepage: info.get("homepage").cloned(),
                license: info.get("license").cloned(),
                repository: None,
                versions,
                provider: self.id().into(),
            });
        }

        // Fallback: search for remote info
        let out = self.run_luarocks(&["search", name, "--exact"]).await?;
        let parsed = parse_search_output(&out);

        let versions: Vec<VersionInfo> = parsed
            .iter()
            .filter(|(n, _)| n.eq_ignore_ascii_case(name))
            .flat_map(|(_, vers)| {
                vers.iter().map(|v| VersionInfo {
                    version: v.clone(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
            })
            .collect();

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description: None,
            homepage: None,
            license: None,
            repository: None,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let out = self.run_luarocks(&["search", name, "--exact"]).await?;
        let parsed = parse_search_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(n, _)| n.eq_ignore_ascii_case(name))
            .flat_map(|(_, versions)| {
                versions.into_iter().map(|v| VersionInfo {
                    version: v,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
            })
            .collect())
    }

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        // Try to get deps from installed rock
        if let Ok(out) = self.run_luarocks(&["show", name, "--deps"]).await {
            let mut deps = Vec::new();
            let mut in_depends = false;

            for line in out.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Depends on:") || trimmed == "Dependencies:" {
                    in_depends = true;
                    // Check if deps are on the same line
                    let after = trimmed.split(':').nth(1).unwrap_or("").trim();
                    if !after.is_empty() {
                        for dep in after.split(',') {
                            let dep = dep.trim();
                            if !dep.is_empty() {
                                let parts: Vec<&str> = dep.splitn(2, ' ').collect();
                                let dep_name = parts[0].to_string();
                                if dep_name == "lua" {
                                    continue;
                                }
                                let constraint = if parts.len() > 1 {
                                    parts[1]
                                        .parse::<VersionConstraint>()
                                        .unwrap_or(VersionConstraint::Any)
                                } else {
                                    VersionConstraint::Any
                                };
                                deps.push(Dependency {
                                    name: dep_name,
                                    constraint,
                                });
                            }
                        }
                    }
                    continue;
                }

                if in_depends {
                    if trimmed.is_empty() || (!line.starts_with(' ') && !line.starts_with('\t')) {
                        break;
                    }
                    let parts: Vec<&str> = trimmed.splitn(2, ' ').collect();
                    let dep_name = parts[0].to_string();
                    if dep_name == "lua" {
                        continue;
                    }
                    let constraint = if parts.len() > 1 {
                        parts[1]
                            .parse::<VersionConstraint>()
                            .unwrap_or(VersionConstraint::Any)
                    } else {
                        VersionConstraint::Any
                    };
                    deps.push(Dependency {
                        name: dep_name,
                        constraint,
                    });
                }
            }

            return Ok(deps);
        }

        Ok(vec![])
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let mut args = vec!["install", &req.name];

        let version_str;
        if let Some(v) = &req.version {
            version_str = v.clone();
            args.push(&version_str);
        }

        if req.force {
            args.push("--force");
        }

        self.run_luarocks(&args).await?;

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
            Ok(v) => Ok(Some(v)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["remove", &req.name];

        let version_str;
        if let Some(v) = &req.version {
            version_str = v.clone();
            args.push(&version_str);
        }

        if req.force {
            args.push("--force");
        }

        self.run_luarocks(&args).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_luarocks(&["list"]).await?;
        let parsed = parse_list_output(&out);

        Ok(parsed
            .into_iter()
            .filter(|(name, _, _)| {
                if let Some(ref name_filter) = filter.name_filter {
                    name.contains(name_filter)
                } else {
                    true
                }
            })
            .map(|(name, version, path)| InstalledPackage {
                name,
                version,
                provider: self.id().into(),
                install_path: if path.is_empty() {
                    PathBuf::new()
                } else {
                    PathBuf::from(&path)
                },
                installed_at: String::new(),
                is_global: true,
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let installed = self.list_installed(InstalledFilter::default()).await?;
        let mut updates = Vec::new();

        for pkg in &installed {
            if !packages.is_empty() && !packages.contains(&pkg.name) {
                continue;
            }

            // Get remote versions
            if let Ok(versions) = self.get_versions(&pkg.name).await {
                if let Some(latest) = versions.first() {
                    // Compare: strip the revision for simple comparison
                    let current_base = pkg.version.split('-').next().unwrap_or(&pkg.version);
                    let latest_base = latest.version.split('-').next().unwrap_or(&latest.version);

                    if current_base != latest_base && latest.version != pkg.version {
                        updates.push(UpdateInfo {
                            name: pkg.name.clone(),
                            current_version: pkg.version.clone(),
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
impl SystemPackageProvider for LuaRocksProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_luarocks(&["--version"]).await?;
        // Output: "luarocks 3.11.1" or "/usr/local/bin/luarocks 3.11.1"
        let re = regex::Regex::new(r"(\d+\.\d+\.\d+)")
            .map_err(|e| CogniaError::Provider(e.to_string()))?;
        if let Some(caps) = re.captures(&out) {
            if let Some(version) = caps.get(1) {
                return Ok(version.as_str().to_string());
            }
        }
        Err(CogniaError::Provider(
            "Could not parse LuaRocks version".into(),
        ))
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("luarocks")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("luarocks not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(if cfg!(windows) {
            "Download from https://luarocks.github.io/luarocks/releases/ or install via scoop: scoop install luarocks".to_string()
        } else if cfg!(target_os = "macos") {
            "brew install luarocks".to_string()
        } else {
            "sudo apt install luarocks || sudo dnf install luarocks".to_string()
        })
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_luarocks(&["install", name]).await?;
        Ok(())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.query_installed_version(name).await.is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_search_output_standard() {
        let output = "\
luasocket
   3.1.0-1 (rockspec) - https://luarocks.org
   3.0rc1-2 (rockspec) - https://luarocks.org
   3.0rc1-2 (src) - https://luarocks.org
";
        let results = parse_search_output(output);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "luasocket");
        assert_eq!(results[0].1.len(), 2); // deduplicated
        assert_eq!(results[0].1[0], "3.1.0-1");
        assert_eq!(results[0].1[1], "3.0rc1-2");
    }

    #[test]
    fn test_parse_search_output_multiple_rocks() {
        let output = "\
luasocket
   3.1.0-1 (rockspec) - https://luarocks.org

luasec
   1.3.2-1 (rockspec) - https://luarocks.org
   1.3.1-1 (rockspec) - https://luarocks.org
";
        let results = parse_search_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "luasocket");
        assert_eq!(results[0].1.len(), 1);
        assert_eq!(results[1].0, "luasec");
        assert_eq!(results[1].1.len(), 2);
    }

    #[test]
    fn test_parse_search_output_empty() {
        let output = "";
        let results = parse_search_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_list_output_standard() {
        let output = "\
Rocks installed for Lua 5.4
---------------------------

luafilesystem
   1.8.0-1 (installed) - /usr/local/lib/luarocks/rocks-5.4

luasocket
   3.1.0-1 (installed) - /usr/local/lib/luarocks/rocks-5.4
";
        let results = parse_list_output(output);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "luafilesystem");
        assert_eq!(results[0].1, "1.8.0-1");
        assert_eq!(results[0].2, "/usr/local/lib/luarocks/rocks-5.4");
        assert_eq!(results[1].0, "luasocket");
        assert_eq!(results[1].1, "3.1.0-1");
    }

    #[test]
    fn test_parse_list_output_empty() {
        let output = "\
Rocks installed for Lua 5.4
---------------------------

";
        let results = parse_list_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_show_output() {
        let output = "\
luasocket 3.1.0-1 - Network support for the Lua language

License:    MIT
Homepage:   http://lunarmodules.github.io/luasocket/
Installed in: /usr/local
";
        let info = parse_show_output(output);
        assert_eq!(
            info.get("summary"),
            Some(&"Network support for the Lua language".to_string())
        );
        assert_eq!(info.get("version"), Some(&"3.1.0-1".to_string()));
        assert_eq!(info.get("license"), Some(&"MIT".to_string()));
        assert_eq!(
            info.get("homepage"),
            Some(&"http://lunarmodules.github.io/luasocket/".to_string())
        );
        assert_eq!(info.get("installed in"), Some(&"/usr/local".to_string()));
    }

    #[test]
    fn test_provider_metadata() {
        let provider = LuaRocksProvider::new();
        assert_eq!(provider.id(), "luarocks");
        assert_eq!(provider.display_name(), "LuaRocks (Lua Package Manager)");
        assert!(provider.capabilities().contains(&Capability::Install));
        assert!(provider.capabilities().contains(&Capability::Search));
        assert!(provider.capabilities().contains(&Capability::List));
        assert!(provider.capabilities().contains(&Capability::Uninstall));
        assert!(provider.capabilities().contains(&Capability::Update));
        assert!(provider.capabilities().contains(&Capability::Upgrade));
        assert_eq!(provider.priority(), 75);
        assert_eq!(
            provider.supported_platforms(),
            vec![Platform::Windows, Platform::MacOS, Platform::Linux]
        );
    }

    #[test]
    fn test_requires_elevation() {
        let provider = LuaRocksProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
        assert!(!provider.requires_elevation("upgrade"));
    }
}
