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

/// Conan 2.x - C/C++ Package Manager
///
/// Supports Conan 2.x CLI for searching, installing, listing, and managing
/// C/C++ packages from ConanCenter and custom remotes.
///
/// Key Conan 2.x commands used:
///   - `conan search <query> -r conancenter` — Search packages in remote
///   - `conan install --requires=<ref>` — Install a package
///   - `conan list "*" -c` — List local cache packages
///   - `conan list "*" -r conancenter` — List remote packages
///   - `conan remove <ref> -c` — Remove from local cache
///   - `conan graph info --requires=<ref> --format=json` — Dependency graph
///   - `conan profile detect` / `conan profile list` — Profile management
///   - `conan version` — Version info
pub struct ConanProvider {
    /// Custom remote name (defaults to "conancenter")
    default_remote: String,
}

impl ConanProvider {
    pub fn new() -> Self {
        Self {
            default_remote: "conancenter".to_string(),
        }
    }

    /// Set a custom default remote name
    pub fn with_remote(mut self, remote: impl Into<String>) -> Self {
        self.default_remote = remote.into();
        self
    }

    fn make_opts(&self) -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(120))
    }

    async fn run_conan(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = self.make_opts();
        let out = process::execute("conan", args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run conan and return stdout+stderr combined (some commands output to stderr)
    async fn run_conan_combined(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = self.make_opts();
        let out = process::execute("conan", args, Some(opts)).await?;
        if out.success {
            let combined = if out.stdout.is_empty() {
                out.stderr
            } else {
                out.stdout
            };
            Ok(combined)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    fn get_conan_home() -> Option<PathBuf> {
        std::env::var("CONAN_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    std::env::var("USERPROFILE")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".conan2"))
                } else {
                    std::env::var("HOME")
                        .ok()
                        .map(|h| PathBuf::from(h).join(".conan2"))
                }
            })
    }

    /// Parse a Conan 2.x package reference: "name/version" or "name/version@user/channel"
    fn parse_ref(reference: &str) -> Option<(String, String)> {
        let ref_part = reference.split('#').next().unwrap_or(reference);
        let ref_part = ref_part.split('@').next().unwrap_or(ref_part);
        let parts: Vec<&str> = ref_part.splitn(2, '/').collect();
        if parts.len() >= 2 {
            Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
        } else {
            Some((parts[0].trim().to_string(), String::new()))
        }
    }

    /// Parse `conan list` output (text format)
    /// Output format:
    /// ```
    /// Local Cache
    ///   name/version
    ///     revisions
    ///       ...
    /// ```
    fn parse_list_output(output: &str) -> Vec<(String, String)> {
        let mut results = Vec::new();
        for line in output.lines() {
            let trimmed = line.trim();
            // Skip headers and empty lines
            if trimmed.is_empty()
                || trimmed.starts_with("Local Cache")
                || trimmed.starts_with("conancenter")
                || trimmed.starts_with("revisions")
                || trimmed.starts_with("packages")
                || trimmed.starts_with("timestamp")
                || trimmed.starts_with("Remote")
                || trimmed.starts_with("WARNING")
                || trimmed.starts_with("WARN")
            {
                continue;
            }

            // A package reference line looks like: "name/version" or "  name/version"
            if trimmed.contains('/') && !trimmed.contains(':') && !trimmed.starts_with('#') {
                if let Some((name, version)) = Self::parse_ref(trimmed) {
                    if !name.is_empty() && !version.is_empty() {
                        results.push((name, version));
                    }
                }
            }
        }
        results
    }

    /// Query the installed version of a specific package from local cache
    async fn query_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        let pattern = format!("{}/*", name);
        let out = self.run_conan(&["list", &pattern, "-c"]).await;
        if let Ok(output) = out {
            let packages = Self::parse_list_output(&output);
            for (pkg_name, version) in packages {
                if pkg_name == name {
                    return Ok(Some(version));
                }
            }
        }
        Ok(None)
    }
}

impl Default for ConanProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ConanProvider {
    fn id(&self) -> &str {
        "conan"
    }
    fn display_name(&self) -> &str {
        "Conan (C/C++ Package Manager)"
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
        72
    }

    async fn is_available(&self) -> bool {
        if process::which("conan").await.is_none() {
            return false;
        }
        // Verify conan works and is version 2.x
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        match process::execute("conan", &["version"], Some(opts)).await {
            Ok(output) => {
                if !output.success {
                    return false;
                }
                // Conan 2.x output: "Conan version 2.x.y"
                // Ensure it's Conan 2.x (not 1.x which has different CLI)
                let text = format!("{}{}", output.stdout, output.stderr);
                text.contains("version 2.") || text.contains("version 3.")
            }
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        let limit = options.limit.unwrap_or(20);

        // Conan 2.x: `conan search <query> -r <remote>`
        let remote = &self.default_remote;
        let out = self.run_conan(&["search", query, "-r", remote]).await;

        if let Ok(output) = out {
            // Conan 2.x search output: one reference per line
            let results: Vec<PackageSummary> = output
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    !t.is_empty()
                        && t.contains('/')
                        && !t.starts_with("WARN")
                        && !t.starts_with("Remote")
                        && !t.starts_with("ERROR")
                })
                .take(limit)
                .filter_map(|line| {
                    let trimmed = line.trim();
                    let (name, version) = Self::parse_ref(trimmed)?;
                    if name.is_empty() {
                        return None;
                    }
                    Some(PackageSummary {
                        name,
                        description: None,
                        latest_version: if version.is_empty() {
                            None
                        } else {
                            Some(version)
                        },
                        provider: self.id().into(),
                    })
                })
                .collect();

            if !results.is_empty() {
                return Ok(results);
            }
        }

        // Fallback: try `conan list "<query>*" -r <remote>` for broader matching
        let pattern = format!("{}*", query);
        let out = self
            .run_conan(&["list", &pattern, "-r", remote])
            .await;

        if let Ok(output) = out {
            let packages = Self::parse_list_output(&output);
            let results: Vec<PackageSummary> = packages
                .into_iter()
                .take(limit)
                .map(|(name, version)| PackageSummary {
                    name,
                    description: None,
                    latest_version: Some(version),
                    provider: self.id().into(),
                })
                .collect();
            return Ok(results);
        }

        Ok(vec![])
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        // Try to get info via `conan list <name>/* -r <remote>`
        let pattern = format!("{}/*", name);
        let remote = &self.default_remote;

        let mut versions = Vec::new();

        // Get versions from remote
        let out = self.run_conan(&["list", &pattern, "-r", remote]).await;
        if let Ok(output) = out {
            let packages = Self::parse_list_output(&output);
            for (pkg_name, version) in packages {
                if pkg_name == name {
                    versions.push(VersionInfo {
                        version,
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    });
                }
            }
        }

        // Try inspect for more details if we have a version
        let mut description = None;
        let mut homepage = None;
        let mut license = None;
        let mut repository = None;

        if let Some(latest) = versions.first() {
            let ref_str = format!("{}/{}", name, latest.version);
            let inspect_out = self
                .run_conan(&["inspect", &ref_str, "-r", remote])
                .await;
            if let Ok(inspect) = inspect_out {
                for line in inspect.lines() {
                    let trimmed = line.trim();
                    if let Some(val) = trimmed.strip_prefix("description:") {
                        let v = val.trim().trim_matches('"').trim_matches('\'');
                        if !v.is_empty() && v != "None" {
                            description = Some(v.to_string());
                        }
                    } else if let Some(val) = trimmed.strip_prefix("homepage:") {
                        let v = val.trim().trim_matches('"').trim_matches('\'');
                        if !v.is_empty() && v != "None" {
                            homepage = Some(v.to_string());
                        }
                    } else if let Some(val) = trimmed.strip_prefix("license:") {
                        let v = val.trim().trim_matches('"').trim_matches('\'');
                        if !v.is_empty() && v != "None" {
                            license = Some(v.to_string());
                        }
                    } else if let Some(val) = trimmed.strip_prefix("url:") {
                        let v = val.trim().trim_matches('"').trim_matches('\'');
                        if !v.is_empty() && v != "None" {
                            repository = Some(v.to_string());
                        }
                    }
                }
            }
        }

        // Fallback homepage to ConanCenter page
        if homepage.is_none() {
            homepage = Some(format!(
                "https://conan.io/center/recipes/{}",
                name
            ));
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage,
            license,
            repository,
            versions,
            provider: self.id().into(),
        })
    }

    async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let pattern = format!("{}/*", name);
        let remote = &self.default_remote;
        let out = self.run_conan(&["list", &pattern, "-r", remote]).await;

        if let Ok(output) = out {
            let packages = Self::parse_list_output(&output);
            let versions: Vec<VersionInfo> = packages
                .into_iter()
                .filter(|(n, _)| n == name)
                .map(|(_, version)| VersionInfo {
                    version,
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                })
                .collect();

            if !versions.is_empty() {
                return Ok(versions);
            }
        }

        Ok(vec![])
    }

    async fn get_dependencies(&self, name: &str, version: &str) -> CogniaResult<Vec<Dependency>> {
        // Use `conan graph info --requires=name/version --format=json`
        let ref_str = if version.is_empty() {
            // Try to get latest version first
            if let Ok(versions) = self.get_versions(name).await {
                if let Some(v) = versions.first() {
                    format!("{}/{}", name, v.version)
                } else {
                    return Ok(vec![]);
                }
            } else {
                return Ok(vec![]);
            }
        } else {
            format!("{}/{}", name, version)
        };

        let requires_arg = format!("--requires={}", ref_str);
        let out = self
            .run_conan(&["graph", "info", &requires_arg, "--format=json"])
            .await;

        if let Ok(output) = out {
            // Parse JSON output for dependencies
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let mut deps = Vec::new();

                // Conan 2.x graph info JSON has "nodes" array
                if let Some(nodes) = json["nodes"].as_array() {
                    for node in nodes {
                        // Skip the root node (context == "consumer")
                        if node["context"].as_str() == Some("consumer") {
                            continue;
                        }
                        // Skip the package itself
                        let node_ref = node["ref"].as_str().unwrap_or("");
                        if node_ref.starts_with(&format!("{}/", name)) {
                            continue;
                        }

                        if let Some((dep_name, _)) = Self::parse_ref(node_ref) {
                            if !dep_name.is_empty() && dep_name != name {
                                deps.push(Dependency {
                                    name: dep_name,
                                    constraint: crate::resolver::VersionConstraint::Any,
                                });
                            }
                        }
                    }
                }
                // Also check "graph" -> "nodes" format (varies by Conan version)
                else if let Some(graph) = json.get("graph") {
                    if let Some(nodes) = graph["nodes"].as_object() {
                        for (_id, node) in nodes {
                            let node_ref = node["ref"].as_str().unwrap_or("");
                            if node_ref.starts_with(&format!("{}/", name))
                                || node_ref == "conanfile"
                            {
                                continue;
                            }
                            if let Some((dep_name, _)) = Self::parse_ref(node_ref) {
                                if !dep_name.is_empty() && dep_name != name {
                                    deps.push(Dependency {
                                        name: dep_name,
                                        constraint: crate::resolver::VersionConstraint::Any,
                                    });
                                }
                            }
                        }
                    }
                }

                if !deps.is_empty() {
                    return Ok(deps);
                }
            }
        }

        Ok(vec![])
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        self.query_installed_version(name).await
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        // Build the requires reference
        let ref_str = if let Some(v) = &req.version {
            format!("{}/{}", req.name, v)
        } else {
            // Get latest version from remote
            let latest = self
                .get_versions(&req.name)
                .await
                .ok()
                .and_then(|vs| vs.into_iter().next())
                .map(|v| v.version)
                .unwrap_or_else(|| "latest".to_string());
            format!("{}/{}", req.name, latest)
        };

        let requires_arg = format!("--requires={}", ref_str);

        // `conan install --requires=name/version --build=missing`
        self.run_conan(&["install", &requires_arg, "--build=missing"])
            .await?;

        // Get the actual installed version from cache
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = Self::get_conan_home()
            .map(|p| p.join("p"))
            .unwrap_or_else(|| PathBuf::from(".conan2").join("p"));

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
        // Conan 2.x: `conan remove "<name>/*" -c` removes from local cache
        let pattern = format!("{}/*", req.name);
        // The -c flag confirms without interactive prompt
        self.run_conan(&["remove", &pattern, "-c"]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        // Conan 2.x: `conan list "*" -c` lists all local cache packages
        let out = self.run_conan(&["list", "*", "-c"]).await?;
        let install_path = Self::get_conan_home()
            .map(|p| p.join("p"))
            .unwrap_or_default();

        let packages = Self::parse_list_output(&out);

        // Deduplicate: keep only the latest version per package name
        let mut seen = HashSet::new();

        Ok(packages
            .into_iter()
            .filter_map(|(name, version)| {
                if name.is_empty() {
                    return None;
                }

                if let Some(name_filter) = &filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                // Keep only the first (latest) version per package
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

            // Get available versions from remote
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
impl SystemPackageProvider for ConanProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_conan_combined(&["version"]).await?;
        // Output: "Conan version 2.x.y"
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("version") {
                if let Some(ver) = trimmed.split("version").last() {
                    let v = ver.trim();
                    if !v.is_empty() {
                        return Ok(v.to_string());
                    }
                }
            }
            // Alternative: just a version number on its own line
            if trimmed
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
            {
                return Ok(trimmed.to_string());
            }
        }
        Ok(out.lines().next().unwrap_or("unknown").trim().to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        if let Some(path) = process::which("conan").await {
            Ok(PathBuf::from(path))
        } else {
            Err(CogniaError::Provider("conan executable not found".into()))
        }
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install Conan: pip install conan (requires Python 3.6+)".to_string())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.query_installed_version(name).await?.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ref() {
        let (name, version) = ConanProvider::parse_ref("zlib/1.3.1").unwrap();
        assert_eq!(name, "zlib");
        assert_eq!(version, "1.3.1");
    }

    #[test]
    fn test_parse_ref_with_user_channel() {
        let (name, version) = ConanProvider::parse_ref("boost/1.83.0@user/stable").unwrap();
        assert_eq!(name, "boost");
        assert_eq!(version, "1.83.0");
    }

    #[test]
    fn test_parse_ref_with_revision() {
        let (name, version) =
            ConanProvider::parse_ref("openssl/3.2.0#abc123").unwrap();
        assert_eq!(name, "openssl");
        assert_eq!(version, "3.2.0");
    }

    #[test]
    fn test_parse_ref_name_only() {
        let (name, version) = ConanProvider::parse_ref("zlib").unwrap();
        assert_eq!(name, "zlib");
        assert_eq!(version, "");
    }

    #[test]
    fn test_parse_list_output() {
        let output = r#"Local Cache
  zlib/1.3.1
    revisions
      abc123 (2024-01-15 10:00:00 UTC)
  boost/1.83.0
    revisions
      def456 (2024-01-10 08:00:00 UTC)
  openssl/3.2.0
    revisions
      ghi789 (2024-01-12 12:00:00 UTC)
"#;
        let results = ConanProvider::parse_list_output(output);
        assert_eq!(results.len(), 3);
        assert_eq!(results[0], ("zlib".to_string(), "1.3.1".to_string()));
        assert_eq!(results[1], ("boost".to_string(), "1.83.0".to_string()));
        assert_eq!(results[2], ("openssl".to_string(), "3.2.0".to_string()));
    }

    #[test]
    fn test_parse_list_output_empty() {
        let output = "Local Cache\n";
        let results = ConanProvider::parse_list_output(output);
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_list_output_with_warnings() {
        let output = r#"WARN: Some warning message
Local Cache
  fmt/10.2.1
"#;
        let results = ConanProvider::parse_list_output(output);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0], ("fmt".to_string(), "10.2.1".to_string()));
    }

    #[test]
    fn test_default_remote() {
        let provider = ConanProvider::new();
        assert_eq!(provider.default_remote, "conancenter");
    }

    #[test]
    fn test_custom_remote() {
        let provider = ConanProvider::new().with_remote("my-remote");
        assert_eq!(provider.default_remote, "my-remote");
    }
}
