use crate::config::Settings;
use crate::core::Orchestrator;
use crate::platform::env::Platform;
use crate::provider::{
    InstalledFilter, InstalledPackage, PackageInfo, PackageSummary, ProviderRegistry, SearchOptions,
};
use futures::future::join_all;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;

#[tauri::command]
pub async fn package_search(
    query: String,
    provider: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<PackageSummary>, String> {
    let reg = registry.read().await;

    // Single provider search
    if let Some(provider_id) = provider {
        if let Some(p) = reg.get(&provider_id) {
            return p
                .search(&query, SearchOptions::default())
                .await
                .map_err(|e| e.to_string());
        }
        return Err(format!("Provider not found: {}", provider_id));
    }

    // Parallel search across all available providers
    let providers: Vec<_> = reg.list().iter().filter_map(|id| reg.get(id)).collect();

    let search_futures: Vec<_> = providers
        .iter()
        .map(|p| {
            let query = query.clone();
            let provider = Arc::clone(p);
            async move {
                if provider.is_available().await {
                    provider
                        .search(
                            &query,
                            SearchOptions {
                                limit: Some(5),
                                page: None,
                            },
                        )
                        .await
                        .ok()
                } else {
                    None
                }
            }
        })
        .collect();

    let all_results = join_all(search_futures).await;
    let results: Vec<PackageSummary> = all_results.into_iter().flatten().flatten().collect();

    Ok(results)
}

#[tauri::command]
pub async fn package_info(
    name: String,
    provider: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<PackageInfo, String> {
    let reg = registry.read().await;

    if let Some(provider_id) = provider {
        if let Some(p) = reg.get(&provider_id) {
            return p.get_package_info(&name).await.map_err(|e| e.to_string());
        }
        return Err(format!("Provider not found: {}", provider_id));
    }

    if let Some(p) = reg
        .find_for_package(&name)
        .await
        .map_err(|e| e.to_string())?
    {
        return p.get_package_info(&name).await.map_err(|e| e.to_string());
    }

    Err(format!("Package not found: {}", name))
}

#[tauri::command]
pub async fn package_install(
    packages: Vec<String>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<String>, String> {
    let settings = settings.read().await.clone();
    let orchestrator = Orchestrator::new(registry.inner().clone(), settings);

    let receipts = orchestrator
        .install(&packages)
        .await
        .map_err(|e| e.to_string())?;
    Ok(receipts
        .into_iter()
        .map(|r| format!("{}@{}", r.name, r.version))
        .collect())
}

#[tauri::command]
pub async fn package_uninstall(
    packages: Vec<String>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    let settings = settings.read().await.clone();
    let orchestrator = Orchestrator::new(registry.inner().clone(), settings);
    orchestrator
        .uninstall(&packages)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn package_list(
    provider: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<InstalledPackage>, String> {
    let reg = registry.read().await;
    let mut all_packages = Vec::new();

    let providers: Vec<&str> = if let Some(ref id) = provider {
        vec![id.as_str()]
    } else {
        reg.list()
    };

    for provider_id in providers {
        if let Some(p) = reg.get(provider_id) {
            if p.is_available().await {
                if let Ok(mut packages) = p
                    .list_installed(InstalledFilter {
                        global_only: true,
                        ..Default::default()
                    })
                    .await
                {
                    all_packages.append(&mut packages);
                }
            }
        }
    }

    Ok(all_packages)
}

#[tauri::command]
pub async fn provider_list(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<crate::provider::ProviderInfo>, String> {
    let reg = registry.read().await;
    Ok(reg.list_all_info())
}

#[tauri::command]
pub async fn provider_check(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
) -> Result<bool, String> {
    let reg = registry.read().await;
    if let Some(provider) = reg.get(&provider_id) {
        Ok(provider.is_available().await)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn provider_system_list(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<String>, String> {
    let reg = registry.read().await;
    Ok(reg.get_system_provider_ids())
}

#[derive(serde::Serialize)]
pub struct ProviderStatusInfo {
    pub id: String,
    pub display_name: String,
    pub installed: bool,
    pub platforms: Vec<Platform>,
}

#[tauri::command]
pub async fn provider_status_all(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<ProviderStatusInfo>, String> {
    let reg = registry.read().await;

    let providers = reg.list_all_info();
    let to_check: Vec<_> = providers
        .into_iter()
        .map(|info| {
            let provider = reg.get(&info.id);
            (info, provider)
        })
        .collect();
    drop(reg);

    let futures = to_check.into_iter().map(|(info, provider)| async move {
        let installed = match provider {
            Some(p) => p.is_available().await,
            None => false,
        };
        ProviderStatusInfo {
            id: info.id,
            display_name: info.display_name,
            installed,
            platforms: info.platforms,
        }
    });

    Ok(join_all(futures).await)
}

#[tauri::command]
pub async fn package_check_installed(
    name: String,
    provider: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<bool, String> {
    let reg = registry.read().await;

    if let Some(provider_id) = provider {
        if let Some(p) = reg.get(&provider_id) {
            let installed = p
                .list_installed(InstalledFilter {
                    global_only: true,
                    ..Default::default()
                })
                .await
                .map(|packages| {
                    packages
                        .iter()
                        .any(|pkg| pkg.name.to_lowercase() == name.to_lowercase())
                })
                .unwrap_or(false);
            return Ok(installed);
        }
        return Err(format!("Provider not found: {}", provider_id));
    }

    for provider_id in reg.list() {
        if let Some(p) = reg.get(provider_id) {
            if p.is_available().await {
                if let Ok(packages) = p
                    .list_installed(InstalledFilter {
                        global_only: true,
                        ..Default::default()
                    })
                    .await
                {
                    if packages
                        .iter()
                        .any(|pkg| pkg.name.to_lowercase() == name.to_lowercase())
                    {
                        return Ok(true);
                    }
                }
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn package_versions(
    name: String,
    provider: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<String>, String> {
    let reg = registry.read().await;

    if let Some(provider_id) = provider {
        if let Some(p) = reg.get(&provider_id) {
            let versions = p
                .get_versions(&name)
                .await
                .map(|v| v.into_iter().map(|vi| vi.version).collect())
                .map_err(|e| e.to_string())?;
            return Ok(versions);
        }
        return Err(format!("Provider not found: {}", provider_id));
    }

    if let Some(p) = reg
        .find_for_package(&name)
        .await
        .map_err(|e| e.to_string())?
    {
        let versions = p
            .get_versions(&name)
            .await
            .map(|v| v.into_iter().map(|vi| vi.version).collect())
            .map_err(|e| e.to_string())?;
        return Ok(versions);
    }

    Ok(vec![])
}

#[tauri::command]
pub async fn provider_enable(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    // Check if provider exists
    {
        let reg = registry.read().await;
        if reg.get(&provider_id).is_none() {
            return Err(format!("Provider not found: {}", provider_id));
        }
    }

    // Update settings to enable the provider (remove from disabled list)
    let mut settings_guard = settings.write().await;
    settings_guard
        .provider_settings
        .disabled_providers
        .retain(|p| p != &provider_id);
    settings_guard.save().await.map_err(|e| e.to_string())?;

    let mut reg = registry.write().await;
    reg.set_provider_enabled(&provider_id, true);

    Ok(())
}

#[tauri::command]
pub async fn provider_disable(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    // Check if provider exists
    {
        let reg = registry.read().await;
        if reg.get(&provider_id).is_none() {
            return Err(format!("Provider not found: {}", provider_id));
        }
    }

    // Update settings to disable the provider (add to disabled list)
    let mut settings_guard = settings.write().await;
    if !settings_guard
        .provider_settings
        .disabled_providers
        .contains(&provider_id)
    {
        settings_guard
            .provider_settings
            .disabled_providers
            .push(provider_id.clone());
    }
    settings_guard.save().await.map_err(|e| e.to_string())?;

    let mut reg = registry.write().await;
    reg.set_provider_enabled(&provider_id, false);

    Ok(())
}
