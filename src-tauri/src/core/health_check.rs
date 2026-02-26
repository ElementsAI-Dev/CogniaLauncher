use crate::error::{CogniaError, CogniaResult};
use crate::provider::{EnvironmentProvider, Provider, ProviderRegistry};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Health status of an environment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Unknown,
}

/// Severity level of a health issue
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Category of health issue
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IssueCategory {
    PathConflict,
    VersionMismatch,
    MissingDependency,
    ConfigError,
    PermissionError,
    NetworkError,
    ProviderNotFound,
    ShellIntegration,
    Other,
}

/// A single health issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthIssue {
    pub severity: Severity,
    pub category: IssueCategory,
    pub message: String,
    pub details: Option<String>,
    pub fix_command: Option<String>,
    pub fix_description: Option<String>,
}

impl HealthIssue {
    pub fn new(severity: Severity, category: IssueCategory, message: impl Into<String>) -> Self {
        Self {
            severity,
            category,
            message: message.into(),
            details: None,
            fix_command: None,
            fix_description: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }

    pub fn with_fix(mut self, command: impl Into<String>, description: impl Into<String>) -> Self {
        self.fix_command = Some(command.into());
        self.fix_description = Some(description.into());
        self
    }
}

/// Result of a health check for a single environment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentHealthResult {
    pub env_type: String,
    pub provider_id: Option<String>,
    pub status: HealthStatus,
    pub issues: Vec<HealthIssue>,
    pub suggestions: Vec<String>,
    pub checked_at: String,
}

impl EnvironmentHealthResult {
    pub fn new(env_type: impl Into<String>) -> Self {
        Self {
            env_type: env_type.into(),
            provider_id: None,
            status: HealthStatus::Unknown,
            issues: Vec::new(),
            suggestions: Vec::new(),
            checked_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn with_provider(mut self, provider_id: impl Into<String>) -> Self {
        self.provider_id = Some(provider_id.into());
        self
    }

    pub fn add_issue(&mut self, issue: HealthIssue) {
        // Update status based on issue severity
        match issue.severity {
            Severity::Critical | Severity::Error => {
                self.status = HealthStatus::Error;
            }
            Severity::Warning => {
                if self.status != HealthStatus::Error {
                    self.status = HealthStatus::Warning;
                }
            }
            Severity::Info => {}
        }
        self.issues.push(issue);
    }

    pub fn add_suggestion(&mut self, suggestion: impl Into<String>) {
        self.suggestions.push(suggestion.into());
    }

    pub fn finalize(&mut self) {
        if self.issues.is_empty() {
            self.status = HealthStatus::Healthy;
        }
    }
}

/// Result of a health check for a package manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManagerHealthResult {
    pub provider_id: String,
    pub display_name: String,
    pub status: HealthStatus,
    pub version: Option<String>,
    pub executable_path: Option<PathBuf>,
    pub issues: Vec<HealthIssue>,
    pub install_instructions: Option<String>,
    pub checked_at: String,
}

impl PackageManagerHealthResult {
    pub fn new(provider_id: impl Into<String>, display_name: impl Into<String>) -> Self {
        Self {
            provider_id: provider_id.into(),
            display_name: display_name.into(),
            status: HealthStatus::Unknown,
            version: None,
            executable_path: None,
            issues: Vec::new(),
            install_instructions: None,
            checked_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn add_issue(&mut self, issue: HealthIssue) {
        match issue.severity {
            Severity::Critical | Severity::Error => {
                self.status = HealthStatus::Error;
            }
            Severity::Warning => {
                if self.status != HealthStatus::Error {
                    self.status = HealthStatus::Warning;
                }
            }
            Severity::Info => {}
        }
        self.issues.push(issue);
    }

    pub fn finalize(&mut self) {
        if self.issues.is_empty() {
            self.status = HealthStatus::Healthy;
        }
    }
}

/// Result of a full system health check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealthResult {
    pub overall_status: HealthStatus,
    pub environments: Vec<EnvironmentHealthResult>,
    pub package_managers: Vec<PackageManagerHealthResult>,
    pub system_issues: Vec<HealthIssue>,
    pub checked_at: String,
}

impl SystemHealthResult {
    pub fn new() -> Self {
        Self {
            overall_status: HealthStatus::Healthy,
            environments: Vec::new(),
            package_managers: Vec::new(),
            system_issues: Vec::new(),
            checked_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn add_environment(&mut self, result: EnvironmentHealthResult) {
        // Update overall status based on environment status
        match result.status {
            HealthStatus::Error => {
                self.overall_status = HealthStatus::Error;
            }
            HealthStatus::Warning => {
                if self.overall_status != HealthStatus::Error {
                    self.overall_status = HealthStatus::Warning;
                }
            }
            _ => {}
        }
        self.environments.push(result);
    }

    pub fn add_package_manager(&mut self, result: PackageManagerHealthResult) {
        // Update overall status based on package manager status
        match result.status {
            HealthStatus::Error => {
                self.overall_status = HealthStatus::Error;
            }
            HealthStatus::Warning => {
                if self.overall_status != HealthStatus::Error {
                    self.overall_status = HealthStatus::Warning;
                }
            }
            _ => {}
        }
        self.package_managers.push(result);
    }

    pub fn add_system_issue(&mut self, issue: HealthIssue) {
        match issue.severity {
            Severity::Critical | Severity::Error => {
                self.overall_status = HealthStatus::Error;
            }
            Severity::Warning => {
                if self.overall_status != HealthStatus::Error {
                    self.overall_status = HealthStatus::Warning;
                }
            }
            _ => {}
        }
        self.system_issues.push(issue);
    }
}

impl Default for SystemHealthResult {
    fn default() -> Self {
        Self::new()
    }
}

/// Health check manager
pub struct HealthCheckManager {
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl HealthCheckManager {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>) -> Self {
        Self { registry }
    }

    /// Run health check for all environments
    pub async fn check_all(&self) -> CogniaResult<SystemHealthResult> {
        let mut result = SystemHealthResult::new();

        // Check system-level issues
        self.check_system_health(&mut result).await;

        // Check each environment provider
        let registry = self.registry.read().await;
        let provider_ids: Vec<String> = registry
            .list_environment_providers()
            .iter()
            .map(|s| s.to_string())
            .collect();

        for provider_id in provider_ids {
            if let Some(provider) = registry.get_environment_provider(&provider_id) {
                let env_result = self.check_environment_health(&*provider).await;
                result.add_environment(env_result);
            }
        }

        // Check package managers
        drop(registry);
        for pm_result in self.check_package_managers().await? {
            result.add_package_manager(pm_result);
        }

        Ok(result)
    }

    /// Run health check for a specific environment type
    pub async fn check_environment(&self, env_type: &str) -> CogniaResult<EnvironmentHealthResult> {
        let registry = self.registry.read().await;

        // Find provider for this environment type by checking provider IDs
        let provider_id = self.env_type_to_provider(env_type);

        let provider = registry
            .get_environment_provider(&provider_id)
            .ok_or_else(|| CogniaError::Provider(format!("No provider found for {}", env_type)))?;

        Ok(self.check_environment_health(&*provider).await)
    }

    /// Run health check for all package managers
    pub async fn check_package_managers(&self) -> CogniaResult<Vec<PackageManagerHealthResult>> {
        let registry = self.registry.read().await;
        let mut provider_ids = registry.list_system_package_provider_ids();
        // Bulk "package managers" health is for non-environment providers (environment providers
        // have their own health section).
        provider_ids.retain(|id| registry.get_environment_provider(id).is_none());
        provider_ids.extend(["github".to_string(), "gitlab".to_string()]);
        provider_ids.sort();
        provider_ids.dedup();
        let mut results = Vec::new();

        let providers: Vec<Arc<dyn Provider>> = provider_ids
            .into_iter()
            .filter_map(|id| registry.get(&id))
            .collect();
        drop(registry);

        for provider in providers {
            let pm_result = self.check_package_manager_health(&*provider).await;
            results.push(pm_result);
        }

        Ok(results)
    }

    /// Run health check for a single package manager/provider by id
    pub async fn check_package_manager(
        &self,
        provider_id: &str,
    ) -> CogniaResult<PackageManagerHealthResult> {
        let provider = {
            let registry = self.registry.read().await;
            registry
                .get(provider_id)
                .ok_or_else(|| CogniaError::ProviderNotFound(provider_id.to_string()))?
        };

        Ok(self.check_package_manager_health(&*provider).await)
    }

    /// Check a specific package manager's health
    async fn check_package_manager_health(
        &self,
        provider: &dyn Provider,
    ) -> PackageManagerHealthResult {
        let mut result = PackageManagerHealthResult::new(provider.id(), provider.display_name());

        if provider.id() == "github" || provider.id() == "gitlab" {
            return self.check_api_provider_health(provider).await;
        }

        // Check 1: Provider availability
        let is_available = provider.is_available().await;

        if !is_available {
            result.add_issue(
                HealthIssue::new(
                    Severity::Info,
                    IssueCategory::ProviderNotFound,
                    format!("{} is not installed", provider.display_name()),
                )
                .with_details(format!(
                    "The {} package manager is not available on this system",
                    provider.display_name()
                ))
                .with_fix(
                    self.get_install_command(provider.id()),
                    format!(
                        "Install {} to enable package management",
                        provider.display_name()
                    ),
                ),
            );
            let system_provider = {
                let registry = self.registry.read().await;
                registry.get_system_provider(provider.id())
            };

            result.install_instructions = system_provider
                .and_then(|p| p.get_install_instructions())
                .or_else(|| Some(self.get_install_instructions(provider.id())));
            result.finalize();
            return result;
        }

        // Check 2: Get version (using SystemPackageProvider trait if available)
        let system_provider = {
            let registry = self.registry.read().await;
            registry.get_system_provider(provider.id())
        };
        if let Some(system_provider) = system_provider {
            if let Ok(version) = system_provider.get_version().await {
                result.version = Some(version);
            }
            if let Ok(path) = system_provider.get_executable_path().await {
                result.executable_path = Some(path);
            }
            result.install_instructions = system_provider.get_install_instructions();
        } else {
            result.install_instructions = Some(self.get_install_instructions(provider.id()));
        }

        // Check 3: Verify the provider can list packages (functional check)
        match provider
            .list_installed(crate::provider::InstalledFilter {
                global_only: true,
                ..Default::default()
            })
            .await
        {
            Ok(_) => {
                // Provider is functional
            }
            Err(e) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::ConfigError,
                        format!("{} may have configuration issues", provider.display_name()),
                    )
                    .with_details(format!("Failed to list packages: {}", e)),
                );
            }
        }

        result.finalize();
        result
    }

    async fn check_api_provider_health(
        &self,
        provider: &dyn Provider,
    ) -> PackageManagerHealthResult {
        let provider_id = provider.id();
        let mut result = PackageManagerHealthResult::new(provider_id, provider.display_name());

        let config = {
            let registry = self.registry.read().await;
            registry.get_api_provider_config(provider_id)
        };

        if let Some(config) = &config {
            if !config.has_token {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Info,
                        IssueCategory::ConfigError,
                        "No API token configured (rate limits may apply)",
                    )
                    .with_details(
                        "Configure a personal access token in Settings to increase API limits.",
                    ),
                );
            }
        }

        let url = match provider_id {
            "github" => "https://api.github.com/rate_limit".to_string(),
            "gitlab" => {
                let base = config
                    .and_then(|c| c.base_url)
                    .unwrap_or_else(|| "https://gitlab.com".into());
                format!("{}/api/v4/version", base.trim_end_matches('/'))
            }
            _ => {
                result.finalize();
                return result;
            }
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("CogniaLauncher/0.1.0")
            .build()
            .unwrap_or_default();

        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                // OK
            }
            Ok(resp) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::NetworkError,
                        format!("API returned {}", resp.status()),
                    )
                    .with_details("The remote API endpoint returned a non-success response."),
                );
            }
            Err(e) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Error,
                        IssueCategory::NetworkError,
                        "Failed to reach API endpoint",
                    )
                    .with_details(format!("Request error: {}", e)),
                );
            }
        }

        result.finalize();
        result
    }

    /// Get install instructions for a package manager
    fn get_install_instructions(&self, provider_id: &str) -> String {
        match provider_id {
            "winget" => "winget is included with Windows 10/11. Update via Microsoft Store.".into(),
            "scoop" => "irm get.scoop.sh | iex".into(),
            "chocolatey" => "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))".into(),
            "brew" => "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"".into(),
            "macports" => "Download from https://www.macports.org/install.php".into(),
            "apt" => "apt is included with Debian/Ubuntu based systems".into(),
            "dnf" => "dnf is included with Fedora/RHEL based systems".into(),
            "pacman" => "pacman is included with Arch Linux".into(),
            "zypper" => "zypper is included with openSUSE".into(),
            "apk" => "apk is included with Alpine Linux".into(),
            "snap" => "sudo apt install snapd".into(),
            "flatpak" => "sudo apt install flatpak".into(),
            _ => format!("Visit the official {} website for installation instructions", provider_id),
        }
    }

    /// Map environment type to provider ID
    fn env_type_to_provider(&self, env_type: &str) -> String {
        match env_type.to_lowercase().as_str() {
            "node" => "fnm".to_string(), // Default to fnm, could be nvm
            "deno" => "deno".to_string(),
            "python" => "pyenv".to_string(),
            "go" => "goenv".to_string(),
            "rust" => "rustup".to_string(),
            "ruby" => "rbenv".to_string(),
            "java" => "sdkman".to_string(),
            "kotlin" => "sdkman-kotlin".to_string(),
            "scala" => "sdkman-scala".to_string(),
            "php" => "phpbrew".to_string(),
            "dotnet" => "dotnet".to_string(),
            "zig" => "zig".to_string(),
            "dart" => "fvm".to_string(),
            "lua" => "system-lua".to_string(),
            _ => env_type.to_string(),
        }
    }

    /// Check system-level health
    async fn check_system_health(&self, result: &mut SystemHealthResult) {
        // Check PATH environment variable
        if let Some(path_issues) = self.check_path_variable().await {
            for issue in path_issues {
                result.add_system_issue(issue);
            }
        }

        // Check shell configuration
        if let Some(shell_issues) = self.check_shell_config().await {
            for issue in shell_issues {
                result.add_system_issue(issue);
            }
        }
    }

    /// Check a specific environment provider's health
    async fn check_environment_health(
        &self,
        provider: &dyn EnvironmentProvider,
    ) -> EnvironmentHealthResult {
        let env_type = self.provider_to_env_type(provider.id());
        let mut result = EnvironmentHealthResult::new(&env_type).with_provider(provider.id());

        // Check 1: Provider availability
        if !provider.is_available().await {
            result.add_issue(
                HealthIssue::new(
                    Severity::Error,
                    IssueCategory::ProviderNotFound,
                    format!(
                        "{} is not available or not installed",
                        provider.display_name()
                    ),
                )
                .with_details(format!(
                    "The {} command was not found in your PATH",
                    provider.id()
                ))
                .with_fix(
                    self.get_install_command(provider.id()),
                    format!(
                        "Install {} to enable {} version management",
                        provider.id(),
                        env_type
                    ),
                ),
            );
            result.finalize();
            return result;
        }

        // Check 2: Current version
        match provider.get_current_version().await {
            Ok(Some(version)) => {
                result.add_suggestion(format!("Current {} version: {}", env_type, version));
            }
            Ok(None) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::ConfigError,
                        format!("No {} version is currently active", env_type),
                    )
                    .with_details("You may need to install and set a default version"),
                );
            }
            Err(e) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::Other,
                        format!("Could not determine current {} version", env_type),
                    )
                    .with_details(e.to_string()),
                );
            }
        }

        // Check 3: Installed versions
        match provider.list_installed_versions().await {
            Ok(versions) => {
                if versions.is_empty() {
                    result.add_issue(
                        HealthIssue::new(
                            Severity::Info,
                            IssueCategory::ConfigError,
                            format!("No {} versions installed", env_type),
                        )
                        .with_details("Install at least one version to use this environment"),
                    );
                } else {
                    result.add_suggestion(format!(
                        "{} versions installed: {}",
                        versions.len(),
                        versions
                            .iter()
                            .take(3)
                            .map(|v| v.version.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    ));
                }
            }
            Err(e) => {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::Other,
                        format!("Could not list installed {} versions", env_type),
                    )
                    .with_details(e.to_string()),
                );
            }
        }

        // Check 4: PATH configuration for this provider
        self.check_provider_path(provider, &mut result).await;

        result.finalize();
        result
    }

    /// Check PATH variable for common issues
    async fn check_path_variable(&self) -> Option<Vec<HealthIssue>> {
        let mut issues = Vec::new();

        let path = std::env::var("PATH").unwrap_or_default();
        let paths: Vec<&str> = if cfg!(windows) {
            path.split(';').collect()
        } else {
            path.split(':').collect()
        };

        // Check for duplicate paths
        let mut seen = std::collections::HashSet::new();
        let mut duplicates = Vec::new();
        for p in &paths {
            if !seen.insert(*p) && !p.is_empty() {
                duplicates.push(*p);
            }
        }

        if !duplicates.is_empty() {
            issues.push(
                HealthIssue::new(
                    Severity::Warning,
                    IssueCategory::PathConflict,
                    "Duplicate entries found in PATH",
                )
                .with_details(format!("Duplicates: {}", duplicates.join(", "))),
            );
        }

        // Check for non-existent paths
        let mut missing_paths = Vec::new();
        for p in &paths {
            if !p.is_empty() {
                let path = PathBuf::from(p);
                if !path.exists() {
                    missing_paths.push(*p);
                }
            }
        }

        if !missing_paths.is_empty() && missing_paths.len() <= 5 {
            issues.push(
                HealthIssue::new(
                    Severity::Info,
                    IssueCategory::PathConflict,
                    "Some PATH entries point to non-existent directories",
                )
                .with_details(format!("Missing: {}", missing_paths.join(", "))),
            );
        }

        if issues.is_empty() {
            None
        } else {
            Some(issues)
        }
    }

    /// Check shell configuration
    async fn check_shell_config(&self) -> Option<Vec<HealthIssue>> {
        let mut issues = Vec::new();

        // Detect current shell
        let shell = if cfg!(windows) {
            std::env::var("COMSPEC").ok()
        } else {
            std::env::var("SHELL").ok()
        };

        if shell.is_none() {
            issues.push(HealthIssue::new(
                Severity::Warning,
                IssueCategory::ShellIntegration,
                "Could not detect current shell",
            ));
        }

        if issues.is_empty() {
            None
        } else {
            Some(issues)
        }
    }

    /// Check PATH configuration for a specific provider
    async fn check_provider_path(
        &self,
        provider: &dyn EnvironmentProvider,
        result: &mut EnvironmentHealthResult,
    ) {
        // This is a simplified check - could be expanded based on provider type
        let provider_id = provider.id();
        let path = std::env::var("PATH").unwrap_or_default();

        // Check if provider's typical paths are in PATH
        let expected_patterns = self.get_expected_path_patterns(provider_id);

        for pattern in expected_patterns {
            if !path.to_lowercase().contains(&pattern.to_lowercase()) {
                result.add_issue(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::ShellIntegration,
                        format!(
                            "{} may not be properly configured in your shell",
                            provider.display_name()
                        ),
                    )
                    .with_details(format!("Expected to find '{}' in PATH", pattern))
                    .with_fix(
                        self.get_shell_setup_command(provider_id),
                        "Add the provider to your shell configuration",
                    ),
                );
                break;
            }
        }
    }

    /// Map provider ID to environment type
    fn provider_to_env_type(&self, provider_id: &str) -> String {
        match provider_id {
            "fnm" | "nvm" | "volta" => "node".to_string(),
            "deno" => "deno".to_string(),
            "pyenv" | "uv" | "conda" => "python".to_string(),
            "goenv" => "go".to_string(),
            "rustup" => "rust".to_string(),
            "rbenv" => "ruby".to_string(),
            "sdkman" => "java".to_string(),
            "sdkman-kotlin" => "kotlin".to_string(),
            "sdkman-scala" => "scala".to_string(),
            "phpbrew" => "php".to_string(),
            "dotnet" => "dotnet".to_string(),
            "zig" => "zig".to_string(),
            "fvm" => "dart".to_string(),
            _ => provider_id.to_string(),
        }
    }

    /// Get install command for a provider
    fn get_install_command(&self, provider_id: &str) -> String {
        match provider_id {
            "fnm" => {
                if cfg!(windows) {
                    "winget install Schniz.fnm".to_string()
                } else {
                    "curl -fsSL https://fnm.vercel.app/install | bash".to_string()
                }
            }
            "nvm" => {
                if cfg!(windows) {
                    "winget install CoreyButler.NVMforWindows".to_string()
                } else {
                    "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash".to_string()
                }
            }
            "volta" => {
                if cfg!(windows) {
                    "winget install Volta.Volta".to_string()
                } else {
                    "curl https://get.volta.sh | bash".to_string()
                }
            }
            "deno" => {
                if cfg!(windows) {
                    "irm https://deno.land/install.ps1 | iex".to_string()
                } else {
                    "curl -fsSL https://deno.land/install.sh | sh".to_string()
                }
            }
            "pyenv" => {
                if cfg!(windows) {
                    "pip install pyenv-win --target $HOME\\.pyenv".to_string()
                } else {
                    "curl https://pyenv.run | bash".to_string()
                }
            }
            "uv" => {
                if cfg!(windows) {
                    "powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"".to_string()
                } else {
                    "curl -LsSf https://astral.sh/uv/install.sh | sh".to_string()
                }
            }
            "conda" => "Download Miniconda: https://docs.conda.io/en/latest/miniconda.html".to_string(),
            "goenv" => "git clone https://github.com/syndbg/goenv.git ~/.goenv".to_string(),
            "rustup" => {
                if cfg!(windows) {
                    "winget install Rustlang.Rustup".to_string()
                } else {
                    "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh".to_string()
                }
            }
            "rbenv" => "git clone https://github.com/rbenv/rbenv.git ~/.rbenv".to_string(),
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" => "curl -s \"https://get.sdkman.io\" | bash".to_string(),
            "phpbrew" => "curl -L -O https://github.com/phpbrew/phpbrew/releases/latest/download/phpbrew.phar && chmod +x phpbrew.phar && sudo mv phpbrew.phar /usr/local/bin/phpbrew".to_string(),
            "dotnet" => {
                if cfg!(windows) {
                    "winget install Microsoft.DotNet.SDK.8".to_string()
                } else {
                    "curl -sSL https://dot.net/v1/dotnet-install.sh | bash".to_string()
                }
            }
            "zig" => "Download from https://ziglang.org/download/".to_string(),
            "fvm" => "dart pub global activate fvm".to_string(),
            "git" => {
                if cfg!(windows) {
                    "winget install Git.Git".to_string()
                } else if cfg!(target_os = "macos") {
                    "brew install git".to_string()
                } else {
                    "sudo apt-get install git".to_string()
                }
            }
            "system-lua" => {
                if cfg!(windows) {
                    "Download from https://www.lua.org/download.html or install via scoop: scoop install lua".to_string()
                } else if cfg!(target_os = "macos") {
                    "brew install lua".to_string()
                } else {
                    "sudo apt install lua5.4 || sudo dnf install lua".to_string()
                }
            }
            _ => format!("# Install {} manually", provider_id),
        }
    }

    /// Get expected PATH patterns for a provider
    fn get_expected_path_patterns(&self, provider_id: &str) -> Vec<String> {
        match provider_id {
            "fnm" => vec!["fnm".to_string()],
            "nvm" => vec!["nvm".to_string()],
            "volta" => vec![".volta".to_string()],
            "deno" => vec![".deno".to_string()],
            "pyenv" => vec!["pyenv".to_string(), ".pyenv".to_string()],
            "uv" => vec!["uv".to_string(), ".local/share/uv".to_string()],
            "conda" => vec![
                "conda".to_string(),
                "miniconda".to_string(),
                "anaconda".to_string(),
            ],
            "goenv" => vec!["goenv".to_string(), ".goenv".to_string()],
            "rustup" => vec![".cargo".to_string(), ".rustup".to_string()],
            "rbenv" => vec!["rbenv".to_string(), ".rbenv".to_string()],
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" => {
                vec!["sdkman".to_string(), ".sdkman".to_string()]
            }
            "phpbrew" => vec!["phpbrew".to_string(), ".phpbrew".to_string()],
            "dotnet" => vec!["dotnet".to_string()],
            "zig" => vec![".zig".to_string()],
            "fvm" => vec![".fvm".to_string(), "fvm".to_string()],
            "system-lua" => vec!["lua".to_string()],
            _ => vec![],
        }
    }

    /// Get shell setup command for a provider
    fn get_shell_setup_command(&self, provider_id: &str) -> String {
        match provider_id {
            "fnm" => "eval \"$(fnm env)\"".to_string(),
            "nvm" => "source ~/.nvm/nvm.sh".to_string(),
            "volta" => {
                "export VOLTA_HOME=\"$HOME/.volta\" && export PATH=\"$VOLTA_HOME/bin:$PATH\""
                    .to_string()
            }
            "deno" => "export PATH=\"$HOME/.deno/bin:$PATH\"".to_string(),
            "pyenv" => "eval \"$(pyenv init -)\"".to_string(),
            "uv" => "# uv manages PATH automatically".to_string(),
            "conda" => "eval \"$(conda shell.bash hook)\"".to_string(),
            "goenv" => "eval \"$(goenv init -)\"".to_string(),
            "rustup" => "source $HOME/.cargo/env".to_string(),
            "rbenv" => "eval \"$(rbenv init -)\"".to_string(),
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" => {
                "source \"$HOME/.sdkman/bin/sdkman-init.sh\"".to_string()
            }
            "phpbrew" => "source ~/.phpbrew/bashrc".to_string(),
            "zig" => "export PATH=\"$HOME/.zig/current:$PATH\"".to_string(),
            "fvm" => "export PATH=\"$HOME/fvm/default/bin:$PATH\"".to_string(),
            "system-lua" => "eval $(luarocks path)".to_string(),
            _ => format!("# Configure {} in your shell", provider_id),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_default() {
        let status = HealthStatus::Unknown;
        assert!(matches!(status, HealthStatus::Unknown));
    }

    #[test]
    fn test_severity_ordering() {
        let critical = Severity::Critical;
        let error = Severity::Error;
        let warning = Severity::Warning;
        let info = Severity::Info;

        assert!(matches!(critical, Severity::Critical));
        assert!(matches!(error, Severity::Error));
        assert!(matches!(warning, Severity::Warning));
        assert!(matches!(info, Severity::Info));
    }

    #[test]
    fn test_health_issue_creation() {
        let issue = HealthIssue::new(
            Severity::Error,
            IssueCategory::ProviderNotFound,
            "Test issue",
        );

        assert!(matches!(issue.severity, Severity::Error));
        assert!(matches!(issue.category, IssueCategory::ProviderNotFound));
        assert_eq!(issue.message, "Test issue");
        assert!(issue.details.is_none());
        assert!(issue.fix_command.is_none());
    }

    #[test]
    fn test_health_issue_with_details() {
        let issue = HealthIssue::new(
            Severity::Warning,
            IssueCategory::ConfigError,
            "Config issue",
        )
        .with_details("More details here");

        assert_eq!(issue.details, Some("More details here".to_string()));
    }

    #[test]
    fn test_health_issue_with_fix() {
        let issue = HealthIssue::new(
            Severity::Error,
            IssueCategory::MissingDependency,
            "Missing package",
        )
        .with_fix("npm install pkg", "Install the package");

        assert_eq!(issue.fix_command, Some("npm install pkg".to_string()));
        assert_eq!(
            issue.fix_description,
            Some("Install the package".to_string())
        );
    }

    #[test]
    fn test_package_manager_health_result_new() {
        let result = PackageManagerHealthResult::new("winget", "Windows Package Manager");

        assert_eq!(result.provider_id, "winget");
        assert_eq!(result.display_name, "Windows Package Manager");
        assert!(matches!(result.status, HealthStatus::Unknown));
        assert!(result.version.is_none());
        assert!(result.executable_path.is_none());
        assert!(result.issues.is_empty());
        assert!(result.install_instructions.is_none());
    }

    #[test]
    fn test_package_manager_health_result_add_issue_error() {
        let mut result = PackageManagerHealthResult::new("scoop", "Scoop");

        result.add_issue(HealthIssue::new(
            Severity::Error,
            IssueCategory::ProviderNotFound,
            "Scoop not found",
        ));

        assert!(matches!(result.status, HealthStatus::Error));
        assert_eq!(result.issues.len(), 1);
    }

    #[test]
    fn test_package_manager_health_result_add_issue_warning() {
        let mut result = PackageManagerHealthResult::new("brew", "Homebrew");

        result.add_issue(HealthIssue::new(
            Severity::Warning,
            IssueCategory::ConfigError,
            "Outdated version",
        ));

        assert!(matches!(result.status, HealthStatus::Warning));
    }

    #[test]
    fn test_package_manager_health_result_finalize_healthy() {
        let mut result = PackageManagerHealthResult::new("apt", "APT");
        result.finalize();

        assert!(matches!(result.status, HealthStatus::Healthy));
    }

    #[test]
    fn test_package_manager_health_result_finalize_with_issues() {
        let mut result = PackageManagerHealthResult::new("dnf", "DNF");
        result.add_issue(HealthIssue::new(
            Severity::Warning,
            IssueCategory::Other,
            "Minor issue",
        ));
        result.finalize();

        // Status should remain Warning, not change to Healthy
        assert!(matches!(result.status, HealthStatus::Warning));
    }

    #[test]
    fn test_system_health_result_new() {
        let result = SystemHealthResult::new();

        assert!(matches!(result.overall_status, HealthStatus::Healthy));
        assert!(result.environments.is_empty());
        assert!(result.package_managers.is_empty());
        assert!(result.system_issues.is_empty());
    }

    #[test]
    fn test_system_health_result_add_package_manager() {
        let mut system_result = SystemHealthResult::new();
        let mut pm_result = PackageManagerHealthResult::new("winget", "Winget");
        pm_result.add_issue(HealthIssue::new(
            Severity::Error,
            IssueCategory::ProviderNotFound,
            "Not installed",
        ));

        system_result.add_package_manager(pm_result);

        assert!(matches!(system_result.overall_status, HealthStatus::Error));
        assert_eq!(system_result.package_managers.len(), 1);
    }

    #[test]
    fn test_system_health_result_add_package_manager_warning() {
        let mut system_result = SystemHealthResult::new();
        let mut pm_result = PackageManagerHealthResult::new("scoop", "Scoop");
        pm_result.add_issue(HealthIssue::new(
            Severity::Warning,
            IssueCategory::ConfigError,
            "Config issue",
        ));

        system_result.add_package_manager(pm_result);

        assert!(matches!(
            system_result.overall_status,
            HealthStatus::Warning
        ));
    }

    #[test]
    fn test_environment_health_result_new() {
        let result = EnvironmentHealthResult::new("node");

        assert_eq!(result.env_type, "node");
        assert!(matches!(result.status, HealthStatus::Unknown));
        assert!(result.provider_id.is_none());
        assert!(result.issues.is_empty());
    }

    #[test]
    fn test_environment_health_result_with_provider() {
        let result = EnvironmentHealthResult::new("python").with_provider("pyenv");

        assert_eq!(result.provider_id, Some("pyenv".to_string()));
    }

    #[test]
    fn test_environment_health_result_add_suggestion() {
        let mut result = EnvironmentHealthResult::new("rust");
        result.add_suggestion("Current version: 1.75.0");

        assert_eq!(result.suggestions.len(), 1);
        assert_eq!(result.suggestions[0], "Current version: 1.75.0");
    }

    #[test]
    fn test_issue_category_variants() {
        let categories = vec![
            IssueCategory::PathConflict,
            IssueCategory::VersionMismatch,
            IssueCategory::MissingDependency,
            IssueCategory::ConfigError,
            IssueCategory::PermissionError,
            IssueCategory::NetworkError,
            IssueCategory::ProviderNotFound,
            IssueCategory::ShellIntegration,
            IssueCategory::Other,
        ];

        assert_eq!(categories.len(), 9);
    }
}
