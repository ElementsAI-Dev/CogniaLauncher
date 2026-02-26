use crate::config::Settings;
use crate::core::{
    BatchInstallRequest, BatchManager, BatchProgress, BatchResult, HistoryManager, PackageSpec,
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
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    let request = BatchInstallRequest {
        packages,
        dry_run: dry_run.unwrap_or(false),
        parallel: parallel.unwrap_or(true),
        force: force.unwrap_or(false),
        global: global.unwrap_or(true),
    };

    manager
        .batch_install(request, |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())
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
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    manager
        .batch_uninstall(packages, force.unwrap_or(false), |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())
}

/// Batch update packages
#[tauri::command]
pub async fn batch_update(
    packages: Option<Vec<String>>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<BatchResult, String> {
    let settings = settings.read().await.clone();
    let manager = BatchManager::new(registry.inner().clone(), settings);

    manager
        .batch_update(packages, |progress| {
            emit_batch_progress(&app_handle, &progress);
        })
        .await
        .map_err(|e| e.to_string())
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

    // Collect installed packages for comparison
    let mut installed_packages: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckError {
    pub provider: String,
    pub package: Option<String>,
    pub message: String,
}

fn emit_update_check_progress(app_handle: &AppHandle, progress: &UpdateCheckProgress) {
    let _ = app_handle.emit("update-check-progress", progress);
}

#[tauri::command]
pub async fn check_updates(
    packages: Option<Vec<String>>,
    app_handle: AppHandle,
    registry: State<'_, SharedRegistry>,
) -> Result<UpdateCheckSummary, String> {
    use futures::stream::{self, StreamExt};
    use std::sync::atomic::{AtomicUsize, Ordering};

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

    // Check which providers are available in parallel
    let availability_futures: Vec<_> = provider_ids
        .iter()
        .map(|id| {
            let provider = reg.get(id);
            let id = id.clone();
            async move {
                if let Some(p) = provider {
                    if p.is_available().await {
                        return Some(id);
                    }
                }
                None
            }
        })
        .collect();
    let available_providers: Vec<String> = join_all(availability_futures)
        .await
        .into_iter()
        .flatten()
        .collect();

    // Phase 2: Collect installed packages from all available providers in parallel
    let collect_futures: Vec<_> = available_providers
        .iter()
        .map(|provider_id| {
            let provider = reg.get(provider_id);
            let provider_id = provider_id.clone();
            let packages_filter = packages.clone();
            async move {
                if let Some(p) = provider {
                    match p
                        .list_installed(crate::provider::InstalledFilter::default())
                        .await
                    {
                        Ok(installed) => {
                            let filtered: Vec<_> = installed
                                .into_iter()
                                .filter(|pkg| {
                                    if let Some(ref filter) = packages_filter {
                                        filter.iter().any(|f| f.eq_ignore_ascii_case(&pkg.name))
                                    } else {
                                        true
                                    }
                                })
                                .collect();
                            (provider_id, filtered, None)
                        }
                        Err(e) => (provider_id, vec![], Some(e.to_string())),
                    }
                } else {
                    (provider_id, vec![], Some("Provider not found".into()))
                }
            }
        })
        .collect();

    let collect_results = join_all(collect_futures).await;

    // Build a flat list of (provider_id, package_name, package_version) to check
    let mut check_items: Vec<(String, String, String)> = Vec::new();
    let mut collect_errors: Vec<UpdateCheckError> = Vec::new();
    let total_providers = available_providers.len();

    for (provider_id, installed, err) in collect_results {
        if let Some(msg) = err {
            collect_errors.push(UpdateCheckError {
                provider: provider_id,
                package: None,
                message: msg,
            });
            continue;
        }
        for pkg in installed {
            check_items.push((provider_id.clone(), pkg.name, pkg.version));
        }
    }

    let total = check_items.len();
    let found_updates = Arc::new(AtomicUsize::new(0));
    let error_count = Arc::new(AtomicUsize::new(collect_errors.len()));

    emit_update_check_progress(
        &app_handle,
        &UpdateCheckProgress {
            phase: "checking".into(),
            current: 0,
            total,
            current_package: None,
            current_provider: None,
            found_updates: 0,
            errors: collect_errors.len(),
        },
    );

    // Phase 3: Check each package for updates in parallel (buffered concurrency)
    let updates = Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let errors = Arc::new(tokio::sync::Mutex::new(collect_errors));
    let checked = Arc::new(AtomicUsize::new(0));

    let concurrency = 8; // Max parallel version checks

    stream::iter(check_items.into_iter().enumerate())
        .for_each_concurrent(
            concurrency,
            |(idx, (provider_id, pkg_name, pkg_version))| {
                let reg_ref = &reg;
                let app_handle = &app_handle;
                let updates = Arc::clone(&updates);
                let errors = Arc::clone(&errors);
                let checked = Arc::clone(&checked);
                let found_updates = Arc::clone(&found_updates);
                let error_count = Arc::clone(&error_count);

                async move {
                    emit_update_check_progress(
                        app_handle,
                        &UpdateCheckProgress {
                            phase: "checking".into(),
                            current: idx + 1,
                            total,
                            current_package: Some(pkg_name.clone()),
                            current_provider: Some(provider_id.clone()),
                            found_updates: found_updates.load(Ordering::Relaxed),
                            errors: error_count.load(Ordering::Relaxed),
                        },
                    );

                    if let Some(provider) = reg_ref.get(&provider_id) {
                        match provider.get_versions(&pkg_name).await {
                            Ok(versions) => {
                                if let Some(latest) = versions.first() {
                                    if latest.version != pkg_version {
                                        let current: Version =
                                            pkg_version.parse().unwrap_or(Version::new(0, 0, 0));
                                        let new_ver: Version =
                                            latest.version.parse().unwrap_or(Version::new(0, 0, 0));

                                        if new_ver > current {
                                            let update_type = if new_ver.major > current.major {
                                                "major"
                                            } else if new_ver.minor > current.minor {
                                                "minor"
                                            } else {
                                                "patch"
                                            };

                                            let result = UpdateCheckResult {
                                                name: pkg_name.clone(),
                                                current_version: pkg_version,
                                                latest_version: latest.version.clone(),
                                                provider: provider_id.clone(),
                                                update_type: update_type.into(),
                                            };

                                            found_updates.fetch_add(1, Ordering::Relaxed);
                                            updates.lock().await.push(result);
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                error_count.fetch_add(1, Ordering::Relaxed);
                                errors.lock().await.push(UpdateCheckError {
                                    provider: provider_id.clone(),
                                    package: Some(pkg_name.clone()),
                                    message: e.to_string(),
                                });
                            }
                        }
                    }

                    checked.fetch_add(1, Ordering::Relaxed);
                }
            },
        )
        .await;

    let final_updates = Arc::try_unwrap(updates).unwrap().into_inner();
    let final_errors = Arc::try_unwrap(errors).unwrap().into_inner();
    let total_checked = checked.load(Ordering::Relaxed);

    // Phase 4: Done
    emit_update_check_progress(
        &app_handle,
        &UpdateCheckProgress {
            phase: "done".into(),
            current: total_checked,
            total,
            current_package: None,
            current_provider: None,
            found_updates: final_updates.len(),
            errors: final_errors.len(),
        },
    );

    Ok(UpdateCheckSummary {
        updates: final_updates,
        total_checked,
        total_providers,
        errors: final_errors,
    })
}

/// Pin a package to prevent updates
#[tauri::command]
pub async fn package_pin(
    name: String,
    version: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let mut settings_guard = settings.write().await;
    settings_guard
        .provider_settings
        .pinned_packages
        .insert(name, version);

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
    let mut settings_guard = settings.write().await;
    settings_guard
        .provider_settings
        .pinned_packages
        .remove(&name);

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
) -> Result<(), String> {
    let reg = registry.read().await;

    let provider = reg
        .find_for_package(&name)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("No provider found for: {}", name))?;

    let provider_id = provider.id().to_string();

    let uninstall_result = provider
        .uninstall(crate::provider::UninstallRequest {
            name: name.clone(),
            version: None,
            force: true,
        })
        .await;

    if let Err(err) = uninstall_result {
        let _ = HistoryManager::record_rollback(
            &name,
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
            name: name.clone(),
            version: Some(to_version.clone()),
            global: true,
            force: true,
        })
        .await;

    match install_result {
        Ok(_) => {
            let _ =
                HistoryManager::record_rollback(&name, &to_version, &provider_id, true, None).await;
            Ok(())
        }
        Err(err) => {
            let _ = HistoryManager::record_rollback(
                &name,
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
pub async fn get_install_history(limit: Option<usize>) -> Result<Vec<InstallHistoryEntry>, String> {
    let entries = HistoryManager::get_history(limit)
        .await
        .map_err(|e| e.to_string())?;

    Ok(entries
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
        .collect())
}

/// Get installation history for a specific package
#[tauri::command]
pub async fn get_package_history(name: String) -> Result<Vec<InstallHistoryEntry>, String> {
    let entries = HistoryManager::get_package_history(&name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(entries
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
        .collect())
}

/// Clear installation history
#[tauri::command]
pub async fn clear_install_history() -> Result<(), String> {
    HistoryManager::clear_history()
        .await
        .map_err(|e| e.to_string())
}
