use crate::config::Settings;
use crate::core::{BatchInstallRequest, BatchManager, BatchProgress, BatchResult, HistoryManager};
use crate::provider::ProviderRegistry;
use crate::resolver::{Dependency, Package, Resolver, Version, VersionConstraint};
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

    // Parse package specifications
    let deps: Vec<Dependency> = packages
        .iter()
        .map(|p| {
            let (name, constraint) = if let Some(idx) = p.find('@') {
                let name = &p[..idx];
                let version = &p[idx + 1..];
                (
                    name.to_string(),
                    version.parse::<VersionConstraint>().unwrap_or(VersionConstraint::Any),
                )
            } else {
                (p.clone(), VersionConstraint::Any)
            };
            Dependency { name, constraint }
        })
        .collect();

    // Create resolver and add available packages
    let mut resolver = Resolver::new();

    // Track which provider provides each package
    let mut package_providers: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Collect installed packages for comparison
    let mut installed_packages: std::collections::HashMap<String, String> = std::collections::HashMap::new();
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

    // Fetch available versions from providers
    for dep in &deps {
        for provider_id in reg.list() {
            if let Some(provider) = reg.get(provider_id) {
                if provider.is_available().await {
                    if let Ok(versions) = provider.get_versions(&dep.name).await {
                        if !versions.is_empty() {
                            // Track which provider has this package
                            package_providers
                                .entry(dep.name.clone())
                                .or_insert_with(|| provider_id.to_string());
                        }
                        for v in versions {
                            if let Ok(version) = v.version.parse::<Version>() {
                                let pkg = Package {
                                    name: dep.name.clone(),
                                    version,
                                    dependencies: vec![], // Provider doesn't return deps yet
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

            // Build tree with is_installed information
            let tree: Vec<DependencyNode> = deps
                .iter()
                .map(|d| {
                    let name_lower = d.name.to_lowercase();
                    let resolved_version = resolution
                        .get(&d.name)
                        .map(|v| v.to_string())
                        .unwrap_or_default();
                    let is_installed = installed_packages.contains_key(&name_lower);
                    let provider = package_providers.get(&d.name).cloned();
                    
                    DependencyNode {
                        name: d.name.clone(),
                        version: resolved_version,
                        constraint: d.constraint.to_string(),
                        provider,
                        dependencies: vec![],
                        is_direct: true,
                        is_installed,
                        is_conflict: false,
                        conflict_reason: None,
                        depth: 0,
                    }
                })
                .collect();

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

/// Check for available updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub provider: String,
    pub update_type: String, // "major", "minor", "patch"
}

#[tauri::command]
pub async fn check_updates(
    packages: Option<Vec<String>>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<UpdateCheckResult>, String> {
    let reg = registry.read().await;
    let mut updates = Vec::new();

    for provider_id in reg.list() {
        if let Some(provider) = reg.get(provider_id) {
            if !provider.is_available().await {
                continue;
            }

            let installed = provider
                .list_installed(crate::provider::InstalledFilter::default())
                .await
                .unwrap_or_default();

            for pkg in installed {
                // Filter if specific packages requested
                if let Some(ref filter) = packages {
                    if !filter.iter().any(|p| p.eq_ignore_ascii_case(&pkg.name)) {
                        continue;
                    }
                }

                if let Ok(versions) = provider.get_versions(&pkg.name).await {
                    if let Some(latest) = versions.first() {
                        if latest.version != pkg.version {
                            let current: Version = pkg.version.parse().unwrap_or(Version::new(0, 0, 0));
                            let new_ver: Version = latest.version.parse().unwrap_or(Version::new(0, 0, 0));

                            // Only report as update if new version is actually greater
                            if new_ver > current {
                                let update_type = if new_ver.major > current.major {
                                    "major"
                                } else if new_ver.minor > current.minor {
                                    "minor"
                                } else {
                                    "patch"
                                };

                                updates.push(UpdateCheckResult {
                                    name: pkg.name,
                                    current_version: pkg.version,
                                    latest_version: latest.version.clone(),
                                    provider: provider_id.to_string(),
                                    update_type: update_type.into(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(updates)
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

    // First uninstall current
    provider
        .uninstall(crate::provider::UninstallRequest {
            name: name.clone(),
            version: None,
            force: true,
        })
        .await
        .map_err(|e| e.to_string())?;

    // Then install specific version
    provider
        .install(crate::provider::InstallRequest {
            name,
            version: Some(to_version),
            global: true,
            force: true,
        })
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
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
) -> Result<Vec<InstallHistoryEntry>, String> {
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
pub async fn get_package_history(
    name: String,
) -> Result<Vec<InstallHistoryEntry>, String> {
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
