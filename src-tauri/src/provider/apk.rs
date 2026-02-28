use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::Platform,
    process::{self, ProcessOptions},
};
use crate::resolver::{Dependency, VersionConstraint};
use async_trait::async_trait;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

const APK_TIMEOUT: u64 = 120;
const APK_SUDO_TIMEOUT: u64 = 300;
const APK_LONG_TIMEOUT: u64 = 600;

/// APK - Alpine Package Keeper for Alpine Linux
pub struct ApkProvider;

impl ApkProvider {
    pub fn new() -> Self {
        Self
    }

    fn make_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(APK_TIMEOUT))
    }

    fn make_sudo_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(APK_SUDO_TIMEOUT))
    }

    fn make_long_opts() -> ProcessOptions {
        ProcessOptions::new().with_timeout(Duration::from_secs(APK_LONG_TIMEOUT))
    }

    async fn run_apk(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("apk", args, Some(Self::make_opts())).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Run apk and return stdout regardless of exit code
    async fn run_apk_lenient(&self, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute("apk", args, Some(Self::make_opts())).await?;
        Ok(out.stdout)
    }

    /// Get the installed version of a package using `apk info -v`.
    /// Output lines look like `curl-8.4.0-r0` — we strip the known package name prefix.
    async fn get_pkg_version(&self, name: &str) -> CogniaResult<String> {
        let out = self.run_apk(&["info", "-v", name]).await?;
        for line in out.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // The output is "name-version". Strip the name prefix + the dash.
            let prefix = format!("{}-", name);
            if let Some(version) = line.strip_prefix(&prefix) {
                if !version.is_empty() {
                    return Ok(version.to_string());
                }
            }
        }
        Err(CogniaError::Provider(format!(
            "Version not found for {}",
            name
        )))
    }
}

impl Default for ApkProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ApkProvider {
    fn id(&self) -> &str {
        "apk"
    }

    fn display_name(&self) -> &str {
        "APK (Alpine Linux)"
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
        vec![Platform::Linux]
    }

    fn priority(&self) -> i32 {
        80
    }

    async fn is_available(&self) -> bool {
        if process::which("apk").await.is_none() {
            return false;
        }
        // Verify apk actually works
        match process::execute("apk", &["--version"], None).await {
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
        let out = self.run_apk(&["search", "-v", query]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .take(limit)
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " - ").collect();
                let name_version = parts[0].trim();
                let description = parts.get(1).map(|s| s.trim().to_string());

                let (name, version) = parse_apk_name_version(name_version)?;

                Some(PackageSummary {
                    name,
                    description,
                    latest_version: Some(version),
                    provider: self.id().into(),
                })
            })
            .collect())
    }

    async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
        let out = self.run_apk(&["info", "-a", name]).await?;

        let mut description = None;
        let mut version = None;
        let mut license = None;
        let mut homepage = None;

        for line in out.lines() {
            // apk info -a lines: "pkgname-ver description: ..." or "pkgname-ver webpage: ..."
            if line.contains(" description:") {
                // Use splitn(2, ':') to avoid truncating values
                let parts: Vec<&str> = line.splitn(2, " description:").collect();
                description = parts.get(1).map(|s| s.trim().into());
            } else if line.contains(" webpage:") {
                // Use splitn(2, " webpage:") to preserve full URL
                let parts: Vec<&str> = line.splitn(2, " webpage:").collect();
                homepage = parts.get(1).map(|s| s.trim().into());
            } else if line.contains(" license:") {
                let parts: Vec<&str> = line.splitn(2, " license:").collect();
                license = parts.get(1).map(|s| s.trim().into());
            }
            // Extract version from lines like "curl-8.4.0-r0 description:..."
            if version.is_none() {
                let first_word = line.split_whitespace().next().unwrap_or("");
                if let Some(v) = first_word.strip_prefix(&format!("{}-", name)) {
                    if !v.is_empty() {
                        version = Some(v.to_string());
                    }
                }
            }
        }

        Ok(PackageInfo {
            name: name.into(),
            display_name: Some(name.into()),
            description,
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
        let info = self.get_package_info(name).await?;
        Ok(info.versions)
    }

    async fn install(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
        let pkg = if let Some(v) = &req.version {
            format!("{}={}", req.name, v)
        } else {
            req.name.clone()
        };

        let mut args = vec!["apk", "add"];
        if req.force {
            args.push("--force");
        }
        args.push(&pkg);

        let out =
            process::execute("sudo", &args, Some(Self::make_long_opts())).await?;
        if !out.success {
            return Err(CogniaError::Installation(out.stderr));
        }

        // Get the actual installed version
        let actual_version = self
            .get_pkg_version(&req.name)
            .await
            .unwrap_or_else(|_| req.version.clone().unwrap_or_else(|| "unknown".into()));

        Ok(InstallReceipt {
            name: req.name,
            version: actual_version,
            provider: self.id().into(),
            install_path: PathBuf::from("/usr"),
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
        match self.get_pkg_version(name).await {
            Ok(version) => Ok(Some(version)),
            Err(_) => Ok(None),
        }
    }

    async fn uninstall(&self, req: UninstallRequest) -> CogniaResult<()> {
        let mut args = vec!["apk", "del"];
        if req.force {
            args.push("--force");
        }
        args.push(&req.name);

        let out =
            process::execute("sudo", &args, Some(Self::make_sudo_opts())).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn list_installed(&self, filter: InstalledFilter) -> CogniaResult<Vec<InstalledPackage>> {
        let out = self.run_apk(&["list", "--installed"]).await?;

        Ok(out
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                // Format: "name-version arch {origin} (license)"
                let first_token = line.split_whitespace().next()?;
                let (name, version) = parse_apk_name_version(first_token)?;

                if let Some(ref name_filter) = filter.name_filter {
                    if !name.to_lowercase().contains(&name_filter.to_lowercase()) {
                        return None;
                    }
                }

                Some(InstalledPackage {
                    name,
                    version,
                    provider: self.id().into(),
                    install_path: PathBuf::from("/usr"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect())
    }

    async fn check_updates(&self, packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        // `apk version -v -l '<'` outputs lines like:
        // "curl-8.3.0-r0 < 8.4.0-r0"
        let out = self.run_apk_lenient(&["version", "-v", "-l", "<"]).await;

        if let Ok(output) = out {
            return Ok(output
                .lines()
                .filter(|l| !l.is_empty() && l.contains('<'))
                .filter_map(|line| {
                    // Format: "name-current_version < new_version"
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    // Expect: ["name-ver", "<", "new_ver"] or more tokens
                    if parts.len() < 3 {
                        return None;
                    }

                    let name_ver = parts[0];
                    let (name, current_version) = parse_apk_name_version(name_ver)?;

                    if !packages.is_empty() && !packages.contains(&name) {
                        return None;
                    }

                    // The new version is after the '<' sign
                    let latest_version = parts[2].to_string();

                    Some(UpdateInfo {
                        name,
                        current_version,
                        latest_version,
                        provider: self.id().into(),
                    })
                })
                .collect());
        }

        Ok(vec![])
    }

    async fn get_dependencies(&self, name: &str, _version: &str) -> CogniaResult<Vec<Dependency>> {
        let out = self.run_apk(&["info", "-R", name]).await?;
        let mut deps = Vec::new();
        let mut in_depends = false;

        for line in out.lines() {
            if line.contains("depends on:") {
                in_depends = true;
                continue;
            }
            if in_depends {
                let dep = line.trim();
                if dep.is_empty() {
                    break;
                }
                // Dependency lines can be "name" or "name>=version"
                let dep_name = dep.split(|c| c == '>' || c == '<' || c == '=' || c == '~')
                    .next()
                    .unwrap_or(dep)
                    .to_string();
                if !dep_name.is_empty() {
                    deps.push(Dependency {
                        name: dep_name,
                        constraint: VersionConstraint::Any,
                    });
                }
            }
        }

        Ok(deps)
    }
}

#[async_trait]
impl SystemPackageProvider for ApkProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, op: &str) -> bool {
        matches!(op, "install" | "uninstall" | "update" | "upgrade")
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let out = self.run_apk(&["--version"]).await?;
        let version = out.split_whitespace().nth(1).unwrap_or("").to_string();
        Ok(version)
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("apk")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("apk not found".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some(
            "APK is the default package manager on Alpine Linux. It should be pre-installed."
                .into(),
        )
    }

    async fn update_index(&self) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apk", "update"], Some(ApkProvider::make_sudo_opts())).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        let out = process::execute("sudo", &["apk", "upgrade", name], Some(ApkProvider::make_sudo_opts())).await?;
        if out.success {
            Ok(())
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let out = process::execute("sudo", &["apk", "upgrade"], Some(ApkProvider::make_long_opts())).await?;
        if out.success {
            Ok(vec!["All packages upgraded".into()])
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let out = self.run_apk(&["info", "-e", name]).await;
        Ok(out.is_ok())
    }
}

/// Parse an Alpine package name-version string like "curl-8.4.0-r0" into ("curl", "8.4.0-r0").
/// Alpine versions always end with `-rN` (revision number). We find the version boundary
/// by looking for the pattern `-<digit>` that precedes the version portion.
pub fn parse_apk_name_version(s: &str) -> Option<(String, String)> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    // Find the last occurrence of "-<digit>" which starts the version.
    // We scan from the end to find the version start.
    // Version in Alpine always matches: digit...  (e.g., "8.4.0-r0", "1.36.1-r2", "2.42.0-r0")
    let bytes = s.as_bytes();
    let mut split_pos = None;
    for i in (1..bytes.len()).rev() {
        if bytes[i - 1] == b'-' && bytes[i].is_ascii_digit() {
            split_pos = Some(i - 1);
            break;
        }
    }
    let pos = split_pos?;
    let name = s[..pos].to_string();
    let version = s[pos + 1..].to_string();
    if name.is_empty() || version.is_empty() {
        return None;
    }
    Some((name, version))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = ApkProvider::new();
        assert_eq!(p.id(), "apk");
        assert_eq!(p.display_name(), "APK (Alpine Linux)");
        assert_eq!(p.priority(), 80);
    }

    #[test]
    fn test_capabilities() {
        let p = ApkProvider::new();
        let caps = p.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::UpdateIndex));
        assert_eq!(caps.len(), 7);
    }

    #[test]
    fn test_supported_platforms() {
        let p = ApkProvider::new();
        let platforms = p.supported_platforms();
        assert!(platforms.contains(&Platform::Linux));
        assert_eq!(platforms.len(), 1);
    }

    #[test]
    fn test_requires_elevation() {
        let p = ApkProvider::new();
        assert!(p.requires_elevation("install"));
        assert!(p.requires_elevation("uninstall"));
        assert!(p.requires_elevation("update"));
        assert!(p.requires_elevation("upgrade"));
        assert!(!p.requires_elevation("search"));
    }

    #[test]
    fn test_install_instructions() {
        let p = ApkProvider::new();
        let instructions = p.get_install_instructions();
        assert!(instructions.is_some());
        assert!(instructions.unwrap().contains("Alpine"));
    }

    #[test]
    fn test_parse_apk_name_version_basic() {
        assert_eq!(
            parse_apk_name_version("curl-8.4.0-r0"),
            Some(("curl".into(), "8.4.0-r0".into()))
        );
        assert_eq!(
            parse_apk_name_version("git-2.42.0-r0"),
            Some(("git".into(), "2.42.0-r0".into()))
        );
        assert_eq!(
            parse_apk_name_version("busybox-1.36.1-r2"),
            Some(("busybox".into(), "1.36.1-r2".into()))
        );
    }

    #[test]
    fn test_parse_apk_name_version_hyphenated_name() {
        assert_eq!(
            parse_apk_name_version("curl-dev-8.4.0-r0"),
            Some(("curl-dev".into(), "8.4.0-r0".into()))
        );
        assert_eq!(
            parse_apk_name_version("linux-firmware-20231111-r0"),
            Some(("linux-firmware".into(), "20231111-r0".into()))
        );
    }

    #[test]
    fn test_parse_apk_name_version_edge_cases() {
        assert_eq!(parse_apk_name_version(""), None);
        assert_eq!(parse_apk_name_version("noversion"), None);
    }

    #[test]
    fn test_parse_apk_search_output() {
        let output = "curl-8.4.0-r0 - A URL retrieval utility and library\ngit-2.42.0-r0 - Distributed version control system\ncurl-dev-8.4.0-r0 - A URL retrieval utility (dev)\n";

        let results: Vec<PackageSummary> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(2, " - ").collect();
                let name_version = parts[0].trim();
                let description = parts.get(1).map(|s| s.trim().to_string());
                let (name, version) = parse_apk_name_version(name_version)?;
                Some(PackageSummary {
                    name,
                    description,
                    latest_version: Some(version),
                    provider: "apk".into(),
                })
            })
            .collect();

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "curl");
        assert_eq!(results[0].latest_version, Some("8.4.0-r0".into()));
        assert_eq!(
            results[0].description,
            Some("A URL retrieval utility and library".into())
        );
        assert_eq!(results[2].name, "curl-dev");
        assert_eq!(results[2].latest_version, Some("8.4.0-r0".into()));
    }

    #[test]
    fn test_parse_apk_list_installed_output() {
        let output = "curl-8.4.0-r0 x86_64 {curl} (MIT)\ngit-2.42.0-r0 x86_64 {git} (GPL-2.0-only)\nbusybox-1.36.1-r2 x86_64 {busybox} (GPL-2.0-only)\n";

        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|line| {
                let first_token = line.split_whitespace().next()?;
                let (name, version) = parse_apk_name_version(first_token)?;
                Some(InstalledPackage {
                    name,
                    version,
                    provider: "apk".into(),
                    install_path: PathBuf::from("/usr"),
                    installed_at: String::new(),
                    is_global: true,
                })
            })
            .collect();

        assert_eq!(packages.len(), 3);
        assert_eq!(packages[0].name, "curl");
        assert_eq!(packages[0].version, "8.4.0-r0");
        assert_eq!(packages[1].name, "git");
        assert_eq!(packages[1].version, "2.42.0-r0");
        assert_eq!(packages[2].name, "busybox");
        assert_eq!(packages[2].version, "1.36.1-r2");
    }

    #[test]
    fn test_parse_apk_version_output() {
        let output = "curl-8.3.0-r0 < 8.4.0-r0\ngit-2.41.0-r0 < 2.42.0-r0\n";

        let updates: Vec<UpdateInfo> = output
            .lines()
            .filter(|l| !l.is_empty() && l.contains('<'))
            .filter_map(|line| {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() < 3 {
                    return None;
                }
                let (name, current_version) = parse_apk_name_version(parts[0])?;
                Some(UpdateInfo {
                    name,
                    current_version,
                    latest_version: parts[2].to_string(),
                    provider: "apk".into(),
                })
            })
            .collect();

        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].name, "curl");
        assert_eq!(updates[0].current_version, "8.3.0-r0");
        assert_eq!(updates[0].latest_version, "8.4.0-r0");
        assert_eq!(updates[1].name, "git");
        assert_eq!(updates[1].current_version, "2.41.0-r0");
    }

    #[test]
    fn test_parse_apk_pkg_version() {
        // Using the new prefix-stripping approach
        let line = "curl-8.4.0-r0";
        let prefix = "curl-";
        let version = line.strip_prefix(prefix).unwrap();
        assert_eq!(version, "8.4.0-r0");
    }

    #[test]
    fn test_parse_apk_dependencies_output() {
        let output = "curl-8.4.0-r0 depends on:\nca-certificates-bundle\nlibc.musl-x86_64.so.1\nlibcurl.so.4\n\ncurl-8.4.0-r0 has:\n";

        let mut deps = Vec::new();
        let mut in_depends = false;
        for line in output.lines() {
            if line.contains("depends on:") {
                in_depends = true;
                continue;
            }
            if in_depends {
                let dep = line.trim();
                if dep.is_empty() {
                    break;
                }
                let dep_name = dep.split(|c| c == '>' || c == '<' || c == '=' || c == '~')
                    .next()
                    .unwrap_or(dep)
                    .to_string();
                if !dep_name.is_empty() {
                    deps.push(dep_name);
                }
            }
        }

        assert_eq!(deps.len(), 3);
        assert_eq!(deps[0], "ca-certificates-bundle");
        assert_eq!(deps[1], "libc.musl-x86_64.so.1");
        assert_eq!(deps[2], "libcurl.so.4");
    }

    #[test]
    fn test_default_impl() {
        let p = ApkProvider::default();
        assert_eq!(p.id(), "apk");
    }
}
