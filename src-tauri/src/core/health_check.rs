use crate::error::{CogniaError, CogniaResult};
use crate::provider::{EnvironmentProvider, ProviderRegistry};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
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

/// Result of a full system health check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealthResult {
    pub overall_status: HealthStatus,
    pub environments: Vec<EnvironmentHealthResult>,
    pub system_issues: Vec<HealthIssue>,
    pub checked_at: String,
}

impl SystemHealthResult {
    pub fn new() -> Self {
        Self {
            overall_status: HealthStatus::Healthy,
            environments: Vec::new(),
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
            "php" => "phpbrew".to_string(),
            "dotnet" => "dotnet".to_string(),
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
                    format!("{} is not available or not installed", provider.display_name()),
                )
                .with_details(format!(
                    "The {} command was not found in your PATH",
                    provider.id()
                ))
                .with_fix(
                    self.get_install_command(provider.id()),
                    format!("Install {} to enable {} version management", provider.id(), env_type),
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
                        format!("{} may not be properly configured in your shell", provider.display_name()),
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
            "fnm" | "nvm" => "node".to_string(),
            "deno" => "deno".to_string(),
            "pyenv" => "python".to_string(),
            "goenv" => "go".to_string(),
            "rustup" => "rust".to_string(),
            "rbenv" => "ruby".to_string(),
            "sdkman" => "java".to_string(),
            "phpbrew" => "php".to_string(),
            "dotnet" => "dotnet".to_string(),
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
                    "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash".to_string()
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
            "goenv" => "git clone https://github.com/syndbg/goenv.git ~/.goenv".to_string(),
            "rustup" => {
                if cfg!(windows) {
                    "winget install Rustlang.Rustup".to_string()
                } else {
                    "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh".to_string()
                }
            }
            "rbenv" => "git clone https://github.com/rbenv/rbenv.git ~/.rbenv".to_string(),
            "sdkman" => "curl -s \"https://get.sdkman.io\" | bash".to_string(),
            "phpbrew" => "curl -L -O https://github.com/phpbrew/phpbrew/releases/latest/download/phpbrew.phar && chmod +x phpbrew.phar && sudo mv phpbrew.phar /usr/local/bin/phpbrew".to_string(),
            "dotnet" => {
                if cfg!(windows) {
                    "winget install Microsoft.DotNet.SDK.8".to_string()
                } else {
                    "curl -sSL https://dot.net/v1/dotnet-install.sh | bash".to_string()
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
            "deno" => vec![".deno".to_string()],
            "pyenv" => vec!["pyenv".to_string(), ".pyenv".to_string()],
            "goenv" => vec!["goenv".to_string(), ".goenv".to_string()],
            "rustup" => vec![".cargo".to_string(), ".rustup".to_string()],
            "rbenv" => vec!["rbenv".to_string(), ".rbenv".to_string()],
            "sdkman" => vec!["sdkman".to_string(), ".sdkman".to_string()],
            "phpbrew" => vec!["phpbrew".to_string(), ".phpbrew".to_string()],
            "dotnet" => vec!["dotnet".to_string()],
            _ => vec![],
        }
    }

    /// Get shell setup command for a provider
    fn get_shell_setup_command(&self, provider_id: &str) -> String {
        match provider_id {
            "fnm" => "eval \"$(fnm env)\"".to_string(),
            "nvm" => "source ~/.nvm/nvm.sh".to_string(),
            "deno" => "export PATH=\"$HOME/.deno/bin:$PATH\"".to_string(),
            "pyenv" => "eval \"$(pyenv init -)\"".to_string(),
            "goenv" => "eval \"$(goenv init -)\"".to_string(),
            "rustup" => "source $HOME/.cargo/env".to_string(),
            "rbenv" => "eval \"$(rbenv init -)\"".to_string(),
            "sdkman" => "source \"$HOME/.sdkman/bin/sdkman-init.sh\"".to_string(),
            "phpbrew" => "source ~/.phpbrew/bashrc".to_string(),
            _ => format!("# Configure {} in your shell", provider_id),
        }
    }
}
