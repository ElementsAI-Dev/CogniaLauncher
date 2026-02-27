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

pub struct VcpkgProvider {
    vcpkg_root: Option<PathBuf>,
    default_triplet: Option<String>,
}

impl VcpkgProvider {
    pub fn new() -> Self {
        let vcpkg_root = std::env::var("VCPKG_ROOT")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                if cfg!(windows) {
                    let candidate = PathBuf::from("C:\\vcpkg");
                    if candidate.exists() {
                        return Some(candidate);
                    }
                    // Also check Program Files
                    if let Ok(pf) = std::env::var("ProgramFiles") {
                        let candidate = PathBuf::from(pf).join("vcpkg");
                        if candidate.exists() {
                            return Some(candidate);
                        }
                    }
                    None
                } else {
                    // Check common Unix locations
                    let candidates = [
                        std::env::var("HOME")
                            .ok()
                            .map(|h| PathBuf::from(h).join("vcpkg")),
                        Some(PathBuf::from("/opt/vcpkg")),
                        Some(PathBuf::from("/usr/local/vcpkg")),
                    ];
                    candidates.into_iter().flatten().find(|p| p.exists())
                }
            });

        let default_triplet = std::env::var("VCPKG_DEFAULT_TRIPLET").ok().or_else(|| {
            if cfg!(target_os = "windows") {
                Some("x64-windows".to_string())
            } else if cfg!(target_os = "macos") {
                Some("x64-osx".to_string())
            } else {
                Some("x64-linux".to_string())
            }
        });

        Self {
            vcpkg_root,
            default_triplet,
        }
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

    fn make_opts(&self) -> ProcessOptions {
        let mut opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        if let Some(root) = &self.vcpkg_root {
            opts = opts.with_cwd(root.to_string_lossy().to_string());
        }
        opts
    }

    async fn run_vcpkg(&self, args: &[&str]) -> CogniaResult<String> {
        let exe = self.get_vcpkg_exe();
        let opts = self.make_opts();
        let out = process::execute(&exe, args, Some(opts)).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Parse a vcpkg list line in format: "name:triplet    version#port-version    description"
    /// or in newer vcpkg: "name:triplet    version    description"
    fn parse_list_line(line: &str) -> Option<(String, String, String)> {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.is_empty() {
            return None;
        }

        // First field is "name:triplet" or just "name"
        let name_triplet = fields[0];
        let name = name_triplet.split(':').next().unwrap_or("").to_string();
        if name.is_empty() {
            return None;
        }

        let version = fields.get(1).unwrap_or(&"").to_string();
        let description = if fields.len() > 2 {
            fields[2..].join(" ")
        } else {
            String::new()
        };

        Some((name, version, description))
    }

    /// Get the installed version of a specific package
    async fn query_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        let out = self.run_vcpkg(&["list", name]).await?;
        for line in out.lines() {
            if let Some((pkg_name, version, _)) = Self::parse_list_line(line) {
                // Exact name match (before the colon/triplet)
                if pkg_name == name {
                    return Ok(Some(version));
                }
            }
        }
        Ok(None)
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
        // First check if executable exists
        let exe = self.get_vcpkg_exe();
        let exists = if let Some(root) = &self.vcpkg_root {
            let exe_path = if cfg!(windows) {
                root.join("vcpkg.exe")
            } else {
                root.join("vcpkg")
            };
            exe_path.exists()
        } else {
            process::which("vcpkg").await.is_some()
        };

        if !exists {
            return false;
        }

        // Verify it actually works
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(10));
        match process::execute(&exe, &["version"], Some(opts)).await {
            Ok(output) => output.success,
            Err(_) => false,
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
            .filter(|l| {
                !l.is_empty()
                    && !l.starts_with("The result")
                    && !l.starts_with("If your")
                    && !l.starts_with("No packages")
            })
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
                if parts.is_empty() {
                    return None;
                }
                let name = parts[0].trim();
                if name.is_empty() {
                    return None;
                }
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
            let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
            if parts.is_empty() {
                continue;
            }
            let line_name = parts[0].trim();
            // Require exact match to avoid "boost" matching "boost-system"
            if line_name != name {
                continue;
            }

            if let Some(desc) = parts.get(1) {
                description = Some(desc.trim().to_string());
            }
            // Extract feature list if present in format name[feature1,feature2]
            if let Some(start) = line.find('[') {
                if let Some(end) = line.find(']') {
                    version = Some(line[start + 1..end].to_string());
                }
            }
            break;
        }

        // Try to get version from installed packages or x-history
        if version.is_none() {
            if let Ok(Some(v)) = self.query_installed_version(name).await {
                version = Some(v);
            }
        }
        if version.is_none() {
            if let Ok(versions) = self.get_versions(name).await {
                if let Some(first) = versions.first() {
                    version = Some(first.version.clone());
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
            homepage: Some(format!("https://vcpkg.io/en/package/{}", name)),
            license: None,
            repository: Some(format!(
                "https://github.com/microsoft/vcpkg/tree/master/ports/{}",
                name
            )),
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
                    let ver = parts.first()?;
                    // Skip lines that don't look like versions
                    if !ver
                        .chars()
                        .next()
                        .map(|c| c.is_ascii_digit())
                        .unwrap_or(false)
                    {
                        return None;
                    }
                    Some(VersionInfo {
                        version: ver.to_string(),
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

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        let exe = self.get_vcpkg_exe();
        let opts = self.make_opts();
        let out = process::execute(&exe, &["depend-info", name], Some(opts)).await;
        if let Ok(result) = out {
            if result.success {
                // Output format: "package[core]: dep1, dep2, dep3"
                return Ok(result
                    .stdout
                    .lines()
                    .filter(|l| !l.trim().is_empty() && l.contains(':'))
                    .flat_map(|line| {
                        // Split at first colon only to handle "pkg[core]: deps"
                        let deps_part = line.split_once(':').map(|x| x.1).unwrap_or("");
                        deps_part
                            .split(',')
                            .filter(|s| !s.trim().is_empty())
                            .map(|dep| {
                                let dep_name = dep.trim().split('[').next().unwrap_or("").trim();
                                Dependency {
                                    name: dep_name.to_string(),
                                    constraint: crate::resolver::VersionConstraint::Any,
                                }
                            })
                            .collect::<Vec<_>>()
                    })
                    .filter(|d| !d.name.is_empty() && d.name != name)
                    .collect());
            }
        }
        Ok(vec![])
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        self.query_installed_version(name).await
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        // Build package spec with optional version and triplet
        let mut pkg = req.name.clone();
        if let Some(triplet) = &self.default_triplet {
            pkg = format!("{}:{}", pkg, triplet);
        }
        if let Some(v) = &req.version {
            // vcpkg version pinning: name@version or name:triplet
            // For classic mode, version pinning via @version
            pkg = if self.default_triplet.is_some() {
                format!(
                    "{}:{}",
                    req.name,
                    self.default_triplet.as_deref().unwrap_or("")
                )
            } else {
                req.name.clone()
            };
            // Note: vcpkg classic mode doesn't support @version syntax well;
            // version is typically controlled by the port baseline
            let _ = v; // version ignored in classic mode, controlled by baseline
        }

        self.run_vcpkg(&["install", &pkg]).await?;

        // Get the actual installed version
        let actual_version = self
            .query_installed_version(&req.name)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| req.version.clone().unwrap_or_else(|| "unknown".into()));

        let install_path = self
            .vcpkg_root
            .as_ref()
            .map(|r| r.join("installed"))
            .unwrap_or_else(|| PathBuf::from("vcpkg").join("installed"));

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
        // Try with default triplet first, fall back to name only
        let pkg = if let Some(triplet) = &self.default_triplet {
            format!("{}:{}", req.name, triplet)
        } else {
            req.name.clone()
        };
        self.run_vcpkg(&["remove", &pkg]).await?;
        Ok(())
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_vcpkg(&["list"]).await?;
        let install_path = self
            .vcpkg_root
            .as_ref()
            .map(|r| r.join("installed"))
            .unwrap_or_default();

        // Deduplicate: the same package may appear for multiple triplets
        let mut seen = HashSet::new();

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let (name, version, _desc) = Self::parse_list_line(line)?;
                if name.is_empty() {
                    return None;
                }

                if let Some(name_filter) = &filter.name_filter {
                    if !name.contains(name_filter) {
                        return None;
                    }
                }

                // Skip duplicate package names (different triplets)
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

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let out = self.run_vcpkg(&["upgrade", "--dry-run"]).await;

        if let Ok(output) = out {
            let updates: Vec<UpdateInfo> = output
                .lines()
                .filter(|l| l.contains("->"))
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split("->").collect();
                    if parts.len() >= 2 {
                        // Left side: "  name:triplet  current_version" or "  name  current_version"
                        let left = parts[0].trim();
                        let left_parts: Vec<&str> = left.split_whitespace().collect();
                        let name_field = left_parts.first()?.trim();
                        let name = name_field.split(':').next()?.to_string();
                        let current = left_parts.get(1).unwrap_or(&"").to_string();
                        let latest = parts[1]
                            .split_whitespace()
                            .next()
                            .unwrap_or("")
                            .to_string();

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

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_vcpkg(&["version"]).await?;
        // Output: "vcpkg package management program version 2024.01.12\n..."
        for line in out.lines() {
            if line.contains("version") {
                if let Some(ver) = line.split("version").last() {
                    let v = ver.trim().trim_end_matches('.');
                    if !v.is_empty() {
                        return Ok(v.to_string());
                    }
                }
            }
        }
        Ok(out.lines().next().unwrap_or("unknown").to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        let exe = self.get_vcpkg_exe();
        if let Some(path) = process::which(&exe).await {
            Ok(PathBuf::from(path))
        } else if let Some(root) = &self.vcpkg_root {
            let exe_path = if cfg!(windows) {
                root.join("vcpkg.exe")
            } else {
                root.join("vcpkg")
            };
            if exe_path.exists() {
                Ok(exe_path)
            } else {
                Err(CogniaError::Provider("vcpkg executable not found".into()))
            }
        } else {
            Err(CogniaError::Provider("vcpkg executable not found".into()))
        }
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("Install vcpkg: git clone https://github.com/microsoft/vcpkg && ./vcpkg/bootstrap-vcpkg.sh (Linux/macOS) or .\\vcpkg\\bootstrap-vcpkg.bat (Windows)".to_string())
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        Ok(self.query_installed_version(name).await?.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_list_line() {
        // Format: "name:triplet    version    description"
        let line = "boost-system:x64-windows   1.83.0   Boost system module";
        let result = VcpkgProvider::parse_list_line(line);
        assert!(result.is_some());
        let (name, version, desc) = result.unwrap();
        assert_eq!(name, "boost-system");
        assert_eq!(version, "1.83.0");
        assert_eq!(desc, "Boost system module");
    }

    #[test]
    fn test_parse_list_line_no_triplet() {
        let line = "zlib   1.3   A compression library";
        let result = VcpkgProvider::parse_list_line(line);
        assert!(result.is_some());
        let (name, version, _) = result.unwrap();
        assert_eq!(name, "zlib");
        assert_eq!(version, "1.3");
    }

    #[test]
    fn test_parse_list_line_empty() {
        assert!(VcpkgProvider::parse_list_line("").is_none());
    }

    #[test]
    fn test_default_triplet() {
        let provider = VcpkgProvider::new();
        assert!(provider.default_triplet.is_some());
    }

    #[test]
    fn test_provider_metadata() {
        let provider = VcpkgProvider::new();
        assert_eq!(provider.id(), "vcpkg");
        assert_eq!(
            provider.display_name(),
            "vcpkg (C++ Package Manager)"
        );
        assert_eq!(provider.priority(), 70);
    }

    #[test]
    fn test_capabilities() {
        let provider = VcpkgProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
    }

    #[test]
    fn test_supported_platforms() {
        let provider = VcpkgProvider::new();
        let platforms = provider.supported_platforms();
        assert!(platforms.contains(&Platform::Windows));
        assert!(platforms.contains(&Platform::MacOS));
        assert!(platforms.contains(&Platform::Linux));
    }

    #[test]
    fn test_requires_elevation() {
        let provider = VcpkgProvider::new();
        assert!(!provider.requires_elevation("install"));
        assert!(!provider.requires_elevation("uninstall"));
    }
}
