use crate::config::Settings;
use crate::core::{
    BatchInstallRequest, BatchManager, BatchProgress, BatchResult, HistoryAction, HistoryManager,
    HistoryQuery, PackageSpec,
};
use crate::platform::current_platform;
use crate::provider::support::{
    provider_unavailable_reason, update_support_reason, SupportReason,
    REASON_INSTALLED_PACKAGE_ENUMERATION_FAILED, REASON_NATIVE_UPDATE_FAILED,
    REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK, REASON_NO_MATCHING_INSTALLED_PACKAGES,
    SUPPORT_STATUS_ERROR, SUPPORT_STATUS_PARTIAL, SUPPORT_STATUS_SUPPORTED, SUPPORT_STATUS_UNSUPPORTED,
};
use crate::provider::ProviderRegistry;
use crate::resolver::{Dependency, Package, Resolver, Version, VersionConstraint};
use futures::future::{join_all, BoxFuture};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;

/// Emit batch progress events to the frontend
fn emit_batch_progress(app_handle: &AppHandle, progress: &BatchProgress) {
    let _ = app_handle.emit("batch-progress", progress);
}

fn parse_package_scope_key(raw: &str) -> (Option<&str>, &str) {
    if let Some((provider, name)) = raw.split_once(':') {
        if !provider.is_empty() && !provider.contains('@') {
            return (Some(provider), name);
        }
    }

    (None, raw)
}

/// Batch install packages with progress tracking
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn batch_install(
    packages: Vec<String>,
    dry_run: Option<bool>,
    parallel: Option<bool>,
    force: Option<bool>,
    global: Option<bool>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<BatchResult, String> {
    let settings_ref = settings.inner().clone();
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    let request = BatchInstallRequest {
        packages,
        dry_run: dry_run.unwrap_or(false),
        parallel: parallel.unwrap_or(true),
        force: force.unwrap_or(false),
        global: global.unwrap_or(true),
    };

    let result = manager
        .batch_install(request, |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate package caches after successful batch install
    crate::commands::package::invalidate_package_caches(&settings_ref).await;

    Ok(result)
}

/// Batch uninstall packages
#[tauri::command]
pub async fn batch_uninstall(
    packages: Vec<String>,
    force: Option<bool>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<BatchResult, String> {
    let settings_ref = settings.inner().clone();
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    let result = manager
        .batch_uninstall(packages, force.unwrap_or(false), |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate package caches after successful batch uninstall
    crate::commands::package::invalidate_package_caches(&settings_ref).await;

    Ok(result)
}

/// Batch update packages
#[tauri::command]
pub async fn batch_update(
    packages: Option<Vec<String>>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<BatchResult, String> {
    let settings_ref = settings.inner().clone();
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    let result = manager
        .batch_update(packages, |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate package caches after successful batch update
    crate::commands::package::invalidate_package_caches(&settings_ref).await;

    Ok(result)
}

/// Resolve dependencies for a list of packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyNode {
    pub name: String,
    pub version: String,
    pub constraint: String,
    pub provider: Option<String>,
    pub dependencies: Vec<DependencyNode>,
    pub is_direct: bool,
    pub is_installed: bool,
    pub is_conflict: bool,
    pub conflict_reason: Option<String>,
    pub depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionResult {
    pub packages: Vec<ResolvedPackage>,
    pub tree: Vec<DependencyNode>,
    pub conflicts: Vec<ConflictInfo>,
    pub success: bool,
    pub install_order: Vec<String>,
    pub total_packages: usize,
    pub total_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedPackage {
    pub name: String,
    pub version: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub package: String,
    pub required_versions: Vec<RequiredVersion>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequiredVersion {
    pub required_by: String,
    pub constraint: String,
}

#[tauri::command]
pub async fn resolve_dependencies(
    packages: Vec<String>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<ResolutionResult, String> {
    let reg = registry.read().await;

    let specs: Vec<PackageSpec> = packages.iter().map(|p| PackageSpec::parse(p)).collect();
    let deps: Vec<Dependency> = specs
        .iter()
        .map(|spec| Dependency {
            name: spec.name.clone(),
            constraint: spec
                .version
                .as_ref()
                .map(|v| {
                    v.parse::<VersionConstraint>()
                        .unwrap_or(VersionConstraint::Any)
                })
                .unwrap_or(VersionConstraint::Any),
        })
        .collect();

    // Create resolver and add available packages
    let mut resolver = Resolver::new();

    // Track which provider provides each package
    let mut package_providers: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    // Collect installed packages for comparison (prefer cached data)
    let mut installed_packages: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    // Try MetadataCache first (written by package_list)
    let mut used_cache = false;
    {
        let cache_dir = settings.read().await.get_cache_dir();
        if let Ok(mut cache) = crate::cache::MetadataCache::open_with_ttl(&cache_dir, 60).await {
            if let Ok(Some(cached)) = cache
                .get::<Vec<crate::provider::InstalledPackage>>("pkg:installed:all")
                .await
            {
                if !cached.is_stale {
                    for pkg in cached.data {
                        installed_packages.insert(pkg.name.to_lowercase(), pkg.version);
                    }
                    used_cache = true;
                }
            }
        }
    }

    // Fallback: live scan
    if !used_cache {
        for provider_id in reg.list() {
            if let Some(provider) = reg.get(provider_id) {
                if provider.is_available().await {
                    if let Ok(installed) = provider
                        .list_installed(crate::provider::InstalledFilter::default())
                        .await
                    {
                        for pkg in installed {
                            installed_packages.insert(pkg.name.to_lowercase(), pkg.version);
                        }
                    }
                }
            }
        }
    }

    let provider_ids: Vec<String> = reg.list().iter().map(|id| id.to_string()).collect();
    let mut queue: std::collections::VecDeque<(String, Option<String>)> = specs
        .iter()
        .map(|spec| (spec.name.clone(), spec.provider.clone()))
        .collect();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    while let Some((name, provider_hint)) = queue.pop_front() {
        if !seen.insert(name.clone()) {
            continue;
        }

        let providers_to_check: Vec<String> = if let Some(provider) = provider_hint.clone() {
            vec![provider]
        } else {
            provider_ids.clone()
        };

        for provider_id in providers_to_check {
            if let Some(provider) = reg.get(&provider_id) {
                if provider.is_available().await {
                    if let Ok(versions) = provider.get_versions(&name).await {
                        if !versions.is_empty() {
                            package_providers
                                .entry(name.clone())
                                .or_insert_with(|| provider_id.to_string());
                        }
                        for v in versions {
                            if let Ok(version) = v.version.parse::<Version>() {
                                let dependencies = provider
                                    .get_dependencies(&name, &v.version)
                                    .await
                                    .unwrap_or_default();

                                for dep in &dependencies {
                                    if !seen.contains(&dep.name) {
                                        queue.push_back((dep.name.clone(), None));
                                    }
                                }

                                let pkg = Package {
                                    name: name.clone(),
                                    version,
                                    dependencies,
                                };
                                resolver.add_package(pkg);
                            }
                        }
                    }
                }
            }
        }
    }

    // Resolve
    match resolver.resolve(&deps) {
        Ok(resolution) => {
            let resolved_packages: Vec<ResolvedPackage> = resolution
                .iter()
                .map(|(name, version)| ResolvedPackage {
                    name: name.clone(),
                    version: version.to_string(),
                    provider: package_providers.get(name).cloned().unwrap_or_default(),
                })
                .collect();

            fn build_node<'a>(
                dep: Dependency,
                resolution: &'a crate::resolver::Resolution,
                providers: &'a std::collections::HashMap<String, String>,
                installed: &'a std::collections::HashMap<String, String>,
                registry: &'a ProviderRegistry,
                depth: usize,
            ) -> BoxFuture<'a, DependencyNode> {
                Box::pin(async move {
                    let name_lower = dep.name.to_lowercase();
                    let resolved_version = resolution
                        .get(&dep.name)
                        .map(|v| v.to_string())
                        .unwrap_or_default();
                    let is_installed = installed.contains_key(&name_lower);
                    let provider_id = providers.get(&dep.name).cloned();

                    let child_nodes = if let Some(ref provider_id) = provider_id {
                        if let Some(provider) = registry.get(provider_id) {
                            if let Ok(dependencies) = provider
                                .get_dependencies(&dep.name, &resolved_version)
                                .await
                            {
                                let futures = dependencies.into_iter().map(|child| {
                                    build_node(
                                        child,
                                        resolution,
                                        providers,
                                        installed,
                                        registry,
                                        depth + 1,
                                    )
                                });
                                join_all(futures).await
                            } else {
                                vec![]
                            }
                        } else {
                            vec![]
                        }
                    } else {
                        vec![]
                    };

                    DependencyNode {
                        name: dep.name,
                        version: resolved_version,
                        constraint: dep.constraint.to_string(),
                        provider: provider_id,
                        dependencies: child_nodes,
                        is_direct: depth == 0,
                        is_installed,
                        is_conflict: false,
                        conflict_reason: None,
                        depth,
                    }
                })
            }

            let tree_futures = deps.iter().cloned().map(|dep| {
                build_node(
                    dep,
                    &resolution,
                    &package_providers,
                    &installed_packages,
                    &reg,
                    0,
                )
            });
            let tree: Vec<DependencyNode> = join_all(tree_futures).await;

            // Calculate install order (packages not yet installed)
            let install_order: Vec<String> = resolved_packages
                .iter()
                .filter(|p| !installed_packages.contains_key(&p.name.to_lowercase()))
                .map(|p| p.name.clone())
                .collect();

            let total_packages = resolved_packages.len();

            Ok(ResolutionResult {
                packages: resolved_packages,
                tree,
                conflicts: vec![],
                success: true,
                install_order,
                total_packages,
                total_size: None,
            })
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Progress events for update checking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckProgress {
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub current_package: Option<String>,
    pub current_provider: Option<String>,
    pub found_updates: usize,
    pub errors: usize,
}

/// Check for available updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub provider: String,
    pub update_type: String, // "major", "minor", "patch"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckSummary {
    pub updates: Vec<UpdateCheckResult>,
    pub total_checked: usize,
    pub total_providers: usize,
    pub errors: Vec<UpdateCheckError>,
    pub provider_outcomes: Vec<UpdateCheckProviderOutcome>,
    pub coverage: UpdateCheckCoverage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckError {
    pub provider: String,
    pub package: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckProviderOutcome {
    pub provider: String,
    pub status: String, // supported | partial | unsupported | error
    pub reason: Option<String>,
    pub reason_code: Option<String>,
    pub checked: usize,
    pub updates: usize,
    pub errors: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateCheckCoverage {
    pub supported: usize,
    pub partial: usize,
    pub unsupported: usize,
    pub error: usize,
}

const UPDATE_OUTCOME_SUPPORTED: &str = SUPPORT_STATUS_SUPPORTED;
const UPDATE_OUTCOME_PARTIAL: &str = SUPPORT_STATUS_PARTIAL;
const UPDATE_OUTCOME_UNSUPPORTED: &str = SUPPORT_STATUS_UNSUPPORTED;
const UPDATE_OUTCOME_ERROR: &str = SUPPORT_STATUS_ERROR;

fn classify_update_type(current: &str, latest: &str) -> String {
    match (current.parse::<Version>(), latest.parse::<Version>()) {
        (Ok(current_ver), Ok(latest_ver)) if latest_ver > current_ver => {
            if latest_ver.major > current_ver.major {
                "major".into()
            } else if latest_ver.minor > current_ver.minor {
                "minor".into()
            } else {
                "patch".into()
            }
        }
        _ => "unknown".into(),
    }
}

fn has_newer_version(current: &str, latest: &str) -> bool {
    match (current.parse::<Version>(), latest.parse::<Version>()) {
        (Ok(current_ver), Ok(latest_ver)) => latest_ver > current_ver,
        _ => !latest.trim().eq_ignore_ascii_case(current.trim()),
    }
}

fn to_update_check_result(
    provider_id: &str,
    update: crate::provider::UpdateInfo,
) -> UpdateCheckResult {
    UpdateCheckResult {
        name: update.name,
        current_version: update.current_version.clone(),
        latest_version: update.latest_version.clone(),
        provider: if update.provider.is_empty() {
            provider_id.to_string()
        } else {
            update.provider
        },
        update_type: classify_update_type(&update.current_version, &update.latest_version),
    }
}

fn provider_unsupported_reason(
    provider: &Arc<dyn crate::provider::Provider>,
) -> Option<SupportReason> {
    let supported_platforms = provider.supported_platforms();
    let capabilities = provider.capabilities();
    update_support_reason(current_platform(), &supported_platforms, &capabilities)
}

fn summarize_coverage(outcomes: &[UpdateCheckProviderOutcome]) -> UpdateCheckCoverage {
    let mut coverage = UpdateCheckCoverage::default();
    for outcome in outcomes {
        match outcome.status.as_str() {
            UPDATE_OUTCOME_SUPPORTED => coverage.supported += 1,
            UPDATE_OUTCOME_PARTIAL => coverage.partial += 1,
            UPDATE_OUTCOME_UNSUPPORTED => coverage.unsupported += 1,
            UPDATE_OUTCOME_ERROR => coverage.error += 1,
            _ => {}
        }
    }
    coverage
}

fn normalize_provider_updates(
    provider_id: &str,
    updates: Vec<crate::provider::UpdateInfo>,
    installed_names: &std::collections::HashSet<String>,
) -> Vec<UpdateCheckResult> {
    let mut seen = std::collections::HashSet::new();
    let mut normalized = Vec::new();

    for update in updates {
        let name_key = update.name.to_ascii_lowercase();
        if !installed_names.contains(&name_key) || !seen.insert(name_key) {
            continue;
        }
        normalized.push(to_update_check_result(provider_id, update));
    }

    normalized
}

async fn fallback_check_updates_with_versions(
    provider: &Arc<dyn crate::provider::Provider>,
    provider_id: &str,
    installed_packages: &[crate::provider::InstalledPackage],
) -> (Vec<UpdateCheckResult>, Vec<UpdateCheckError>) {
    let mut seen = std::collections::HashSet::new();
    let mut updates = Vec::new();
    let mut errors = Vec::new();

    for pkg in installed_packages {
        if !seen.insert(pkg.name.to_ascii_lowercase()) {
            continue;
        }

        match provider.get_versions(&pkg.name).await {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if has_newer_version(&pkg.version, &latest.version) {
                        updates.push(UpdateCheckResult {
                            name: pkg.name.clone(),
                            current_version: pkg.version.clone(),
                            latest_version: latest.version.clone(),
                            provider: provider_id.to_string(),
                            update_type: classify_update_type(&pkg.version, &latest.version),
                        });
                    }
                }
            }
            Err(e) => {
                errors.push(UpdateCheckError {
                    provider: provider_id.to_string(),
                    package: Some(pkg.name.clone()),
                    message: format!("fallback version check failed: {}", e),
                });
            }
        }
    }

    (updates, errors)
}

fn emit_update_check_progress(app_handle: &AppHandle, progress: &UpdateCheckProgress) {
    let _ = app_handle.emit("update-check-progress", progress);
}

#[tauri::command]
pub async fn check_updates(
    packages: Option<Vec<String>>,
    concurrency: Option<usize>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<UpdateCheckSummary, String> {
    use futures::stream::{self, StreamExt};
    use std::sync::atomic::{AtomicUsize, Ordering};

    let max_concurrent = {
        let s = settings.read().await;
        concurrency
            .unwrap_or(s.general.update_check_concurrency as usize)
            .clamp(1, 32)
    };

    let package_filter: Option<std::collections::HashSet<String>> = packages.map(|items| {
        items
            .into_iter()
            .map(|name| name.to_ascii_lowercase())
            .collect()
    });

    let reg = registry.read().await;

    // Phase 1: Collect available providers in parallel
    emit_update_check_progress(
        &app_handle,
        &UpdateCheckProgress {
            phase: "collecting".into(),
            current: 0,
            total: 0,
            current_package: None,
            current_provider: None,
            found_updates: 0,
            errors: 0,
        },
    );

    let provider_ids: Vec<String> = reg.list().iter().map(|id| id.to_string()).collect();

    let providers: Vec<(String, Arc<dyn crate::provider::Provider>)> = provider_ids
        .iter()
        .filter_map(|id| reg.get(id).map(|provider| (id.clone(), provider)))
        .collect();
    drop(reg);

    let total_providers = providers.len();
    if total_providers == 0 {
        emit_update_check_progress(
            &app_handle,
            &UpdateCheckProgress {
                phase: "done".into(),
                current: 0,
                total: 0,
                current_package: None,
                current_provider: None,
                found_updates: 0,
                errors: 0,
            },
        );

        return Ok(UpdateCheckSummary {
            updates: Vec::new(),
            total_checked: 0,
            total_providers: 0,
            errors: Vec::new(),
            provider_outcomes: Vec::new(),
            coverage: UpdateCheckCoverage::default(),
        });
    }

    // Try MetadataCache first (written by package_list), fallback to live per provider scan
    let mut installed_by_provider: std::collections::HashMap<
        String,
        Vec<crate::provider::InstalledPackage>,
    > = std::collections::HashMap::new();

    let mut used_cache = false;
    {
        let cache_dir = settings.read().await.get_cache_dir();
        if let Ok(mut cache) = crate::cache::MetadataCache::open_with_ttl(&cache_dir, 60).await {
            if let Ok(Some(cached)) = cache
                .get::<Vec<crate::provider::InstalledPackage>>("pkg:installed:all")
                .await
            {
                if !cached.is_stale {
                    let provider_set: std::collections::HashSet<&str> =
                        provider_ids.iter().map(|id| id.as_str()).collect();
                    for pkg in cached.data {
                        if !provider_set.contains(pkg.provider.as_str()) {
                            continue;
                        }
                        if let Some(ref filter) = package_filter {
                            if !filter.contains(&pkg.name.to_ascii_lowercase()) {
                                continue;
                            }
                        }
                        installed_by_provider
                            .entry(pkg.provider.clone())
                            .or_default()
                            .push(pkg);
                    }
                    used_cache = true;
                }
            }
        }
    }

    let installed_by_provider = Arc::new(installed_by_provider);
    let found_updates = Arc::new(AtomicUsize::new(0));
    let error_count = Arc::new(AtomicUsize::new(0));
    let checked_count = Arc::new(AtomicUsize::new(0));
    let processed_providers = Arc::new(AtomicUsize::new(0));

    emit_update_check_progress(
        &app_handle,
        &UpdateCheckProgress {
            phase: "checking".into(),
            current: 0,
            total: total_providers,
            current_package: None,
            current_provider: None,
            found_updates: 0,
            errors: 0,
        },
    );

    // Phase 2/3: Run provider-native update checks in parallel, with metadata fallback on failure.
    let updates = Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let errors = Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let outcomes = Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let package_filter = Arc::new(package_filter);
    let providers = Arc::new(providers);

    stream::iter(providers.iter().cloned())
        .for_each_concurrent(max_concurrent, |(provider_id, provider)| {
            let app_handle = &app_handle;
            let updates = Arc::clone(&updates);
            let errors = Arc::clone(&errors);
            let outcomes = Arc::clone(&outcomes);
            let package_filter = Arc::clone(&package_filter);
            let installed_by_provider = Arc::clone(&installed_by_provider);
            let found_updates = Arc::clone(&found_updates);
            let error_count = Arc::clone(&error_count);
            let checked_count = Arc::clone(&checked_count);
            let processed_providers = Arc::clone(&processed_providers);
            let provider_total = total_providers;
            let use_cache = used_cache;

            async move {
                if let Some(reason) = provider_unsupported_reason(&provider) {
                    outcomes.lock().await.push(UpdateCheckProviderOutcome {
                        provider: provider_id.clone(),
                        status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                        reason: Some(reason.message),
                        reason_code: Some(reason.code.into()),
                        checked: 0,
                        updates: 0,
                        errors: 0,
                    });
                } else if !provider.is_available().await {
                    let reason = provider_unavailable_reason();
                    outcomes.lock().await.push(UpdateCheckProviderOutcome {
                        provider: provider_id.clone(),
                        status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                        reason: Some(reason.message),
                        reason_code: Some(reason.code.into()),
                        checked: 0,
                        updates: 0,
                        errors: 0,
                    });
                } else {
                    let mut installed = if use_cache {
                        installed_by_provider
                            .get(&provider_id)
                            .cloned()
                            .unwrap_or_default()
                    } else {
                        match provider
                            .list_installed(crate::provider::InstalledFilter::default())
                            .await
                        {
                            Ok(values) => values,
                            Err(e) => {
                                let error = UpdateCheckError {
                                    provider: provider_id.clone(),
                                    package: None,
                                    message: format!("failed to list installed packages: {}", e),
                                };
                                error_count.fetch_add(1, Ordering::Relaxed);
                                errors.lock().await.push(error);
                                outcomes.lock().await.push(UpdateCheckProviderOutcome {
                                    provider: provider_id.clone(),
                                    status: UPDATE_OUTCOME_ERROR.into(),
                                    reason: Some(
                                        "failed to enumerate installed packages".to_string(),
                                    ),
                                    reason_code: Some(
                                        REASON_INSTALLED_PACKAGE_ENUMERATION_FAILED.to_string(),
                                    ),
                                    checked: 0,
                                    updates: 0,
                                    errors: 1,
                                });
                                let processed =
                                    processed_providers.fetch_add(1, Ordering::Relaxed) + 1;
                                emit_update_check_progress(
                                    app_handle,
                                    &UpdateCheckProgress {
                                        phase: "checking".into(),
                                        current: processed,
                                        total: provider_total,
                                        current_package: None,
                                        current_provider: Some(provider_id.clone()),
                                        found_updates: found_updates.load(Ordering::Relaxed),
                                        errors: error_count.load(Ordering::Relaxed),
                                    },
                                );
                                return;
                            }
                        }
                    };

                    if let Some(filter) = package_filter.as_ref() {
                        installed.retain(|pkg| filter.contains(&pkg.name.to_ascii_lowercase()));
                    }

                    let mut seen_names = std::collections::HashSet::new();
                    installed.retain(|pkg| seen_names.insert(pkg.name.to_ascii_lowercase()));

                    if installed.is_empty() {
                        outcomes.lock().await.push(UpdateCheckProviderOutcome {
                            provider: provider_id.clone(),
                            status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                            reason: Some("no matching installed packages (skipped)".into()),
                            reason_code: Some(REASON_NO_MATCHING_INSTALLED_PACKAGES.into()),
                            checked: 0,
                            updates: 0,
                            errors: 0,
                        });
                    } else {
                        let checked = installed.len();
                        let package_names: Vec<String> =
                            installed.iter().map(|pkg| pkg.name.clone()).collect();
                        let installed_names: std::collections::HashSet<String> = installed
                            .iter()
                            .map(|pkg| pkg.name.to_ascii_lowercase())
                            .collect();

                        checked_count.fetch_add(checked, Ordering::Relaxed);

                        match provider.check_updates(&package_names).await {
                            Ok(native_updates) => {
                                let normalized = normalize_provider_updates(
                                    &provider_id,
                                    native_updates,
                                    &installed_names,
                                );
                                let update_count = normalized.len();
                                found_updates.fetch_add(update_count, Ordering::Relaxed);
                                updates.lock().await.extend(normalized);
                                outcomes.lock().await.push(UpdateCheckProviderOutcome {
                                    provider: provider_id.clone(),
                                    status: UPDATE_OUTCOME_SUPPORTED.into(),
                                    reason: None,
                                    reason_code: None,
                                    checked,
                                    updates: update_count,
                                    errors: 0,
                                });
                            }
                            Err(native_err) => {
                                let mut provider_errors = vec![UpdateCheckError {
                                    provider: provider_id.clone(),
                                    package: None,
                                    message: format!("native update check failed: {}", native_err),
                                }];

                                let (fallback_updates, fallback_errors) =
                                    fallback_check_updates_with_versions(
                                        &provider,
                                        &provider_id,
                                        &installed,
                                    )
                                    .await;

                                provider_errors.extend(fallback_errors);

                                let provider_error_count = provider_errors.len();
                                let fallback_count = fallback_updates.len();

                                if provider_error_count > 0 {
                                    error_count.fetch_add(provider_error_count, Ordering::Relaxed);
                                    errors.lock().await.extend(provider_errors);
                                }
                                if fallback_count > 0 {
                                    found_updates.fetch_add(fallback_count, Ordering::Relaxed);
                                    updates.lock().await.extend(fallback_updates);
                                }

                                outcomes.lock().await.push(UpdateCheckProviderOutcome {
                                    provider: provider_id.clone(),
                                    status: if fallback_count > 0 {
                                        UPDATE_OUTCOME_PARTIAL.into()
                                    } else {
                                        UPDATE_OUTCOME_ERROR.into()
                                    },
                                    reason: Some(if fallback_count > 0 {
                                        "native update check failed; metadata fallback applied"
                                            .into()
                                    } else {
                                        "native update check failed".into()
                                    }),
                                    reason_code: Some(if fallback_count > 0 {
                                        REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK.into()
                                    } else {
                                        REASON_NATIVE_UPDATE_FAILED.into()
                                    }),
                                    checked,
                                    updates: fallback_count,
                                    errors: provider_error_count,
                                });
                            }
                        }
                    }
                }

                let processed = processed_providers.fetch_add(1, Ordering::Relaxed) + 1;
                emit_update_check_progress(
                    app_handle,
                    &UpdateCheckProgress {
                        phase: "checking".into(),
                        current: processed,
                        total: provider_total,
                        current_package: None,
                        current_provider: Some(provider_id),
                        found_updates: found_updates.load(Ordering::Relaxed),
                        errors: error_count.load(Ordering::Relaxed),
                    },
                );
            }
        })
        .await;

    let final_updates = Arc::try_unwrap(updates).unwrap().into_inner();
    let final_errors = Arc::try_unwrap(errors).unwrap().into_inner();
    let final_outcomes = Arc::try_unwrap(outcomes).unwrap().into_inner();
    let total_checked = checked_count.load(Ordering::Relaxed);
    let coverage = summarize_coverage(&final_outcomes);

    let mut sorted_updates = final_updates;
    sorted_updates.sort_by(|a, b| {
        a.provider
            .cmp(&b.provider)
            .then_with(|| a.name.cmp(&b.name))
            .then_with(|| a.latest_version.cmp(&b.latest_version))
    });

    let mut sorted_errors = final_errors;
    sorted_errors.sort_by(|a, b| {
        a.provider
            .cmp(&b.provider)
            .then_with(|| a.package.cmp(&b.package))
            .then_with(|| a.message.cmp(&b.message))
    });

    let mut sorted_outcomes = final_outcomes;
    sorted_outcomes.sort_by(|a, b| a.provider.cmp(&b.provider));

    // Phase 4: Done
    emit_update_check_progress(
        &app_handle,
        &UpdateCheckProgress {
            phase: "done".into(),
            current: total_providers,
            total: total_providers,
            current_package: None,
            current_provider: None,
            found_updates: sorted_updates.len(),
            errors: sorted_errors.len(),
        },
    );

    Ok(UpdateCheckSummary {
        updates: sorted_updates,
        total_checked,
        total_providers,
        errors: sorted_errors,
        provider_outcomes: sorted_outcomes,
        coverage,
    })
}

/// Pin a package to prevent updates
#[tauri::command]
pub async fn package_pin(
    name: String,
    version: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let (provider, package_name) = parse_package_scope_key(&name);
    let scoped_key = provider
        .map(|provider_id| format!("{provider_id}:{package_name}"))
        .unwrap_or_else(|| package_name.to_string());

    let mut settings_guard = settings.write().await;
    settings_guard
        .provider_settings
        .pinned_packages
        .insert(scoped_key, version);

    if provider.is_some() {
        settings_guard
            .provider_settings
            .pinned_packages
            .remove(package_name);
    }

    // Persist settings to disk
    settings_guard.save().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Unpin a package
#[tauri::command]
pub async fn package_unpin(
    name: String,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let (provider, package_name) = parse_package_scope_key(&name);
    let scoped_key = provider
        .map(|provider_id| format!("{provider_id}:{package_name}"))
        .unwrap_or_else(|| package_name.to_string());

    let mut settings_guard = settings.write().await;
    settings_guard
        .provider_settings
        .pinned_packages
        .remove(&scoped_key);

    if provider.is_some() {
        settings_guard
            .provider_settings
            .pinned_packages
            .remove(package_name);
    }

    // Persist settings to disk
    settings_guard.save().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Get list of pinned packages
#[tauri::command]
pub async fn get_pinned_packages(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<(String, Option<String>)>, String> {
    let settings = settings.read().await;
    Ok(settings
        .provider_settings
        .pinned_packages
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect())
}

/// Rollback to a previous version
#[tauri::command]
pub async fn package_rollback(
    name: String,
    to_version: String,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let reg = registry.read().await;
    let (provider_hint, package_name) = parse_package_scope_key(&name);

    let provider = if let Some(provider_id) = provider_hint {
        reg.get(provider_id)
            .ok_or_else(|| format!("Provider not found: {}", provider_id))?
    } else {
        reg.find_for_package(package_name)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("No provider found for: {}", package_name))?
    };

    let provider_id = provider.id().to_string();

    let uninstall_result = provider
        .uninstall(crate::provider::UninstallRequest {
            name: package_name.to_string(),
            version: None,
            force: true,
        })
        .await;

    if let Err(err) = uninstall_result {
        let _ = HistoryManager::record_rollback(
            package_name,
            &to_version,
            &provider_id,
            false,
            Some(err.to_string()),
        )
        .await;
        return Err(err.to_string());
    }

    let install_result = provider
        .install(crate::provider::InstallRequest {
            name: package_name.to_string(),
            version: Some(to_version.clone()),
            global: true,
            force: true,
        })
        .await;

    match install_result {
        Ok(_) => {
            let _ = HistoryManager::record_rollback(
                package_name,
                &to_version,
                &provider_id,
                true,
                None,
            )
            .await;
            // Invalidate package caches after successful rollback
            crate::commands::package::invalidate_package_caches(settings.inner()).await;
            Ok(())
        }
        Err(err) => {
            let _ = HistoryManager::record_rollback(
                package_name,
                &to_version,
                &provider_id,
                false,
                Some(err.to_string()),
            )
            .await;
            Err(err.to_string())
        }
    }
}

/// Get package installation history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallHistoryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub action: String,
    pub timestamp: String,
    pub provider: String,
    pub success: bool,
    pub error_message: Option<String>,
}

#[tauri::command]
pub async fn get_install_history(
    limit: Option<usize>,
    provider: Option<String>,
    name: Option<String>,
    action: Option<String>,
    success: Option<bool>,
) -> Result<Vec<InstallHistoryEntry>, String> {
    let action_filter = match action {
        Some(action_value) => Some(
            action_value
                .parse::<HistoryAction>()
                .map_err(|err| err.to_string())?,
        ),
        None => None,
    };

    let entries = HistoryManager::query_history(HistoryQuery {
        limit,
        provider,
        name,
        action: action_filter,
        success,
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(to_install_history_entries(entries))
}

/// Get installation history for a specific package
#[tauri::command]
pub async fn get_package_history(
    name: String,
    limit: Option<usize>,
    provider: Option<String>,
    action: Option<String>,
    success: Option<bool>,
) -> Result<Vec<InstallHistoryEntry>, String> {
    let action_filter = match action {
        Some(action_value) => Some(
            action_value
                .parse::<HistoryAction>()
                .map_err(|err| err.to_string())?,
        ),
        None => None,
    };

    let effective_limit = Some(limit.unwrap_or(200).min(1000));

    let entries = HistoryManager::query_history(HistoryQuery {
        limit: effective_limit,
        provider,
        name: Some(name),
        action: action_filter,
        success,
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(to_install_history_entries(entries))
}

/// Clear installation history
#[tauri::command]
pub async fn clear_install_history() -> Result<(), String> {
    HistoryManager::clear_history()
        .await
        .map_err(|e| e.to_string())
}

fn to_install_history_entries(
    entries: Vec<crate::core::InstallHistoryEntry>,
) -> Vec<InstallHistoryEntry> {
    entries
        .into_iter()
        .map(|e| InstallHistoryEntry {
            id: e.id,
            name: e.name,
            version: e.version,
            action: e.action.to_string(),
            timestamp: e.timestamp,
            provider: e.provider,
            success: e.success,
            error_message: e.error_message,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_update_type_returns_semver_segments() {
        assert_eq!(classify_update_type("1.2.3", "2.0.0"), "major");
        assert_eq!(classify_update_type("1.2.3", "1.3.0"), "minor");
        assert_eq!(classify_update_type("1.2.3", "1.2.4"), "patch");
    }

    #[test]
    fn classify_update_type_returns_unknown_for_non_semver() {
        assert_eq!(classify_update_type("rolling", "nightly"), "unknown");
        assert_eq!(classify_update_type("1.2.3", "latest"), "unknown");
    }

    #[test]
    fn has_newer_version_handles_semver_and_non_semver() {
        assert!(has_newer_version("1.0.0", "1.1.0"));
        assert!(!has_newer_version("1.1.0", "1.0.0"));
        assert!(has_newer_version("stable", "nightly"));
        assert!(!has_newer_version("stable", "stable"));
    }

    #[test]
    fn summarize_coverage_counts_outcomes() {
        let outcomes = vec![
            UpdateCheckProviderOutcome {
                provider: "npm".into(),
                status: UPDATE_OUTCOME_SUPPORTED.into(),
                reason: None,
                reason_code: None,
                checked: 10,
                updates: 2,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "pip".into(),
                status: UPDATE_OUTCOME_PARTIAL.into(),
                reason: None,
                reason_code: None,
                checked: 5,
                updates: 1,
                errors: 1,
            },
            UpdateCheckProviderOutcome {
                provider: "winget".into(),
                status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                reason: Some("not available".into()),
                reason_code: Some("provider_executable_unavailable".into()),
                checked: 0,
                updates: 0,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "cargo".into(),
                status: UPDATE_OUTCOME_ERROR.into(),
                reason: Some("native failed".into()),
                reason_code: Some("native_update_check_failed".into()),
                checked: 3,
                updates: 0,
                errors: 1,
            },
        ];

        let coverage = summarize_coverage(&outcomes);
        assert_eq!(coverage.supported, 1);
        assert_eq!(coverage.partial, 1);
        assert_eq!(coverage.unsupported, 1);
        assert_eq!(coverage.error, 1);
    }

    #[test]
    fn normalize_provider_updates_filters_untracked_and_duplicates() {
        let installed = ["typescript", "eslint"]
            .into_iter()
            .map(|name| name.to_string())
            .collect::<std::collections::HashSet<_>>();
        let updates = vec![
            crate::provider::UpdateInfo {
                name: "typescript".into(),
                current_version: "5.0.0".into(),
                latest_version: "5.1.0".into(),
                provider: "npm".into(),
            },
            crate::provider::UpdateInfo {
                name: "TypeScript".into(),
                current_version: "5.0.0".into(),
                latest_version: "5.1.0".into(),
                provider: "npm".into(),
            },
            crate::provider::UpdateInfo {
                name: "unknown".into(),
                current_version: "1.0.0".into(),
                latest_version: "2.0.0".into(),
                provider: "npm".into(),
            },
        ];

        let normalized = normalize_provider_updates("npm", updates, &installed);
        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].name.to_ascii_lowercase(), "typescript");
        assert_eq!(normalized[0].provider, "npm");
    }

    #[test]
    fn summarize_coverage_handles_representative_provider_categories() {
        let outcomes = vec![
            UpdateCheckProviderOutcome {
                provider: "apt".into(),
                status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                reason: Some("provider executable is not available".into()),
                reason_code: Some("provider_executable_unavailable".into()),
                checked: 0,
                updates: 0,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "npm".into(),
                status: UPDATE_OUTCOME_SUPPORTED.into(),
                reason: None,
                reason_code: None,
                checked: 12,
                updates: 2,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "rustup".into(),
                status: UPDATE_OUTCOME_PARTIAL.into(),
                reason: Some("native update check failed; metadata fallback applied".into()),
                reason_code: Some("native_update_check_failed_with_fallback".into()),
                checked: 4,
                updates: 1,
                errors: 1,
            },
        ];

        let coverage = summarize_coverage(&outcomes);
        assert_eq!(coverage.supported, 1);
        assert_eq!(coverage.partial, 1);
        assert_eq!(coverage.unsupported, 1);
        assert_eq!(coverage.error, 0);
    }

    #[test]
    fn summarize_coverage_handles_language_matrix_semantics() {
        let outcomes = vec![
            UpdateCheckProviderOutcome {
                provider: "npm".into(),
                status: UPDATE_OUTCOME_SUPPORTED.into(),
                reason: None,
                reason_code: None,
                checked: 8,
                updates: 2,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "pip".into(),
                status: UPDATE_OUTCOME_UNSUPPORTED.into(),
                reason: Some("provider executable is not available".into()),
                reason_code: Some("provider_executable_unavailable".into()),
                checked: 0,
                updates: 0,
                errors: 0,
            },
            UpdateCheckProviderOutcome {
                provider: "cargo".into(),
                status: UPDATE_OUTCOME_PARTIAL.into(),
                reason: Some("native update check failed; metadata fallback applied".into()),
                reason_code: Some("native_update_check_failed_with_fallback".into()),
                checked: 4,
                updates: 1,
                errors: 1,
            },
        ];

        let coverage = summarize_coverage(&outcomes);
        assert_eq!(coverage.supported, 1);
        assert_eq!(coverage.partial, 1);
        assert_eq!(coverage.unsupported, 1);
        assert_eq!(coverage.error, 0);
    }

    #[test]
    fn parse_package_scope_key_extracts_provider_and_name() {
        assert_eq!(
            parse_package_scope_key("npm:typescript"),
            (Some("npm"), "typescript")
        );
        assert_eq!(parse_package_scope_key("typescript"), (None, "typescript"));
    }
}
