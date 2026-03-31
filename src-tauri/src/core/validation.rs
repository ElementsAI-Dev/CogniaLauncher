use crate::core::{HealthCheckManager, HealthScopeState, HealthStatus};
use crate::platform::{
    disk,
    env::{current_platform, Platform},
};
use crate::resolver::Version;
use crate::{SharedRegistry, SharedSettings};
use async_trait::async_trait;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ValidationStatus {
    Pass,
    Warning,
    Failure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageValidationResult {
    pub validator_id: String,
    pub validator_name: String,
    pub status: ValidationStatus,
    pub summary: String,
    pub details: Vec<String>,
    pub remediation: Option<String>,
    pub package: Option<String>,
    pub provider_id: Option<String>,
    pub blocking: bool,
    pub timed_out: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackagePreflightSummary {
    pub results: Vec<PackageValidationResult>,
    pub can_proceed: bool,
    pub has_warnings: bool,
    pub has_failures: bool,
    pub checked_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationPackageSpec {
    pub raw: String,
    pub provider_id: Option<String>,
    pub name: String,
    pub version: Option<String>,
}

#[derive(Clone)]
pub struct ValidationContext {
    pub packages: Vec<ValidationPackageSpec>,
    pub registry: SharedRegistry,
    pub settings: SharedSettings,
}

impl ValidationContext {
    pub async fn from_package_specs(
        packages: Vec<String>,
        registry: SharedRegistry,
        settings: SharedSettings,
    ) -> Self {
        let mut resolved = Vec::with_capacity(packages.len());

        for raw in packages {
            let mut parsed = parse_package_spec(&raw);
            if parsed.provider_id.is_none() {
                let resolved_provider = {
                    let registry_guard = registry.read().await;
                    registry_guard
                        .find_for_package(&parsed.name)
                        .await
                        .ok()
                        .flatten()
                        .map(|provider| provider.id().to_string())
                };
                parsed.provider_id = resolved_provider;
            }
            resolved.push(parsed);
        }

        Self {
            packages: resolved,
            registry,
            settings,
        }
    }
}

pub fn parse_package_spec(spec: &str) -> ValidationPackageSpec {
    let trimmed = spec.trim();
    let mut provider_id = None;
    let mut rest = trimmed;

    if let Some(colon_index) = trimmed.find(':') {
        let candidate = &trimmed[..colon_index];
        if !candidate.is_empty() && !candidate.contains('@') && !candidate.contains('/') {
            provider_id = Some(candidate.to_string());
            rest = &trimmed[colon_index + 1..];
        }
    }

    let (name, version) = match rest.rfind('@') {
        Some(index) if index > 0 => {
            let maybe_version = &rest[index + 1..];
            if maybe_version.is_empty() {
                (rest.to_string(), None)
            } else {
                (rest[..index].to_string(), Some(maybe_version.to_string()))
            }
        }
        _ => (rest.to_string(), None),
    };

    ValidationPackageSpec {
        raw: trimmed.to_string(),
        provider_id,
        name,
        version,
    }
}

#[async_trait]
pub trait Validator: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn validate(&self, context: ValidationContext) -> Vec<PackageValidationResult>;
}

pub struct ValidatorChain {
    validators: Vec<Arc<dyn Validator>>,
    timeout: Duration,
}

impl ValidatorChain {
    pub fn new(validators: Vec<Arc<dyn Validator>>, timeout: Duration) -> Self {
        Self {
            validators,
            timeout,
        }
    }

    pub fn package_preflight() -> Self {
        Self::new(
            vec![
                Arc::new(ProviderHealthValidator),
                Arc::new(DiskSpaceValidator),
                Arc::new(PermissionValidator),
                Arc::new(DependencyValidator),
            ],
            Duration::from_secs(3),
        )
    }

    pub async fn run(&self, context: ValidationContext) -> PackagePreflightSummary {
        let timeout = self.timeout;
        let tasks = self.validators.iter().map(|validator| {
            let validator = Arc::clone(validator);
            let context = context.clone();
            async move {
                let validator_id = validator.id().to_string();
                let validator_name = validator.name().to_string();
                match tokio::time::timeout(timeout, validator.validate(context)).await {
                    Ok(results) => results,
                    Err(_) => vec![PackageValidationResult {
                        validator_id,
                        validator_name,
                        status: ValidationStatus::Warning,
                        summary: "Validation timed out before completion.".to_string(),
                        details: vec![
                            "The validator exceeded the configured 3 second timeout.".to_string()
                        ],
                        remediation: Some(
                            "Retry the operation or proceed if you trust the current environment."
                                .to_string(),
                        ),
                        package: None,
                        provider_id: None,
                        blocking: false,
                        timed_out: true,
                    }],
                }
            }
        });

        let results = join_all(tasks)
            .await
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();
        let has_warnings = results
            .iter()
            .any(|r| matches!(r.status, ValidationStatus::Warning));
        let has_failures = results
            .iter()
            .any(|r| matches!(r.status, ValidationStatus::Failure));
        let can_proceed = !results
            .iter()
            .any(|r| matches!(r.status, ValidationStatus::Failure) && r.blocking);

        PackagePreflightSummary {
            results,
            can_proceed,
            has_warnings,
            has_failures,
            checked_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

pub struct ProviderHealthValidator;
pub struct DiskSpaceValidator;
pub struct PermissionValidator;
pub struct DependencyValidator;

fn unique_provider_ids(packages: &[ValidationPackageSpec]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut providers = Vec::new();
    for provider_id in packages
        .iter()
        .filter_map(|package| package.provider_id.as_ref())
    {
        if seen.insert(provider_id.clone()) {
            providers.push(provider_id.clone());
        }
    }
    providers
}

fn choose_validation_version(info: &crate::provider::PackageInfo) -> Option<String> {
    info.versions
        .iter()
        .filter_map(|version| version.version.parse::<Version>().ok())
        .max()
        .map(|version| version.to_string())
        .or_else(|| info.versions.first().map(|version| version.version.clone()))
}

async fn resolve_dependency_version(
    provider: &Arc<dyn crate::provider::Provider>,
    package: &ValidationPackageSpec,
) -> Option<String> {
    if let Some(version) = &package.version {
        return Some(version.clone());
    }
    let info = provider.get_package_info(&package.name).await.ok()?;
    choose_validation_version(&info)
}

async fn resolve_validation_path(context: &ValidationContext, provider_id: &str) -> PathBuf {
    let registry = context.registry.read().await;
    if let Some(provider) = registry.get(provider_id) {
        if let Ok(installed) = provider
            .list_installed(crate::provider::InstalledFilter {
                global_only: true,
                ..Default::default()
            })
            .await
        {
            if let Some(path) = installed
                .into_iter()
                .find_map(|package| package.install_path.parent().map(PathBuf::from))
            {
                return path;
            }
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[async_trait]
impl Validator for ProviderHealthValidator {
    fn id(&self) -> &'static str {
        "provider_health"
    }

    fn name(&self) -> &'static str {
        "Provider health"
    }

    async fn validate(&self, context: ValidationContext) -> Vec<PackageValidationResult> {
        let mut results = context
            .packages
            .iter()
            .filter(|package| package.provider_id.is_none())
            .map(|package| PackageValidationResult {
                validator_id: self.id().to_string(),
                validator_name: self.name().to_string(),
                status: ValidationStatus::Failure,
                summary: "Unable to resolve a package provider.".to_string(),
                details: vec![format!(
                    "No provider could be inferred for package spec '{}'.",
                    package.raw
                )],
                remediation: Some(
                    "Specify a provider explicitly, for example 'npm:react'.".to_string(),
                ),
                package: Some(package.raw.clone()),
                provider_id: None,
                blocking: true,
                timed_out: false,
            })
            .collect::<Vec<_>>();

        let manager = HealthCheckManager::new(context.registry.clone());
        for provider_id in unique_provider_ids(&context.packages) {
            match manager.check_package_manager(&provider_id).await {
                Ok(health) => {
                    let status = if matches!(health.status, HealthStatus::Healthy)
                        && matches!(health.scope_state, HealthScopeState::Available)
                    {
                        ValidationStatus::Pass
                    } else if matches!(health.scope_state, HealthScopeState::Available)
                        && matches!(health.status, HealthStatus::Warning)
                    {
                        ValidationStatus::Warning
                    } else {
                        ValidationStatus::Failure
                    };

                    let blocking = matches!(status, ValidationStatus::Failure);
                    let summary = match status {
                        ValidationStatus::Pass => {
                            format!("Provider '{}' is healthy.", provider_id)
                        }
                        ValidationStatus::Warning => {
                            format!("Provider '{}' reported health warnings.", provider_id)
                        }
                        ValidationStatus::Failure => {
                            format!(
                                "Provider '{}' is not ready for package operations.",
                                provider_id
                            )
                        }
                    };

                    results.push(PackageValidationResult {
                        validator_id: self.id().to_string(),
                        validator_name: self.name().to_string(),
                        status,
                        summary,
                        details: health
                            .issues
                            .into_iter()
                            .map(|issue| issue.message)
                            .collect(),
                        remediation: if blocking {
                            Some(
                                "Resolve provider availability issues before proceeding."
                                    .to_string(),
                            )
                        } else if matches!(health.status, HealthStatus::Healthy) {
                            None
                        } else {
                            Some("Review provider diagnostics before proceeding.".to_string())
                        },
                        package: None,
                        provider_id: Some(provider_id),
                        blocking,
                        timed_out: false,
                    })
                }
                Err(error) => results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: ValidationStatus::Warning,
                    summary: format!("Provider health check failed for '{}'.", provider_id),
                    details: vec![error.to_string()],
                    remediation: Some(
                        "Retry the health check or continue only if the provider is known-good."
                            .to_string(),
                    ),
                    package: None,
                    provider_id: Some(provider_id),
                    blocking: false,
                    timed_out: false,
                }),
            }
        }

        results
    }
}

#[async_trait]
impl Validator for DiskSpaceValidator {
    fn id(&self) -> &'static str {
        "disk_space"
    }

    fn name(&self) -> &'static str {
        "Disk space"
    }

    async fn validate(&self, context: ValidationContext) -> Vec<PackageValidationResult> {
        let settings = context.settings.read().await.clone();
        let required_bytes = settings
            .general
            .min_install_space_mb
            .saturating_mul(1024 * 1024);
        let mut results = Vec::new();

        for provider_id in unique_provider_ids(&context.packages) {
            let install_path = resolve_validation_path(&context, &provider_id).await;
            match disk::get_disk_space(&install_path).await {
                Ok(space) if space.available < required_bytes => results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: ValidationStatus::Failure,
                    summary: format!("Available disk space for '{}' is below the configured minimum.", provider_id),
                    details: vec![format!(
                        "Path '{}' has {} free, but the configured minimum is {}.",
                        install_path.display(),
                        disk::format_size(space.available),
                        disk::format_size(required_bytes)
                    )],
                    remediation: Some("Free disk space or lower the minimum install space setting before retrying.".to_string()),
                    package: None,
                    provider_id: Some(provider_id),
                    blocking: true,
                    timed_out: false,
                }),
                Ok(space) => results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: ValidationStatus::Pass,
                    summary: format!("Disk space for '{}' satisfies the configured minimum.", provider_id),
                    details: vec![format!(
                        "Path '{}' has {} free and the minimum is {}.",
                        install_path.display(),
                        disk::format_size(space.available),
                        disk::format_size(required_bytes)
                    )],
                    remediation: None,
                    package: None,
                    provider_id: Some(provider_id),
                    blocking: false,
                    timed_out: false,
                }),
                Err(error) => results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: ValidationStatus::Warning,
                    summary: format!("Unable to verify disk space for '{}'.", provider_id),
                    details: vec![error.to_string()],
                    remediation: Some("Retry the operation after confirming free space manually.".to_string()),
                    package: None,
                    provider_id: Some(provider_id),
                    blocking: false,
                    timed_out: false,
                }),
            }
        }

        results
    }
}

#[async_trait]
impl Validator for PermissionValidator {
    fn id(&self) -> &'static str {
        "permission"
    }

    fn name(&self) -> &'static str {
        "Permissions"
    }

    async fn validate(&self, context: ValidationContext) -> Vec<PackageValidationResult> {
        let registry = context.registry.read().await;
        let mut results = Vec::new();

        for provider_id in unique_provider_ids(&context.packages) {
            if let Some(provider) = registry.get_system_provider(&provider_id) {
                let requires_elevation = provider.requires_elevation("install");
                results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: if requires_elevation {
                        ValidationStatus::Warning
                    } else {
                        ValidationStatus::Pass
                    },
                    summary: if requires_elevation {
                        format!(
                            "Installing with '{}' may require elevated privileges.",
                            provider_id
                        )
                    } else {
                        format!(
                            "'{}' install operations do not require elevation.",
                            provider_id
                        )
                    },
                    details: if requires_elevation {
                        vec![if matches!(current_platform(), Platform::Windows) {
                            "The provider may need administrator privileges during install."
                                .to_string()
                        } else {
                            "The provider may need sudo privileges during install.".to_string()
                        }]
                    } else {
                        Vec::new()
                    },
                    remediation: if requires_elevation {
                        Some(if matches!(current_platform(), Platform::Windows) {
                            "Run CogniaLauncher with administrator privileges before retrying."
                                .to_string()
                        } else {
                            "Retry from a session that can prompt for sudo privileges.".to_string()
                        })
                    } else {
                        None
                    },
                    package: None,
                    provider_id: Some(provider_id),
                    blocking: false,
                    timed_out: false,
                });
            }
        }

        results
    }
}

#[async_trait]
impl Validator for DependencyValidator {
    fn id(&self) -> &'static str {
        "dependency"
    }

    fn name(&self) -> &'static str {
        "Dependencies"
    }

    async fn validate(&self, context: ValidationContext) -> Vec<PackageValidationResult> {
        let registry = context.registry.read().await;
        let mut results = Vec::new();

        for package in &context.packages {
            let Some(provider_id) = package.provider_id.clone() else {
                continue;
            };
            let Some(provider) = registry.get(&provider_id) else {
                continue;
            };
            let Some(version) = resolve_dependency_version(&provider, package).await else {
                results.push(PackageValidationResult {
                    validator_id: self.id().to_string(),
                    validator_name: self.name().to_string(),
                    status: ValidationStatus::Warning,
                    summary: format!("Dependency metadata is unavailable for '{}'.", package.name),
                    details: vec![
                        "A version could not be resolved for dependency analysis.".to_string()
                    ],
                    remediation: Some(
                        "Install the package directly or specify an explicit version.".to_string(),
                    ),
                    package: Some(package.name.clone()),
                    provider_id: Some(provider_id),
                    blocking: false,
                    timed_out: false,
                });
                continue;
            };

            let dependencies = match provider.get_dependencies(&package.name, &version).await {
                Ok(dependencies) => dependencies,
                Err(error) => {
                    results.push(PackageValidationResult {
                        validator_id: self.id().to_string(),
                        validator_name: self.name().to_string(),
                        status: ValidationStatus::Warning,
                        summary: format!("Failed to inspect dependencies for '{}'.", package.name),
                        details: vec![error.to_string()],
                        remediation: Some("Retry with a concrete version or continue if the provider resolves dependencies during install.".to_string()),
                        package: Some(package.name.clone()),
                        provider_id: Some(provider_id),
                        blocking: false,
                        timed_out: false,
                    });
                    continue;
                }
            };

            let mut findings = Vec::new();
            for dependency in dependencies {
                match provider.get_installed_version(&dependency.name).await {
                    Ok(Some(installed_version)) => match installed_version.parse::<Version>() {
                        Ok(version) if dependency.constraint.matches(&version) => {}
                        Ok(version) => findings.push(format!(
                            "{} {} is installed, but {} is required.",
                            dependency.name, version, dependency.constraint
                        )),
                        Err(_) => findings.push(format!(
                            "{} is installed as '{}', but the version could not be validated against {}.",
                            dependency.name, installed_version, dependency.constraint
                        )),
                    },
                    Ok(None) => findings.push(format!(
                        "{} is missing and must satisfy {}.",
                        dependency.name, dependency.constraint
                    )),
                    Err(error) => findings.push(format!(
                        "Failed to inspect dependency '{}': {}",
                        dependency.name, error
                    )),
                }
            }

            let has_findings = !findings.is_empty();
            results.push(PackageValidationResult {
                validator_id: self.id().to_string(),
                validator_name: self.name().to_string(),
                status: if has_findings {
                    ValidationStatus::Warning
                } else {
                    ValidationStatus::Pass
                },
                summary: if has_findings {
                    format!(
                        "Some dependencies for '{}' are not currently satisfied.",
                        package.name
                    )
                } else {
                    format!(
                        "Declared dependencies for '{}' are already satisfied.",
                        package.name
                    )
                },
                details: findings,
                remediation: if has_findings {
                    Some(
                        "Install or update the missing dependencies alongside the target package."
                            .to_string(),
                    )
                } else {
                    None
                },
                package: Some(package.name.clone()),
                provider_id: Some(provider_id),
                blocking: false,
                timed_out: false,
            });
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use crate::error::CogniaResult;
    use crate::provider::{
        Capability, InstallReceipt, InstallRequest, InstalledFilter, InstalledPackage, PackageInfo,
        PackageSummary, Provider, ProviderRegistry, SearchOptions, SystemPackageProvider,
        UninstallRequest, UpdateInfo, VersionInfo,
    };
    use crate::resolver::{Dependency, VersionConstraint};
    use std::collections::{HashMap, HashSet};
    use std::path::{Path, PathBuf};
    use tokio::sync::RwLock;

    #[derive(Clone)]
    struct MockSystemProvider {
        id: String,
        available: bool,
        requires_elevation: bool,
        installed_versions: HashMap<String, String>,
        package_versions: HashMap<String, Vec<VersionInfo>>,
        dependencies: HashMap<String, Vec<Dependency>>,
    }

    impl MockSystemProvider {
        fn new(id: &str) -> Self {
            Self {
                id: id.to_string(),
                available: true,
                requires_elevation: false,
                installed_versions: HashMap::new(),
                package_versions: HashMap::new(),
                dependencies: HashMap::new(),
            }
        }
    }

    #[async_trait]
    impl Provider for MockSystemProvider {
        fn id(&self) -> &str {
            &self.id
        }
        fn display_name(&self) -> &str {
            &self.id
        }
        fn capabilities(&self) -> HashSet<Capability> {
            HashSet::from([Capability::Install, Capability::Search, Capability::List])
        }
        fn supported_platforms(&self) -> Vec<Platform> {
            vec![current_platform()]
        }
        async fn is_available(&self) -> bool {
            self.available
        }

        async fn search(
            &self,
            query: &str,
            _options: SearchOptions,
        ) -> CogniaResult<Vec<PackageSummary>> {
            Ok(vec![PackageSummary {
                name: query.to_string(),
                description: Some("mock package".to_string()),
                latest_version: Some("1.0.0".to_string()),
                provider: self.id.clone(),
            }])
        }

        async fn get_package_info(&self, name: &str) -> CogniaResult<PackageInfo> {
            Ok(PackageInfo {
                name: name.to_string(),
                display_name: Some(name.to_string()),
                description: Some("mock package".to_string()),
                homepage: None,
                license: None,
                repository: None,
                versions: self.package_versions.get(name).cloned().unwrap_or_else(|| {
                    vec![VersionInfo {
                        version: "1.0.0".to_string(),
                        release_date: None,
                        deprecated: false,
                        yanked: false,
                    }]
                }),
                provider: self.id.clone(),
            })
        }

        async fn get_versions(&self, name: &str) -> CogniaResult<Vec<VersionInfo>> {
            Ok(self.package_versions.get(name).cloned().unwrap_or_default())
        }

        async fn get_dependencies(
            &self,
            name: &str,
            _version: &str,
        ) -> CogniaResult<Vec<Dependency>> {
            Ok(self.dependencies.get(name).cloned().unwrap_or_default())
        }

        async fn install(&self, request: InstallRequest) -> CogniaResult<InstallReceipt> {
            Ok(InstallReceipt {
                name: request.name,
                version: request.version.unwrap_or_else(|| "1.0.0".to_string()),
                provider: self.id.clone(),
                install_path: PathBuf::from("."),
                files: Vec::new(),
                installed_at: chrono::Utc::now().to_rfc3339(),
            })
        }

        async fn get_installed_version(&self, name: &str) -> CogniaResult<Option<String>> {
            Ok(self.installed_versions.get(name).cloned())
        }

        async fn uninstall(&self, _request: UninstallRequest) -> CogniaResult<()> {
            Ok(())
        }

        async fn list_installed(
            &self,
            _filter: InstalledFilter,
        ) -> CogniaResult<Vec<InstalledPackage>> {
            Ok(self
                .installed_versions
                .iter()
                .map(|(name, version)| InstalledPackage {
                    name: name.clone(),
                    version: version.clone(),
                    provider: self.id.clone(),
                    install_path: PathBuf::from("."),
                    installed_at: chrono::Utc::now().to_rfc3339(),
                    is_global: true,
                })
                .collect())
        }

        async fn check_updates(&self, _packages: &[String]) -> CogniaResult<Vec<UpdateInfo>> {
            Ok(Vec::new())
        }
    }

    #[async_trait]
    impl SystemPackageProvider for MockSystemProvider {
        async fn check_system_requirements(&self) -> CogniaResult<bool> {
            Ok(true)
        }
        fn requires_elevation(&self, _operation: &str) -> bool {
            self.requires_elevation
        }
        async fn get_version(&self) -> CogniaResult<String> {
            Ok("1.0.0".to_string())
        }
        async fn get_executable_path(&self) -> CogniaResult<PathBuf> {
            Ok(Path::new(".").to_path_buf())
        }
        async fn is_package_installed(&self, name: &str) -> CogniaResult<bool> {
            Ok(self.installed_versions.contains_key(name))
        }
    }

    struct SlowValidator;

    #[async_trait]
    impl Validator for SlowValidator {
        fn id(&self) -> &'static str {
            "slow"
        }
        fn name(&self) -> &'static str {
            "Slow"
        }
        async fn validate(&self, _context: ValidationContext) -> Vec<PackageValidationResult> {
            tokio::time::sleep(Duration::from_millis(25)).await;
            Vec::new()
        }
    }

    fn shared_context_with_provider(provider: MockSystemProvider) -> ValidationContext {
        let mut registry = ProviderRegistry::new();
        registry.register_system_provider(Arc::new(provider));
        ValidationContext {
            packages: vec![ValidationPackageSpec {
                raw: "mockpkg:react".to_string(),
                provider_id: Some("mockpkg".to_string()),
                name: "react".to_string(),
                version: Some("1.0.0".to_string()),
            }],
            registry: Arc::new(RwLock::new(registry)),
            settings: Arc::new(RwLock::new(Settings::default())),
        }
    }

    #[test]
    fn parse_package_spec_keeps_scoped_names_and_extracts_provider() {
        let parsed = parse_package_spec("npm:@types/react@19.0.0");
        assert_eq!(parsed.provider_id.as_deref(), Some("npm"));
        assert_eq!(parsed.name, "@types/react");
        assert_eq!(parsed.version.as_deref(), Some("19.0.0"));
    }

    #[tokio::test]
    async fn validator_chain_downgrades_timeouts_to_warnings() {
        let context = ValidationContext {
            packages: Vec::new(),
            registry: Arc::new(RwLock::new(ProviderRegistry::new())),
            settings: Arc::new(RwLock::new(Settings::default())),
        };
        let chain = ValidatorChain::new(vec![Arc::new(SlowValidator)], Duration::from_millis(5));
        let summary = chain.run(context).await;

        assert!(summary.can_proceed);
        assert!(summary.has_warnings);
        assert_eq!(summary.results.len(), 1);
        assert!(summary.results[0].timed_out);
    }

    #[tokio::test]
    async fn permission_validator_warns_when_install_requires_elevation() {
        let mut provider = MockSystemProvider::new("mockpkg");
        provider.requires_elevation = true;
        let results = PermissionValidator
            .validate(shared_context_with_provider(provider))
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, ValidationStatus::Warning);
        assert!(results[0].summary.contains("elevated privileges"));
    }

    #[tokio::test]
    async fn disk_space_validator_fails_when_below_minimum_threshold() {
        let context = shared_context_with_provider(MockSystemProvider::new("mockpkg"));
        {
            let mut settings = context.settings.write().await;
            settings.general.min_install_space_mb = 1_000_000_000;
        }
        let results = DiskSpaceValidator.validate(context).await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, ValidationStatus::Failure);
        assert!(results[0].blocking);
    }

    #[tokio::test]
    async fn provider_health_validator_blocks_unavailable_provider() {
        let mut provider = MockSystemProvider::new("mockpkg");
        provider.available = false;

        let results = ProviderHealthValidator
            .validate(shared_context_with_provider(provider))
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, ValidationStatus::Failure);
        assert!(results[0].blocking);
    }

    #[tokio::test]
    async fn dependency_validator_reports_missing_dependencies() {
        let mut provider = MockSystemProvider::new("mockpkg");
        provider.package_versions.insert(
            "react".to_string(),
            vec![VersionInfo {
                version: "1.0.0".to_string(),
                release_date: None,
                deprecated: false,
                yanked: false,
            }],
        );
        provider.dependencies.insert(
            "react".to_string(),
            vec![Dependency {
                name: "scheduler".to_string(),
                constraint: VersionConstraint::GreaterThanOrEqual("1.0.0".parse().unwrap()),
            }],
        );

        let results = DependencyValidator
            .validate(shared_context_with_provider(provider))
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, ValidationStatus::Warning);
        assert!(results[0].details[0].contains("scheduler"));
    }
}
