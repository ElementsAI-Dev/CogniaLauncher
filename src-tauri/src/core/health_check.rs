use crate::error::{CogniaError, CogniaResult};
use crate::provider::{EnvironmentProvider, Provider, ProviderRegistry};

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

/// Availability/scope state for a health target
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthScopeState {
    Available,
    Unavailable,
    Timeout,
    Unsupported,
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
    pub remediation_id: Option<String>,
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
            remediation_id: None,
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

    pub fn with_remediation(
        mut self,
        remediation_id: impl Into<String>,
        command: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        self.remediation_id = Some(remediation_id.into());
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
    pub scope_state: HealthScopeState,
    pub scope_reason: Option<String>,
    pub issues: Vec<HealthIssue>,
    pub suggestions: Vec<String>,
    pub current_version: Option<String>,
    pub installed_count: Option<usize>,
    pub checked_at: String,
}

impl EnvironmentHealthResult {
    pub fn new(env_type: impl Into<String>) -> Self {
        Self {
            env_type: env_type.into(),
            provider_id: None,
            status: HealthStatus::Unknown,
            scope_state: HealthScopeState::Available,
            scope_reason: None,
            issues: Vec::new(),
            suggestions: Vec::new(),
            current_version: None,
            installed_count: None,
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

    pub fn set_scope_state(
        &mut self,
        scope_state: HealthScopeState,
        reason: impl Into<String>,
    ) {
        self.scope_state = scope_state;
        self.scope_reason = Some(reason.into());
    }

    pub fn finalize(&mut self) {
        // If no Warning/Error/Critical issues were added, status is still Unknown —
        // treat that as Healthy only when the target is actually available.
        if self.status == HealthStatus::Unknown {
            self.status = if self.scope_state == HealthScopeState::Available {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unknown
            };
        }
    }
}

/// Result of a health check for a package manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManagerHealthResult {
    pub provider_id: String,
    pub display_name: String,
    pub status: HealthStatus,
    pub scope_state: HealthScopeState,
    pub scope_reason: Option<String>,
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
            scope_state: HealthScopeState::Available,
            scope_reason: None,
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

    pub fn set_scope_state(
        &mut self,
        scope_state: HealthScopeState,
        reason: impl Into<String>,
    ) {
        self.scope_state = scope_state;
        self.scope_reason = Some(reason.into());
    }

    pub fn finalize(&mut self) {
        if self.status == HealthStatus::Unknown {
            self.status = if self.scope_state == HealthScopeState::Available {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unknown
            };
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
    pub skipped_providers: Vec<String>,
    pub checked_at: String,
}

impl SystemHealthResult {
    pub fn new() -> Self {
        Self {
            overall_status: HealthStatus::Healthy,
            environments: Vec::new(),
            package_managers: Vec::new(),
            system_issues: Vec::new(),
            skipped_providers: Vec::new(),
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

/// Progress information for health check
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckProgress {
    pub completed: usize,
    pub total: usize,
    pub current_provider: String,
    pub phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthRemediationResult {
    pub remediation_id: String,
    pub supported: bool,
    pub dry_run: bool,
    pub executed: bool,
    pub success: bool,
    pub manual_only: bool,
    pub command: Option<String>,
    pub description: Option<String>,
    pub message: String,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

/// Health check manager
pub struct HealthCheckManager {
    registry: Arc<RwLock<ProviderRegistry>>,
}

impl HealthCheckManager {
    pub fn new(registry: Arc<RwLock<ProviderRegistry>>) -> Self {
        Self { registry }
    }

    fn canonical_environment_types() -> &'static [&'static str] {
        &[
            "node", "python", "go", "rust", "ruby", "java", "kotlin", "scala", "groovy",
            "gradle", "maven", "php", "dotnet", "deno", "zig", "dart", "bun", "lua",
            "elixir", "erlang", "swift", "julia", "perl", "r", "haskell", "clojure",
            "crystal", "nim", "ocaml", "fortran", "c", "cpp",
        ]
    }

    fn remediation_id(kind: &str, target: &str) -> String {
        format!("{}:{}", kind, target)
    }

    fn build_install_issue(
        &self,
        provider_id: &str,
        display_name: &str,
        details: impl Into<String>,
        description: impl Into<String>,
    ) -> HealthIssue {
        HealthIssue::new(
            Severity::Info,
            IssueCategory::ProviderNotFound,
            format!("{} is not installed", display_name),
        )
        .with_details(details)
        .with_remediation(
            Self::remediation_id("install-provider", provider_id),
            self.get_install_command(provider_id),
            description,
        )
    }

    fn create_environment_timeout_result(&self, env_type: &str) -> EnvironmentHealthResult {
        let mut result = EnvironmentHealthResult::new(env_type);
        result.set_scope_state(HealthScopeState::Timeout, "health_check_timeout");
        result.add_issue(
            HealthIssue::new(
                Severity::Warning,
                IssueCategory::Other,
                format!("{} health check timed out", env_type),
            )
            .with_details("The environment health check did not finish within the configured timeout."),
        );
        result.finalize();
        result
    }

    fn create_package_manager_timeout_result(
        &self,
        provider_id: &str,
        display_name: &str,
    ) -> PackageManagerHealthResult {
        let mut result = PackageManagerHealthResult::new(provider_id, display_name);
        result.set_scope_state(HealthScopeState::Timeout, "health_check_timeout");
        result.add_issue(
            HealthIssue::new(
                Severity::Warning,
                IssueCategory::Other,
                format!("{} health check timed out", display_name),
            )
            .with_details("The provider health check did not finish within the configured timeout."),
        );
        result.finalize();
        result
    }

    /// Run health check for all environments (parallel with timeout and progress)
    pub async fn check_all(&self) -> CogniaResult<SystemHealthResult> {
        self.check_all_with_progress(|_| {}).await
    }

    /// Run health check with progress callback
    pub async fn check_all_with_progress<F>(
        &self,
        mut on_progress: F,
    ) -> CogniaResult<SystemHealthResult>
    where
        F: FnMut(HealthCheckProgress),
    {
        let mut result = SystemHealthResult::new();
        let env_types = Self::canonical_environment_types();

        let all_pm_entries: Vec<(String, Arc<dyn Provider>)> = {
            let registry = self.registry.read().await;
            let mut provider_ids = registry.list_system_package_provider_ids();
            provider_ids.retain(|id| registry.get_environment_provider(id).is_none());
            provider_ids.extend(["github".to_string(), "gitlab".to_string()]);
            provider_ids.sort();
            provider_ids.dedup();
            provider_ids
                .into_iter()
                .filter_map(|id| registry.get(&id).map(|p| (id, p)))
                .collect()
        };

        let total = 1 + env_types.len() + all_pm_entries.len();

        // Phase 1: System-level checks
        on_progress(HealthCheckProgress {
            completed: 0,
            total,
            current_provider: "system".into(),
            phase: "system".into(),
        });
        self.check_system_health(&mut result).await;
        on_progress(HealthCheckProgress {
            completed: 1,
            total,
            current_provider: "system".into(),
            phase: "system".into(),
        });

        // Phase 2: canonical logical environment checks
        let mut env_futures = Vec::with_capacity(env_types.len());
        for env_type in env_types {
            let registry = self.registry.clone();
            let env_type = (*env_type).to_string();
            env_futures.push(tokio::spawn(async move {
                let mgr = HealthCheckManager::new(registry);
                tokio::time::timeout(
                    Duration::from_secs(15),
                    mgr.check_environment(&env_type),
                )
                .await
                .unwrap_or_else(|_| Ok(mgr.create_environment_timeout_result(&env_type)))
            }));
        }

        let env_results = futures::future::join_all(env_futures).await;
        for (i, join_result) in env_results.into_iter().enumerate() {
            if let Ok(Ok(env_result)) = join_result {
                if env_result.scope_state != HealthScopeState::Available {
                    if let Some(provider_id) = &env_result.provider_id {
                        result.skipped_providers.push(provider_id.clone());
                    }
                }
                result.add_environment(env_result);
            }
            on_progress(HealthCheckProgress {
                completed: 1 + i + 1,
                total,
                current_provider: env_types.get(i).copied().unwrap_or_default().to_string(),
                phase: "environment".into(),
            });
        }

        // Phase 3: package manager/provider checks including unavailable providers
        let mut pm_futures = Vec::with_capacity(all_pm_entries.len());
        let pm_ids: Vec<String> = all_pm_entries.iter().map(|(id, _)| id.clone()).collect();

        for (_id, provider) in all_pm_entries {
            let registry = self.registry.clone();
            pm_futures.push(tokio::spawn(async move {
                let mgr = HealthCheckManager::new(registry);
                tokio::time::timeout(
                    Duration::from_secs(15),
                    mgr.check_package_manager_health(&*provider),
                )
                .await
                .unwrap_or_else(|_| {
                    mgr.create_package_manager_timeout_result(provider.id(), provider.display_name())
                })
            }));
        }

        let pm_results = futures::future::join_all(pm_futures).await;
        for (i, join_result) in pm_results.into_iter().enumerate() {
            if let Ok(pm_result) = join_result {
                if pm_result.scope_state != HealthScopeState::Available {
                    result.skipped_providers.push(pm_result.provider_id.clone());
                }
                result.add_package_manager(pm_result);
            }
            on_progress(HealthCheckProgress {
                completed: 1 + env_types.len() + i + 1,
                total,
                current_provider: pm_ids.get(i).cloned().unwrap_or_default(),
                phase: "package_manager".into(),
            });
        }

        result.skipped_providers.sort();
        result.skipped_providers.dedup();
        Ok(result)
    }

    /// Run health check for a specific environment type
    pub async fn check_environment(&self, env_type: &str) -> CogniaResult<EnvironmentHealthResult> {
        let registry = self.registry.read().await;

        // Dynamic provider resolution via candidate_provider_ids (same as EnvironmentManager)
        let candidates = crate::core::environment::candidate_provider_ids(env_type);
        let providers: Vec<(String, Arc<dyn EnvironmentProvider>)> = candidates
            .iter()
            .filter_map(|id| {
                registry
                    .get_environment_provider(id)
                    .map(|provider| ((*id).to_string(), provider))
            })
            .collect();
        drop(registry);

        if providers.is_empty() {
            let default_provider = crate::core::environment::env_type_to_default_provider(env_type);
            let mut result = EnvironmentHealthResult::new(env_type).with_provider(default_provider.clone());
            result.set_scope_state(HealthScopeState::Unsupported, "no_registered_provider");
            result.add_issue(
                self.build_install_issue(
                    &default_provider,
                    &format!("{} manager", env_type),
                    format!("Install a version manager for {} to enable environment management", env_type),
                    format!("Install {} to enable {} version management", default_provider, env_type),
                ),
            );
            result.finalize();
            return Ok(result);
        }

        let mut first_registered: Option<(String, Arc<dyn EnvironmentProvider>)> = None;
        let mut selected: Option<(String, Arc<dyn EnvironmentProvider>)> = None;
        let mut available_candidates = Vec::new();

        for (provider_id, provider) in &providers {
            if first_registered.is_none() {
                first_registered = Some((provider_id.clone(), provider.clone()));
            }
            if provider.is_available().await {
                available_candidates.push(provider_id.clone());
                if selected.is_none() {
                    selected = Some((provider_id.clone(), provider.clone()));
                }
            }
        }

        let (provider_id, provider) = selected.or(first_registered).expect("providers checked above");
        let mut result = self.check_environment_health(&*provider).await;
        result.env_type = env_type.to_string();
        result.provider_id = Some(provider_id.clone());
        if available_candidates.len() > 1 {
            result.add_suggestion(format!(
                "Multiple providers are available for {}: {}",
                env_type,
                available_candidates.join(", ")
            ));
        }
        Ok(result)
    }

    /// Run health check for all package managers (parallel with timeout)
    pub async fn check_package_managers(&self) -> CogniaResult<Vec<PackageManagerHealthResult>> {
        let providers: Vec<Arc<dyn Provider>> = {
            let registry = self.registry.read().await;
            let mut provider_ids = registry.list_system_package_provider_ids();
            provider_ids.retain(|id| registry.get_environment_provider(id).is_none());
            provider_ids.extend(["github".to_string(), "gitlab".to_string()]);
            provider_ids.sort();
            provider_ids.dedup();
            provider_ids
                .into_iter()
                .filter_map(|id| registry.get(&id))
                .collect()
        };

        let mut futures = Vec::with_capacity(providers.len());
        for provider in providers {
            let registry = self.registry.clone();
            futures.push(tokio::spawn(async move {
                let mgr = HealthCheckManager::new(registry);
                tokio::time::timeout(
                    Duration::from_secs(15),
                    mgr.check_package_manager_health(&*provider),
                )
                .await
                .unwrap_or_else(|_| {
                    mgr.create_package_manager_timeout_result(provider.id(), provider.display_name())
                })
            }));
        }

        let join_results = futures::future::join_all(futures).await;
        let results = join_results.into_iter().filter_map(|r| r.ok()).collect();
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
            result.set_scope_state(HealthScopeState::Unavailable, "provider_not_installed");
            result.add_issue(
                self.build_install_issue(
                    provider.id(),
                    provider.display_name(),
                    format!(
                        "The {} package manager is not available on this system",
                        provider.display_name()
                    ),
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

        // Check 2: Get version + Check 3: System requirements
        let system_provider = {
            let registry = self.registry.read().await;
            registry.get_system_provider(provider.id())
        };
        if let Some(sp) = &system_provider {
            if let Ok(version) = sp.get_version().await {
                result.version = Some(version);
            }
            if let Ok(path) = sp.get_executable_path().await {
                result.executable_path = Some(path);
            }
            result.install_instructions = sp.get_install_instructions();

            // Check 3: System requirements (lightweight, replaces expensive list_installed scan)
            match sp.check_system_requirements().await {
                Ok(true) => {
                    // All requirements met
                }
                Ok(false) => {
                    result.add_issue(
                        HealthIssue::new(
                            Severity::Warning,
                            IssueCategory::ConfigError,
                            format!(
                                "{} system requirements not fully met",
                                provider.display_name()
                            ),
                        )
                        .with_details("Some system prerequisites may be missing or misconfigured"),
                    );
                }
                Err(e) => {
                    result.add_issue(
                        HealthIssue::new(
                            Severity::Warning,
                            IssueCategory::ConfigError,
                            format!("{} requirements check failed", provider.display_name()),
                        )
                        .with_details(format!("{}", e)),
                    );
                }
            }
        } else {
            result.install_instructions = Some(self.get_install_instructions(provider.id()));
        }

        // Check 4: Registry connectivity (only for available providers)
        if is_available {
            if let Some(issue) = self.check_registry_connectivity(provider.id()).await {
                result.add_issue(issue);
            }
        }

        result.finalize();
        result
    }

    /// Check if the package registry for a provider is reachable
    async fn check_registry_connectivity(&self, provider_id: &str) -> Option<HealthIssue> {
        let url = match provider_id {
            "npm" | "pnpm" | "yarn" | "bun" => "https://registry.npmjs.org/-/ping",
            "pip" | "uv" | "poetry" => "https://pypi.org/simple/",
            "cargo" => "https://crates.io/api/v1/crates?per_page=1",
            "gem" | "bundler" => "https://rubygems.org/api/v1/versions/rake/latest.json",
            "composer" => "https://repo.packagist.org/packages.json",
            "dotnet" => "https://api.nuget.org/v3/index.json",
            _ => return None,
        };

        let client = crate::platform::proxy::get_shared_client();
        match client.get(url).timeout(Duration::from_secs(5)).send().await {
            Ok(resp) if resp.status().is_success() => None,
            Ok(resp) => Some(
                HealthIssue::new(
                    Severity::Warning,
                    IssueCategory::NetworkError,
                    format!("Package registry returned HTTP {}", resp.status()),
                )
                .with_details(format!(
                    "The {} package registry at {} may be experiencing issues",
                    provider_id, url
                )),
            ),
            Err(e) => {
                let msg = if e.is_timeout() {
                    "Package registry connection timed out"
                } else {
                    "Cannot reach package registry"
                };
                Some(
                    HealthIssue::new(Severity::Warning, IssueCategory::NetworkError, msg)
                        .with_details(format!("Failed to reach {}: {}", url, e)),
                )
            }
        }
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

        let client = crate::platform::proxy::get_shared_client();

        match client
            .get(url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
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

    pub async fn apply_remediation(
        &self,
        remediation_id: &str,
        dry_run: bool,
    ) -> CogniaResult<HealthRemediationResult> {
        let mut parts = remediation_id.splitn(2, ':');
        let kind = parts.next().unwrap_or_default();
        let target = parts.next().unwrap_or_default();

        match kind {
            "install-provider" if !target.is_empty() => {
                let command = self.get_install_command(target);
                if dry_run {
                    return Ok(HealthRemediationResult {
                        remediation_id: remediation_id.to_string(),
                        supported: true,
                        dry_run: true,
                        executed: false,
                        success: true,
                        manual_only: false,
                        command: Some(command),
                        description: Some(format!("Install provider {}", target)),
                        message: format!("Preview install command for {}", target),
                        stdout: None,
                        stderr: None,
                    });
                }

                let output = crate::platform::process::execute_shell(
                    &command,
                    Some(
                        crate::platform::process::ProcessOptions::new()
                            .with_timeout(Duration::from_secs(60)),
                    ),
                )
                .await
                .map_err(|e| CogniaError::Internal(format!("Remediation failed: {}", e)))?;

                Ok(HealthRemediationResult {
                    remediation_id: remediation_id.to_string(),
                    supported: true,
                    dry_run: false,
                    executed: true,
                    success: output.success,
                    manual_only: false,
                    command: Some(command),
                    description: Some(format!("Install provider {}", target)),
                    message: if output.success {
                        format!("Remediation succeeded for {}", target)
                    } else {
                        format!("Remediation failed for {}", target)
                    },
                    stdout: Some(output.stdout),
                    stderr: Some(output.stderr),
                })
            }
            "shell-setup" if !target.is_empty() => {
                let command = self.get_shell_setup_command(target);
                Ok(HealthRemediationResult {
                    remediation_id: remediation_id.to_string(),
                    supported: true,
                    dry_run,
                    executed: false,
                    success: dry_run,
                    manual_only: true,
                    command: Some(command),
                    description: Some(format!("Update shell configuration for {}", target)),
                    message: format!(
                        "Shell setup for {} requires a manual update to your shell configuration",
                        target
                    ),
                    stdout: None,
                    stderr: None,
                })
            }
            _ => Ok(HealthRemediationResult {
                remediation_id: remediation_id.to_string(),
                supported: false,
                dry_run,
                executed: false,
                success: false,
                manual_only: true,
                command: None,
                description: None,
                message: format!("Unsupported remediation: {}", remediation_id),
                stdout: None,
                stderr: None,
            }),
        }
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

        // Check disk space
        if let Some(disk_issues) = self.check_disk_space().await {
            for issue in disk_issues {
                result.add_system_issue(issue);
            }
        }

        // Check for version manager conflicts
        if let Some(conflict_issues) = self.check_version_manager_conflicts().await {
            for issue in conflict_issues {
                result.add_system_issue(issue);
            }
        }
    }

    /// Check available disk space on the home partition
    async fn check_disk_space(&self) -> Option<Vec<HealthIssue>> {
        let home = crate::platform::env::dirs_home()?;
        let space = crate::platform::disk::get_disk_space(&home).await.ok()?;
        let mut issues = Vec::new();

        const MB_256: u64 = 256 * 1024 * 1024;
        const GB_1: u64 = 1024 * 1024 * 1024;

        if space.available < MB_256 {
            issues.push(
                HealthIssue::new(
                    Severity::Error,
                    IssueCategory::Other,
                    format!(
                        "Critically low disk space: {} available",
                        space.available_human()
                    ),
                )
                .with_details(
                    "Package installations and version management may fail. Free up disk space.",
                ),
            );
        } else if space.available < GB_1 {
            issues.push(
                HealthIssue::new(
                    Severity::Warning,
                    IssueCategory::Other,
                    format!("Low disk space: {} available", space.available_human()),
                )
                .with_details(
                    "Some large package installations may fail. Consider freeing up disk space.",
                ),
            );
        }

        if issues.is_empty() {
            None
        } else {
            Some(issues)
        }
    }

    /// Check for multiple version managers active for the same language
    async fn check_version_manager_conflicts(&self) -> Option<Vec<HealthIssue>> {
        let mut issues = Vec::new();

        let conflict_groups: &[(&str, &[&str])] = &[
            ("node", &["fnm", "nvm", "volta"]),
            ("python", &["pyenv", "conda"]),
            ("ruby", &["rbenv"]),
            ("java", &["sdkman"]),
            ("go", &["goenv"]),
        ];

        // Collect all (env_type, manager_id, provider) tuples, then drop the lock
        let mut checks: Vec<(&str, &str, Arc<dyn EnvironmentProvider>)> = Vec::new();
        {
            let registry = self.registry.read().await;
            for &(env_type, managers) in conflict_groups {
                for &manager in managers {
                    if let Some(provider) = registry.get_environment_provider(manager) {
                        checks.push((env_type, manager, provider));
                    }
                }
            }
        }

        // Group by env_type and check availability without holding the lock
        for &(env_type, _managers) in conflict_groups {
            let mut available = Vec::new();
            for &(et, manager, ref provider) in &checks {
                if et == env_type && provider.is_available().await {
                    available.push(manager);
                }
            }
            if available.len() > 1 {
                issues.push(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::PathConflict,
                        format!(
                            "Multiple {} version managers detected: {}",
                            env_type,
                            available.join(", ")
                        ),
                    )
                    .with_details(
                        "Having multiple version managers for the same language can cause PATH conflicts and unexpected version switching.",
                    ),
                );
            }
        }

        if issues.is_empty() {
            None
        } else {
            Some(issues)
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
            result.set_scope_state(HealthScopeState::Unavailable, "provider_not_installed");
            result.add_issue(
                self.build_install_issue(
                    provider.id(),
                    provider.display_name(),
                    format!("The {} command was not found in your PATH", provider.id()),
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
                result.current_version = Some(version);
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
                    result.installed_count = Some(versions.len());
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

    /// Check shell configuration for missing provider init lines
    /// Skipped on Windows — all init patterns are Unix shell-specific (source, eval).
    /// Windows tools set PATH via installers/registry, not shell config sourcing.
    async fn check_shell_config(&self) -> Option<Vec<HealthIssue>> {
        #[cfg(windows)]
        {
            return None;
        }

        #[cfg(not(windows))]
        {
            use crate::platform::env::ShellType;

            let mut issues = Vec::new();

            let shell_type = ShellType::detect();
            let config_files = shell_type.config_files();
            if config_files.is_empty() {
                return None;
            }

            // Read ALL existing shell config files and concatenate their contents
            let mut all_content = String::new();
            for path in &config_files {
                if path.exists() {
                    if let Ok(c) = crate::core::terminal::read_shell_config(path).await {
                        all_content.push_str(&c);
                        all_content.push('\n');
                    }
                }
            }

            if all_content.is_empty() {
                return None;
            }
            let content = all_content;

            // Collect providers then drop lock before async is_available() calls
            let env_providers: Vec<(String, Arc<dyn EnvironmentProvider>)> = {
                let registry = self.registry.read().await;
                registry
                    .list_environment_providers()
                    .iter()
                    .filter_map(|id| {
                        registry
                            .get_environment_provider(id)
                            .map(|p| (id.to_string(), p))
                    })
                    .collect()
            };

            for (provider_id, provider) in &env_providers {
                if !provider.is_available().await {
                    continue;
                }
                let init_pattern = Self::get_shell_init_pattern(provider_id);
                if !init_pattern.is_empty() && !content.contains(&init_pattern) {
                    issues.push(
                    HealthIssue::new(
                        Severity::Warning,
                        IssueCategory::ShellIntegration,
                        format!(
                            "{} shell initialization not found",
                            provider.display_name()
                        ),
                    )
                    .with_details(format!(
                        "Expected '{}' in shell config. The provider is installed but may not activate in new shell sessions.",
                        init_pattern
                    ))
                    .with_remediation(
                        Self::remediation_id("shell-setup", provider_id),
                        self.get_shell_setup_command(provider_id),
                        format!(
                            "Add {} initialization to your shell config",
                            provider.display_name()
                        ),
                    ),
                );
                }
            }

            if issues.is_empty() {
                None
            } else {
                Some(issues)
            }
        } // #[cfg(not(windows))]
    }

    /// Key string to look for in shell config to verify provider init
    #[cfg(not(windows))]
    fn get_shell_init_pattern(provider_id: &str) -> String {
        match provider_id {
            "fnm" => "fnm env".into(),
            "nvm" => "nvm.sh".into(),
            "volta" => ".volta".into(),
            "pyenv" => "pyenv init".into(),
            "conda" => "conda".into(),
            "goenv" => "goenv init".into(),
            "rustup" => "cargo/env".into(),
            "rbenv" => "rbenv init".into(),
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" | "sdkman-groovy" | "sdkman-gradle"
            | "sdkman-maven" => "sdkman-init.sh".into(),
            "phpbrew" => "phpbrew/bashrc".into(),
            _ => String::new(),
        }
    }

    /// Check PATH configuration for a specific provider
    async fn check_provider_path(
        &self,
        provider: &dyn EnvironmentProvider,
        result: &mut EnvironmentHealthResult,
    ) {
        let provider_id = provider.id();
        let path_var = std::env::var("PATH").unwrap_or_default();
        let sep = if cfg!(windows) { ';' } else { ':' };
        let path_dirs: Vec<String> = path_var
            .split(sep)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_lowercase().replace('\\', "/"))
            .collect();

        let expected_patterns = self.get_expected_path_patterns(provider_id);
        if expected_patterns.is_empty() {
            return;
        }

        // Match by path segment to avoid false positives
        // e.g. pattern "fnm" matches segments "fnm" or ".fnm" but not "my-fnm-tool"
        for pattern in &expected_patterns {
            let pat = pattern.to_lowercase();
            let found = path_dirs.iter().any(|dir| {
                // For multi-segment patterns like ".local/share/uv", check substring
                if pat.contains('/') {
                    return dir.contains(&pat);
                }
                // For single-segment patterns, match exact segment
                dir.split('/')
                    .any(|segment| segment == pat || segment == format!(".{}", pat))
            });
            if !found {
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
                    .with_remediation(
                        Self::remediation_id("shell-setup", provider_id),
                        self.get_shell_setup_command(provider_id),
                        "Add the provider to your shell configuration",
                    ),
                );
                // Report all missing patterns, don't break after first
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
            "sdkman-groovy" => "groovy".to_string(),
            "sdkman-gradle" => "gradle".to_string(),
            "sdkman-maven" => "maven".to_string(),
            "adoptium" => "java".to_string(),
            "phpbrew" => "php".to_string(),
            "dotnet" => "dotnet".to_string(),
            "zig" => "zig".to_string(),
            "fvm" => "dart".to_string(),
            "system-c" => "c".to_string(),
            "system-cpp" => "cpp".to_string(),
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
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" | "sdkman-groovy" | "sdkman-gradle" | "sdkman-maven" => "curl -s \"https://get.sdkman.io\" | bash".to_string(),
            "adoptium" => "Managed by CogniaLauncher — no external tool required".to_string(),
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
            "system-c" | "system-cpp" => {
                if cfg!(windows) {
                    "winget install Microsoft.VisualStudio.2022.BuildTools --override \"--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64\"".to_string()
                } else if cfg!(target_os = "macos") {
                    "xcode-select --install".to_string()
                } else {
                    "sudo apt install build-essential || sudo dnf install gcc gcc-c++".to_string()
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
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" | "sdkman-groovy" | "sdkman-gradle"
            | "sdkman-maven" => {
                vec!["sdkman".to_string(), ".sdkman".to_string()]
            }
            "adoptium" => vec![".CogniaLauncher".to_string(), "jdks".to_string()],
            "phpbrew" => vec!["phpbrew".to_string(), ".phpbrew".to_string()],
            "dotnet" => vec!["dotnet".to_string()],
            "zig" => vec![".zig".to_string()],
            "fvm" => vec![".fvm".to_string(), "fvm".to_string()],
            "system-lua" => vec!["lua".to_string()],
            "system-c" | "system-cpp" => vec![],
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
            "sdkman" | "sdkman-kotlin" | "sdkman-scala" | "sdkman-groovy" | "sdkman-gradle" | "sdkman-maven" => {
                "source \"$HOME/.sdkman/bin/sdkman-init.sh\"".to_string()
            }
            "adoptium" => "export JAVA_HOME=\"$HOME/.CogniaLauncher/jdks/current\" && export PATH=\"$JAVA_HOME/bin:$PATH\"".to_string(),
            "phpbrew" => "source ~/.phpbrew/bashrc".to_string(),
            "zig" => "export PATH=\"$HOME/.zig/current:$PATH\"".to_string(),
            "fvm" => "export PATH=\"$HOME/fvm/default/bin:$PATH\"".to_string(),
            "system-lua" => "eval $(luarocks path)".to_string(),
            "system-c" | "system-cpp" => "# System compilers are available in PATH by default".to_string(),
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
        assert!(result.skipped_providers.is_empty());
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
        assert!(result.current_version.is_none());
        assert!(result.installed_count.is_none());
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

    fn make_test_manager() -> HealthCheckManager {
        let registry = ProviderRegistry::new();
        HealthCheckManager::new(Arc::new(RwLock::new(registry)))
    }

    #[test]
    fn test_provider_to_env_type_c_cpp() {
        let mgr = make_test_manager();
        assert_eq!(mgr.provider_to_env_type("system-c"), "c");
        assert_eq!(mgr.provider_to_env_type("system-cpp"), "cpp");
    }

    #[test]
    fn test_get_install_command_c_cpp() {
        let mgr = make_test_manager();
        let cmd_c = mgr.get_install_command("system-c");
        let cmd_cpp = mgr.get_install_command("system-cpp");
        // Both should return the same platform-specific install command
        assert_eq!(cmd_c, cmd_cpp);
        assert!(!cmd_c.is_empty());
    }

    #[test]
    fn test_get_expected_path_patterns_c_cpp() {
        let mgr = make_test_manager();
        assert!(mgr.get_expected_path_patterns("system-c").is_empty());
        assert!(mgr.get_expected_path_patterns("system-cpp").is_empty());
    }

    #[test]
    fn test_get_shell_setup_command_c_cpp() {
        let mgr = make_test_manager();
        let cmd_c = mgr.get_shell_setup_command("system-c");
        let cmd_cpp = mgr.get_shell_setup_command("system-cpp");
        assert!(cmd_c.contains("System compilers"));
        assert!(cmd_cpp.contains("System compilers"));
    }

    // ── Adoptium / SDKMAN-Gradle / SDKMAN-Maven / SDKMAN-Groovy ──

    #[test]
    fn test_provider_to_env_type_jvm_providers() {
        let mgr = make_test_manager();
        assert_eq!(mgr.provider_to_env_type("sdkman-groovy"), "groovy");
        assert_eq!(mgr.provider_to_env_type("sdkman-gradle"), "gradle");
        assert_eq!(mgr.provider_to_env_type("sdkman-maven"), "maven");
        assert_eq!(mgr.provider_to_env_type("adoptium"), "java");
    }

    #[test]
    fn test_get_install_command_sdkman_jvm_tools() {
        let mgr = make_test_manager();
        let cmd_groovy = mgr.get_install_command("sdkman-groovy");
        let cmd_gradle = mgr.get_install_command("sdkman-gradle");
        let cmd_maven = mgr.get_install_command("sdkman-maven");
        // All SDKMAN variants should return the same install command
        assert!(cmd_groovy.contains("sdkman"));
        assert_eq!(cmd_groovy, cmd_gradle);
        assert_eq!(cmd_gradle, cmd_maven);
    }

    #[test]
    fn test_get_install_command_adoptium() {
        let mgr = make_test_manager();
        let cmd = mgr.get_install_command("adoptium");
        assert!(cmd.contains("CogniaLauncher"));
    }

    #[test]
    fn test_get_expected_path_patterns_sdkman_jvm_tools() {
        let mgr = make_test_manager();
        for provider_id in &["sdkman-groovy", "sdkman-gradle", "sdkman-maven"] {
            let patterns = mgr.get_expected_path_patterns(provider_id);
            assert!(
                patterns.contains(&"sdkman".to_string()),
                "{} should include 'sdkman' pattern",
                provider_id
            );
            assert!(
                patterns.contains(&".sdkman".to_string()),
                "{} should include '.sdkman' pattern",
                provider_id
            );
        }
    }

    #[test]
    fn test_get_expected_path_patterns_adoptium() {
        let mgr = make_test_manager();
        let patterns = mgr.get_expected_path_patterns("adoptium");
        assert!(patterns.contains(&".CogniaLauncher".to_string()));
        assert!(patterns.contains(&"jdks".to_string()));
    }

    #[test]
    fn test_get_shell_setup_command_sdkman_jvm_tools() {
        let mgr = make_test_manager();
        for provider_id in &["sdkman-groovy", "sdkman-gradle", "sdkman-maven"] {
            let cmd = mgr.get_shell_setup_command(provider_id);
            assert!(
                cmd.contains("sdkman-init.sh"),
                "{} shell setup should reference sdkman-init.sh, got: {}",
                provider_id,
                cmd
            );
        }
    }

    #[test]
    fn test_get_shell_setup_command_adoptium() {
        let mgr = make_test_manager();
        let cmd = mgr.get_shell_setup_command("adoptium");
        assert!(cmd.contains("JAVA_HOME"));
        assert!(cmd.contains(".CogniaLauncher/jdks"));
    }

    // ── New fields and behaviors ──

    #[test]
    fn test_system_health_result_skipped_providers() {
        let mut result = SystemHealthResult::new();
        result.skipped_providers.push("pyenv".to_string());
        result.skipped_providers.push("rbenv".to_string());

        assert_eq!(result.skipped_providers.len(), 2);
        assert!(result.skipped_providers.contains(&"pyenv".to_string()));
        // Skipping providers should not affect overall status
        assert!(matches!(result.overall_status, HealthStatus::Healthy));
    }

    #[test]
    fn test_environment_health_result_current_version() {
        let mut result = EnvironmentHealthResult::new("node");
        result.current_version = Some("20.11.0".to_string());
        result.installed_count = Some(3);

        assert_eq!(result.current_version, Some("20.11.0".to_string()));
        assert_eq!(result.installed_count, Some(3));
    }

    #[test]
    fn test_environment_finalize_healthy_with_info_issues() {
        let mut result = EnvironmentHealthResult::new("node");
        result.add_issue(HealthIssue::new(
            Severity::Info,
            IssueCategory::ProviderNotFound,
            "Provider not installed",
        ));
        result.finalize();

        // Info-only issues should still result in Healthy status
        assert!(matches!(result.status, HealthStatus::Healthy));
        assert_eq!(result.issues.len(), 1);
    }

    #[test]
    fn test_environment_finalize_warning_not_overridden_by_info() {
        let mut result = EnvironmentHealthResult::new("python");
        result.add_issue(HealthIssue::new(
            Severity::Warning,
            IssueCategory::ConfigError,
            "No active version",
        ));
        result.add_issue(HealthIssue::new(
            Severity::Info,
            IssueCategory::Other,
            "Info note",
        ));
        result.finalize();

        assert!(matches!(result.status, HealthStatus::Warning));
        assert_eq!(result.issues.len(), 2);
    }

    #[test]
    fn test_environment_finalize_unknown_when_scope_unavailable() {
        let mut result = EnvironmentHealthResult::new("node");
        result.set_scope_state(HealthScopeState::Unavailable, "provider_not_installed");
        result.add_issue(HealthIssue::new(
            Severity::Info,
            IssueCategory::ProviderNotFound,
            "Provider not installed",
        ));
        result.finalize();

        assert!(matches!(result.status, HealthStatus::Unknown));
    }

    #[test]
    fn test_check_registry_connectivity_returns_none_for_unknown() {
        let mgr = make_test_manager();
        // Unknown provider should return None (no URL to check)
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(mgr.check_registry_connectivity("unknown_provider"));
        assert!(result.is_none());
    }

    #[test]
    fn test_health_issue_with_remediation() {
        let issue = HealthIssue::new(
            Severity::Info,
            IssueCategory::ProviderNotFound,
            "Provider missing",
        )
        .with_remediation(
            "install-provider:fnm",
            "winget install Schniz.fnm",
            "Install fnm",
        );

        assert_eq!(issue.remediation_id, Some("install-provider:fnm".to_string()));
        assert_eq!(issue.fix_command, Some("winget install Schniz.fnm".to_string()));
    }

    #[test]
    fn test_apply_remediation_install_provider_dry_run() {
        let mgr = make_test_manager();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        let result = rt
            .block_on(mgr.apply_remediation("install-provider:fnm", true))
            .unwrap();

        assert!(result.supported);
        assert!(result.dry_run);
        assert!(!result.executed);
        assert!(result.success);
        assert_eq!(result.remediation_id, "install-provider:fnm");
        assert!(result.command.unwrap_or_default().contains("fnm"));
    }

    #[test]
    fn test_apply_remediation_shell_setup_is_manual_only() {
        let mgr = make_test_manager();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        let result = rt
            .block_on(mgr.apply_remediation("shell-setup:fnm", false))
            .unwrap();

        assert!(result.supported);
        assert!(result.manual_only);
        assert!(!result.executed);
        assert!(!result.success);
        assert!(result.command.unwrap_or_default().contains("fnm"));
    }

    #[test]
    fn test_check_environment_without_registered_provider_returns_supported_fix_metadata() {
        let mgr = make_test_manager();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        let result = rt.block_on(mgr.check_environment("node")).unwrap();

        assert!(matches!(result.scope_state, HealthScopeState::Unsupported));
        assert_eq!(result.provider_id, Some("fnm".to_string()));
        assert_eq!(
            result.issues.first().and_then(|issue| issue.remediation_id.clone()),
            Some("install-provider:fnm".to_string())
        );
    }
}
