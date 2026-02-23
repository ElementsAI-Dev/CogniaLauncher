use super::traits::*;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    env::{dirs_home, EnvModifications, Platform},
    process::{self, ProcessOptions},
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub struct RustupProvider {
    rustup_home: Option<PathBuf>,
    cargo_home: Option<PathBuf>,
}

impl RustupProvider {
    pub fn new() -> Self {
        let rustup_home = std::env::var("RUSTUP_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".rustup")));

        let cargo_home = std::env::var("CARGO_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs_home().map(|h| h.join(".cargo")));

        Self {
            rustup_home,
            cargo_home,
        }
    }

    fn rustup_home(&self) -> CogniaResult<&PathBuf> {
        self.rustup_home
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("RUSTUP_HOME not found".into()))
    }

    #[allow(dead_code)]
    fn cargo_home(&self) -> CogniaResult<&PathBuf> {
        self.cargo_home
            .as_ref()
            .ok_or_else(|| CogniaError::Provider("CARGO_HOME not found".into()))
    }

    async fn run_rustup(&self, args: &[&str]) -> CogniaResult<String> {
        let opts = ProcessOptions::new().with_timeout(Duration::from_secs(120));
        let output = process::execute("rustup", args, Some(opts)).await?;
        if output.success {
            Ok(output.stdout)
        } else {
            Err(CogniaError::Provider(output.stderr))
        }
    }

    /// List installed components for a toolchain
    pub async fn list_components(&self, toolchain: Option<&str>) -> CogniaResult<Vec<RustComponent>> {
        let mut args = vec!["component", "list"];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }

        let output = self.run_rustup(&args).await?;
        let components = output
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|line| {
                let line = line.trim();
                let installed = line.contains("(installed)");
                let default = line.contains("(default)");
                let name = line
                    .split_whitespace()
                    .next()
                    .unwrap_or(line)
                    .to_string();

                RustComponent {
                    name,
                    installed,
                    default,
                }
            })
            .collect();

        Ok(components)
    }

    /// Add a component to the current or specified toolchain
    pub async fn add_component(&self, component: &str, toolchain: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["component", "add", component];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// Remove a component from the current or specified toolchain
    pub async fn remove_component(&self, component: &str, toolchain: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["component", "remove", component];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// List installed and available targets for a toolchain
    pub async fn list_targets(&self, toolchain: Option<&str>) -> CogniaResult<Vec<RustTarget>> {
        let mut args = vec!["target", "list"];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }

        let output = self.run_rustup(&args).await?;
        let targets = output
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|line| {
                let line = line.trim();
                let installed = line.contains("(installed)");
                let default = line.contains("(default)");
                let name = line
                    .split_whitespace()
                    .next()
                    .unwrap_or(line)
                    .to_string();

                RustTarget {
                    name,
                    installed,
                    default,
                }
            })
            .collect();

        Ok(targets)
    }

    /// Add a target for cross-compilation
    pub async fn add_target(&self, target: &str, toolchain: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["target", "add", target];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// Remove a target
    pub async fn remove_target(&self, target: &str, toolchain: Option<&str>) -> CogniaResult<()> {
        let mut args = vec!["target", "remove", target];
        if let Some(tc) = toolchain {
            args.push("--toolchain");
            args.push(tc);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// Get detailed info from `rustup show`
    pub async fn show_info(&self) -> CogniaResult<RustupShowInfo> {
        let output = self.run_rustup(&["show"]).await?;

        let mut default_toolchain = None;
        let mut active_toolchain = None;
        let mut installed_toolchains = Vec::new();
        let mut installed_targets = Vec::new();
        let mut rustc_version = None;

        let mut section = "";
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line.starts_with("Default host:") {
                // skip
            } else if line.starts_with("installed toolchains") || line.starts_with("Installed toolchains") {
                section = "toolchains";
            } else if line.starts_with("installed targets") || line.starts_with("Installed targets") {
                section = "targets";
            } else if line.starts_with("active toolchain") || line.starts_with("Active toolchain") {
                section = "active";
            } else if line.starts_with("---") {
                continue;
            } else {
                match section {
                    "toolchains" => {
                        let is_default = line.contains("(default)") || line.contains("(active)");
                        let tc = line.replace("(default)", "").replace("(active)", "").trim().to_string();
                        if !tc.is_empty() {
                            installed_toolchains.push(tc.clone());
                            if is_default {
                                default_toolchain = Some(tc);
                            }
                        }
                    }
                    "targets" => {
                        if !line.is_empty() {
                            installed_targets.push(line.to_string());
                        }
                    }
                    "active" => {
                        if active_toolchain.is_none() && !line.starts_with("rustc") {
                            active_toolchain = Some(line.split_whitespace().next().unwrap_or(line).to_string());
                        }
                        if line.starts_with("rustc") {
                            // Extract version: "rustc 1.75.0 (82e1608df 2023-12-21)"
                            let version = line
                                .strip_prefix("rustc ")
                                .and_then(|s| s.split_whitespace().next())
                                .map(|s| s.to_string());
                            rustc_version = version;
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(RustupShowInfo {
            default_toolchain,
            active_toolchain,
            installed_toolchains,
            installed_targets,
            rustc_version,
        })
    }

    /// Update rustup itself
    pub async fn self_update(&self) -> CogniaResult<()> {
        self.run_rustup(&["self", "update"]).await?;
        Ok(())
    }

    /// Update all installed toolchains
    pub async fn update_all(&self) -> CogniaResult<String> {
        self.run_rustup(&["update"]).await
    }

    /// Set a directory override for toolchain selection
    pub async fn override_set(&self, toolchain: &str, path: Option<&Path>) -> CogniaResult<()> {
        let mut args = vec!["override", "set", toolchain];
        let path_str;
        if let Some(p) = path {
            path_str = p.to_string_lossy().to_string();
            args.push("--path");
            args.push(&path_str);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// Remove a directory override
    pub async fn override_unset(&self, path: Option<&Path>) -> CogniaResult<()> {
        let mut args = vec!["override", "unset"];
        let path_str;
        if let Some(p) = path {
            path_str = p.to_string_lossy().to_string();
            args.push("--path");
            args.push(&path_str);
        }
        self.run_rustup(&args).await?;
        Ok(())
    }

    /// List all directory overrides
    pub async fn override_list(&self) -> CogniaResult<Vec<RustupOverride>> {
        let output = self.run_rustup(&["override", "list"]).await?;
        let mut overrides = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line.contains("no overrides") {
                continue;
            }
            // Format: "/path/to/project    toolchain-name"
            // Split on whitespace, but path may contain spaces on Windows
            // The toolchain is always the last whitespace-separated token
            if let Some(last_space) = line.rfind(char::is_whitespace) {
                let path = line[..last_space].trim();
                let toolchain = line[last_space..].trim();
                if !path.is_empty() && !toolchain.is_empty() {
                    overrides.push(RustupOverride {
                        path: PathBuf::from(path),
                        toolchain: toolchain.to_string(),
                    });
                }
            }
        }

        Ok(overrides)
    }

    /// Run a command with a specific toolchain
    pub async fn run_with_toolchain(
        &self,
        toolchain: &str,
        command: &str,
        args: &[&str],
    ) -> CogniaResult<String> {
        let mut rustup_args = vec!["run", toolchain, command];
        rustup_args.extend_from_slice(args);
        self.run_rustup(&rustup_args).await
    }

    /// Resolve which binary will be run for a given command
    pub async fn which_binary(&self, binary: &str) -> CogniaResult<PathBuf> {
        let output = self.run_rustup(&["which", binary]).await?;
        Ok(PathBuf::from(output.trim()))
    }

    /// Get the current rustup profile (minimal, default, complete)
    pub async fn get_profile(&self) -> CogniaResult<String> {
        let output = self.run_rustup(&["show"]).await?;
        // Look for "profile" line in rustup show output
        for line in output.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("profile") {
                // Format: "profile: 'default'" or "profile  default"
                let profile = rest
                    .trim_start_matches(':')
                    .trim()
                    .trim_matches('\'')
                    .trim_matches('"')
                    .trim();
                if !profile.is_empty() {
                    return Ok(profile.to_string());
                }
            }
        }
        // Default profile if not found in output
        Ok("default".to_string())
    }

    /// Set the rustup profile (minimal, default, complete)
    pub async fn set_profile(&self, profile: &str) -> CogniaResult<()> {
        self.run_rustup(&["set", "profile", profile]).await?;
        Ok(())
    }
}

impl Default for RustupProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for RustupProvider {
    fn id(&self) -> &str {
        "rustup"
    }

    fn display_name(&self) -> &str {
        "Rust Toolchain Manager"
    }

    fn capabilities(&self) -> HashSet<Capability> {
        HashSet::from([
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
            Capability::Update,
            Capability::Upgrade,
            Capability::VersionSwitch,
            Capability::MultiVersion,
            Capability::ProjectLocal,
        ])
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Linux, Platform::MacOS, Platform::Windows]
    }

    fn priority(&self) -> i32 {
        100
    }

    async fn is_available(&self) -> bool {
        if process::which("rustup").await.is_none() {
            return false;
        }
        // Verify rustup actually works
        match process::execute("rustup", &["--version"], None).await {
            Ok(output) => output.success,
            Err(_) => false,
        }
    }

    async fn search(
        &self,
        query: &str,
        _options: SearchOptions,
    ) -> CogniaResult<Vec<PackageSummary>> {
        // Include release channels and installed toolchains
        let mut results = Vec::new();

        // Standard channels
        let channels = vec!["stable", "beta", "nightly"];
        for channel in &channels {
            if channel.contains(query) || query.is_empty() {
                results.push(PackageSummary {
                    name: format!("rust@{}", channel),
                    description: Some(format!("Rust {} release channel", channel)),
                    latest_version: Some(channel.to_string()),
                    provider: self.id().to_string(),
                });
            }
        }

        // Also search installed toolchains for version-specific results
        if let Ok(output) = self.run_rustup(&["toolchain", "list"]).await {
            for line in output.lines() {
                let tc = line.trim().replace(" (default)", "");
                if !tc.is_empty()
                    && (tc.contains(query) || query.is_empty())
                    && !channels.iter().any(|c| tc == *c)
                {
                    results.push(PackageSummary {
                        name: format!("rust@{}", tc),
                        description: Some("Installed Rust toolchain".into()),
                        latest_version: Some(tc),
                        provider: self.id().to_string(),
                    });
                }
            }
        }

        Ok(results)
    }

    async fn get_package_info(&self, _name: &str) -> CogniaResult<PackageInfo> {
        let versions = self.get_versions("rust").await?;

        Ok(PackageInfo {
            name: "rust".to_string(),
            display_name: Some("Rust".to_string()),
            description: Some(
                "A language empowering everyone to build reliable and efficient software"
                    .to_string(),
            ),
            homepage: Some("https://rust-lang.org".to_string()),
            license: Some("MIT/Apache-2.0".to_string()),
            repository: Some("https://github.com/rust-lang/rust".to_string()),
            versions,
            provider: self.id().to_string(),
        })
    }

    async fn get_versions(&self, _name: &str) -> CogniaResult<Vec<VersionInfo>> {
        let output = self
            .run_rustup(&["toolchain", "list"])
            .await
            .unwrap_or_default();

        let mut versions: Vec<VersionInfo> = output
            .lines()
            .map(|line| line.trim().replace(" (default)", ""))
            .filter(|line| !line.is_empty())
            .map(|version| VersionInfo {
                version,
                release_date: None,
                deprecated: false,
                yanked: false,
            })
            .collect();

        for channel in &["stable", "beta", "nightly"] {
            if !versions.iter().any(|v| v.version.starts_with(channel)) {
                versions.push(VersionInfo {
                    version: channel.to_string(),
                    release_date: None,
                    deprecated: false,
                    yanked: false,
                });
            }
        }

        Ok(versions)
    }

    async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt> {
        let toolchain = request.version.as_deref().unwrap_or("stable");

        self.run_rustup(&["toolchain", "install", toolchain])
            .await?;

        let rustup_home = self.rustup_home()?;
        let install_path = rustup_home.join("toolchains").join(toolchain);

        Ok(InstallReceipt {
            name: "rust".to_string(),
            version: toolchain.to_string(),
            provider: self.id().to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn uninstall(&self, request: UninstallRequest) -> CogniaResult<()> {
        let toolchain = request
            .version
            .ok_or_else(|| CogniaError::Provider("Toolchain required for uninstall".into()))?;

        self.run_rustup(&["toolchain", "uninstall", &toolchain])
            .await?;
        Ok(())
    }

    async fn list_installed(
        &self,
        _filter: InstalledFilter,
    ) -> CogniaResult<Vec<InstalledPackage>> {
        let output = self.run_rustup(&["toolchain", "list"]).await?;
        let rustup_home = self.rustup_home()?;

        let packages: Vec<InstalledPackage> = output
            .lines()
            .map(|line| line.trim().replace(" (default)", ""))
            .filter(|line| !line.is_empty())
            .map(|toolchain| InstalledPackage {
                name: "rust".to_string(),
                version: toolchain.clone(),
                provider: self.id().to_string(),
                install_path: rustup_home.join("toolchains").join(&toolchain),
                installed_at: String::new(),
                is_global: true,
            })
            .collect();

        Ok(packages)
    }

    async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
        let output = self.run_rustup(&["check"]).await?;

        // `rustup check` output format:
        // stable-x86_64-unknown-linux-gnu - Up to date : 1.75.0 (82e1608df 2023-12-21)
        // stable-x86_64-unknown-linux-gnu - Update available : 1.74.0 (79e9716c9 2023-11-13) -> 1.75.0 (82e1608df 2023-12-21)
        let mut updates = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.contains("Update available") || line.contains("update available") {
                // Parse: toolchain - Update available : current -> latest
                // Use " - " (space-dash-space) as separator to avoid splitting
                // inside toolchain names like "stable-x86_64-unknown-linux-gnu"
                let parts: Vec<&str> = line.splitn(2, " - ").collect();
                let toolchain = parts.first().map(|s| s.trim()).unwrap_or("");

                if let Some(versions_part) = line.split(':').last() {
                    let versions: Vec<&str> = versions_part.split("->").collect();
                    if versions.len() == 2 {
                        // Extract version numbers (e.g., "1.74.0 (hash date)" -> "1.74.0")
                        let current = versions[0]
                            .trim()
                            .split_whitespace()
                            .next()
                            .unwrap_or("")
                            .to_string();
                        let latest = versions[1]
                            .trim()
                            .split_whitespace()
                            .next()
                            .unwrap_or("")
                            .to_string();

                        if !current.is_empty() && !latest.is_empty() {
                            updates.push(UpdateInfo {
                                name: if toolchain.is_empty() {
                                    "rust".to_string()
                                } else {
                                    format!("rust@{}", toolchain)
                                },
                                current_version: current,
                                latest_version: latest,
                                provider: self.id().to_string(),
                            });
                        }
                    }
                }
            }
        }

        Ok(updates)
    }
}

#[async_trait]
impl EnvironmentProvider for RustupProvider {
    async fn list_installed_versions(&self) -> CogniaResult<Vec<InstalledVersion>> {
        let output = self.run_rustup(&["toolchain", "list"]).await?;
        let rustup_home = self.rustup_home()?;

        let versions: Vec<InstalledVersion> = output
            .lines()
            .map(|line| {
                let is_default = line.contains("(default)");
                let toolchain = line.trim().replace(" (default)", "");
                (toolchain, is_default)
            })
            .filter(|(line, _)| !line.is_empty())
            .map(|(toolchain, is_default)| InstalledVersion {
                version: toolchain.clone(),
                install_path: rustup_home.join("toolchains").join(&toolchain),
                size: None,
                installed_at: None,
                is_current: is_default,
            })
            .collect();

        Ok(versions)
    }

    async fn get_current_version(&self) -> CogniaResult<Option<String>> {
        let output = self.run_rustup(&["default"]).await?;
        let version = output.split_whitespace().next();
        Ok(version.map(|s| s.to_string()))
    }

    async fn set_global_version(&self, version: &str) -> CogniaResult<()> {
        self.run_rustup(&["default", version]).await?;
        Ok(())
    }

    async fn set_local_version(&self, project_path: &Path, version: &str) -> CogniaResult<()> {
        let toolchain_file = project_path.join(self.version_file_name());
        crate::platform::fs::write_file_string(&toolchain_file, version).await?;
        Ok(())
    }

    async fn detect_version(&self, start_path: &Path) -> CogniaResult<Option<VersionDetection>> {
        let mut current = start_path.to_path_buf();

        loop {
            // 1. Check rust-toolchain.toml (TOML format, highest priority)
            let toolchain_toml = current.join("rust-toolchain.toml");
            if toolchain_toml.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&toolchain_toml).await {
                    // Parse [toolchain] section, looking for channel = "..."
                    // Handle both inline and multi-line TOML
                    let mut in_toolchain_section = false;
                    for line in content.lines() {
                        let line = line.trim();
                        // Skip comments
                        if line.starts_with('#') {
                            continue;
                        }
                        // Detect section headers
                        if line.starts_with('[') {
                            in_toolchain_section = line.contains("[toolchain]");
                            continue;
                        }
                        // Look for channel in [toolchain] section or at top level
                        if (in_toolchain_section || !content.contains('[')) && line.starts_with("channel") {
                            if let Some(value) = line.split('=').nth(1) {
                                let version = value
                                    .trim()
                                    .trim_matches('"')
                                    .trim_matches('\'')
                                    .split('#')  // Remove inline comments
                                    .next()
                                    .unwrap_or("")
                                    .trim();
                                if !version.is_empty() {
                                    return Ok(Some(VersionDetection {
                                        version: version.to_string(),
                                        source: VersionSource::LocalFile,
                                        source_path: Some(toolchain_toml),
                                    }));
                                }
                            }
                        }
                    }
                }
            }

            // 2. Check rust-toolchain (plain text format)
            let toolchain_plain = current.join("rust-toolchain");
            if toolchain_plain.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&toolchain_plain).await {
                    // Plain format: just the channel name on a line
                    let version = content
                        .lines()
                        .find(|line| !line.starts_with('#') && !line.trim().is_empty())
                        .unwrap_or("")
                        .trim();

                    if !version.is_empty() {
                        return Ok(Some(VersionDetection {
                            version: version.to_string(),
                            source: VersionSource::LocalFile,
                            source_path: Some(toolchain_plain),
                        }));
                    }
                }
            }

            // 3. Check .tool-versions file (asdf-style)
            let tool_versions = current.join(".tool-versions");
            if tool_versions.exists() {
                if let Ok(content) = crate::platform::fs::read_file_string(&tool_versions).await {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("rust ") {
                            let version = line.strip_prefix("rust ").unwrap_or("").trim();
                            if !version.is_empty() {
                                return Ok(Some(VersionDetection {
                                    version: version.to_string(),
                                    source: VersionSource::LocalFile,
                                    source_path: Some(tool_versions),
                                }));
                            }
                        }
                    }
                }
            }

            if !current.pop() {
                break;
            }
        }

        // 4. Fall back to current rustup default
        if let Some(version) = self.get_current_version().await? {
            return Ok(Some(VersionDetection {
                version,
                source: VersionSource::SystemDefault,
                source_path: None,
            }));
        }

        Ok(None)
    }

    fn get_env_modifications(&self, version: &str) -> CogniaResult<EnvModifications> {
        let rustup_home = self.rustup_home()?;
        let toolchain_path = rustup_home.join("toolchains").join(version).join("bin");

        let mut mods = EnvModifications::new()
            .prepend_path(toolchain_path)
            .set_var("RUSTUP_TOOLCHAIN", version.to_string());

        if let Some(cargo_home) = &self.cargo_home {
            mods = mods
                .prepend_path(cargo_home.join("bin"))
                .set_var("CARGO_HOME", cargo_home.to_string_lossy().to_string());
        }

        mods = mods.set_var("RUSTUP_HOME", rustup_home.to_string_lossy().to_string());

        Ok(mods)
    }

    fn version_file_name(&self) -> &str {
        "rust-toolchain.toml"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl SystemPackageProvider for RustupProvider {
    async fn check_system_requirements(&self) -> CogniaResult<bool> {
        Ok(self.is_available().await)
    }

    fn requires_elevation(&self, _operation: &str) -> bool {
        false
    }

    async fn get_version(&self) -> CogniaResult<String> {
        let output = self.run_rustup(&["--version"]).await?;
        // Output: "rustup 1.27.0 (bbb9276d2 2024-03-08)"
        Ok(output
            .split_whitespace()
            .nth(1)
            .unwrap_or("unknown")
            .to_string())
    }

    async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
        process::which("rustup")
            .await
            .map(PathBuf::from)
            .ok_or_else(|| CogniaError::Provider("rustup not found in PATH".into()))
    }

    fn get_install_instructions(&self) -> Option<String> {
        Some("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh".to_string())
    }

    async fn upgrade_package(&self, name: &str) -> CogniaResult<()> {
        self.run_rustup(&["update", name]).await?;
        Ok(())
    }

    async fn upgrade_all(&self) -> CogniaResult<Vec<String>> {
        let output = self.run_rustup(&["update"]).await?;
        let mut upgraded = Vec::new();
        for line in output.lines() {
            let line = line.trim();
            if line.contains("updated") || line.contains("Updated") {
                if let Some(toolchain) = line.split_whitespace().next() {
                    upgraded.push(toolchain.to_string());
                }
            }
        }
        if upgraded.is_empty() {
            upgraded.push("All toolchains updated".to_string());
        }
        Ok(upgraded)
    }

    async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
        let versions = self.list_installed_versions().await?;
        Ok(versions.iter().any(|v| v.version.contains(name)))
    }
}

/// Component info from `rustup component list`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RustComponent {
    pub name: String,
    pub installed: bool,
    pub default: bool,
}

/// Target info from `rustup target list`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RustTarget {
    pub name: String,
    pub installed: bool,
    pub default: bool,
}

/// Parsed output from `rustup show`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RustupShowInfo {
    pub default_toolchain: Option<String>,
    pub active_toolchain: Option<String>,
    pub installed_toolchains: Vec<String>,
    pub installed_targets: Vec<String>,
    pub rustc_version: Option<String>,
}

/// Directory override entry from `rustup override list`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RustupOverride {
    pub path: PathBuf,
    pub toolchain: String,
}

// ── Pure parsing helpers (extracted for testability) ──

/// Parse `rustup check` output into (toolchain, current_version, latest_version) tuples
pub(crate) fn parse_check_updates_output(output: &str) -> Vec<(String, String, String)> {
    let mut updates = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.contains("Update available") || line.contains("update available") {
            let parts: Vec<&str> = line.splitn(2, " - ").collect();
            let toolchain = parts.first().map(|s| s.trim()).unwrap_or("").to_string();

            if let Some(versions_part) = line.split(':').last() {
                let versions: Vec<&str> = versions_part.split("->").collect();
                if versions.len() == 2 {
                    let current = versions[0]
                        .trim()
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_string();
                    let latest = versions[1]
                        .trim()
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_string();
                    if !current.is_empty() && !latest.is_empty() {
                        updates.push((toolchain, current, latest));
                    }
                }
            }
        }
    }
    updates
}

/// Parse `rustup override list` output into (path, toolchain) tuples
pub(crate) fn parse_override_list_output(output: &str) -> Vec<(String, String)> {
    let mut overrides = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.contains("no overrides") {
            continue;
        }
        if let Some(last_space) = line.rfind(char::is_whitespace) {
            let path = line[..last_space].trim().to_string();
            let toolchain = line[last_space..].trim().to_string();
            if !path.is_empty() && !toolchain.is_empty() {
                overrides.push((path, toolchain));
            }
        }
    }
    overrides
}

/// Parse `rustup component list` output into (name, installed, default) tuples
pub(crate) fn parse_component_list_output(output: &str) -> Vec<(String, bool, bool)> {
    output
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|line| {
            let line = line.trim();
            let installed = line.contains("(installed)");
            let default = line.contains("(default)");
            let name = line
                .split_whitespace()
                .next()
                .unwrap_or(line)
                .to_string();
            (name, installed, default)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_provider_creation() {
        let provider = RustupProvider::new();
        assert_eq!(provider.id(), "rustup");
        assert_eq!(provider.display_name(), "Rust Toolchain Manager");
    }

    #[test]
    fn test_capabilities() {
        let provider = RustupProvider::new();
        let caps = provider.capabilities();
        assert!(caps.contains(&Capability::Install));
        assert!(caps.contains(&Capability::Uninstall));
        assert!(caps.contains(&Capability::Search));
        assert!(caps.contains(&Capability::List));
        assert!(caps.contains(&Capability::Update));
        assert!(caps.contains(&Capability::Upgrade));
        assert!(caps.contains(&Capability::VersionSwitch));
        assert!(caps.contains(&Capability::MultiVersion));
        assert!(caps.contains(&Capability::ProjectLocal));
    }

    #[test]
    fn test_parse_check_updates_with_update() {
        let output = "\
stable-x86_64-unknown-linux-gnu - Update available : 1.74.0 (79e9716c9 2023-11-13) -> 1.75.0 (82e1608df 2023-12-21)
nightly-x86_64-unknown-linux-gnu - Up to date : 1.76.0-nightly (abc1234 2024-01-01)";

        let updates = parse_check_updates_output(output);
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].0, "stable-x86_64-unknown-linux-gnu");
        assert_eq!(updates[0].1, "1.74.0");
        assert_eq!(updates[0].2, "1.75.0");
    }

    #[test]
    fn test_parse_check_updates_up_to_date() {
        let output = "\
stable-x86_64-unknown-linux-gnu - Up to date : 1.75.0 (82e1608df 2023-12-21)
nightly-x86_64-unknown-linux-gnu - Up to date : 1.76.0-nightly (abc1234 2024-01-01)";

        let updates = parse_check_updates_output(output);
        assert!(updates.is_empty());
    }

    #[test]
    fn test_parse_check_updates_preserves_full_toolchain_name() {
        let output = "stable-x86_64-pc-windows-msvc - Update available : 1.80.0 (abc 2024-01-01) -> 1.82.0 (def 2024-08-01)";
        let updates = parse_check_updates_output(output);
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].0, "stable-x86_64-pc-windows-msvc");
    }

    #[test]
    fn test_parse_override_list() {
        let output = "\
/home/user/project1                            nightly-2024-01-01
/home/user/project2                            stable-x86_64-unknown-linux-gnu";

        let overrides = parse_override_list_output(output);
        assert_eq!(overrides.len(), 2);
        assert_eq!(overrides[0].0, "/home/user/project1");
        assert_eq!(overrides[0].1, "nightly-2024-01-01");
        assert_eq!(overrides[1].0, "/home/user/project2");
        assert_eq!(overrides[1].1, "stable-x86_64-unknown-linux-gnu");
    }

    #[test]
    fn test_parse_override_list_no_overrides() {
        let output = "no overrides\n";
        let overrides = parse_override_list_output(output);
        assert!(overrides.is_empty());
    }

    #[test]
    fn test_parse_component_list() {
        let output = "\
cargo-x86_64-unknown-linux-gnu (installed)
clippy-x86_64-unknown-linux-gnu (installed)
llvm-tools-preview-x86_64-unknown-linux-gnu
miri-x86_64-unknown-linux-gnu
rust-analyzer-x86_64-unknown-linux-gnu (installed)
rust-src (installed)
rustc-x86_64-unknown-linux-gnu (default)
rustfmt-x86_64-unknown-linux-gnu (installed)";

        let components = parse_component_list_output(output);
        assert_eq!(components.len(), 8);

        // cargo installed
        assert_eq!(components[0].0, "cargo-x86_64-unknown-linux-gnu");
        assert!(components[0].1); // installed
        assert!(!components[0].2); // not default

        // llvm-tools not installed
        assert_eq!(components[2].0, "llvm-tools-preview-x86_64-unknown-linux-gnu");
        assert!(!components[2].1);

        // rustc default
        assert_eq!(components[6].0, "rustc-x86_64-unknown-linux-gnu");
        assert!(components[6].2); // default
    }

    #[test]
    fn test_version_file_name() {
        let provider = RustupProvider::new();
        assert_eq!(provider.version_file_name(), "rust-toolchain.toml");
    }
}
