use crate::cache::MetadataCache;
use crate::config::Settings;
use crate::core::Orchestrator;
use crate::platform::env::{current_platform, Platform};
use crate::provider::{
    support::{
        classify_provider_scope, provider_health_probe_timeout, update_support_reason,
        ProviderAvailabilityProbe, SUPPORT_STATUS_SUPPORTED, SUPPORT_STATUS_UNSUPPORTED,
    },
    Capability, InstalledFilter, InstalledPackage, PackageInfo, PackageSummary, ProviderRegistry,
    SearchOptions,
};
use futures::future::join_all;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;
pub type SharedSettings = Arc<RwLock<Settings>>;

/// TTL constants for different cache categories (in seconds)
const SEARCH_CACHE_TTL: i64 = 300; // 5 minutes
const INSTALLED_CACHE_TTL: i64 = 60; // 1 minute (changes frequently)
const INFO_CACHE_TTL: i64 = 3600; // 1 hour
const VERSIONS_CACHE_TTL: i64 = 1800; // 30 minutes
const STATUS_CACHE_TTL: i64 = 120; // 2 minutes

/// Deduplicate installed package entries while preserving order.
/// Key: provider + name + version (case-insensitive provider/name).
fn dedupe_installed_packages(packages: Vec<InstalledPackage>) -> Vec<InstalledPackage> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::with_capacity(packages.len());

    for pkg in packages {
        let key = format!(
            "{}::{}::{}",
            pkg.provider.to_ascii_lowercase(),
            pkg.name.to_ascii_lowercase(),
            pkg.version.to_ascii_lowercase()
        );
        if seen.insert(key) {
            deduped.push(pkg);
        }
    }

    deduped
}

/// Open a MetadataCache with a custom TTL, reading cache_dir from settings.
async fn open_metadata_cache(settings: &SharedSettings, ttl: i64) -> Result<MetadataCache, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);
    MetadataCache::open_with_ttl(&cache_dir, ttl)
        .await
        .map_err(|e| e.to_string())
}

/// Invalidate package-related cache entries (used after install/uninstall).
pub async fn invalidate_package_caches(settings: &SharedSettings) {
    if let Ok(mut cache) = open_metadata_cache(settings, INFO_CACHE_TTL).await {
        // Remove all installed-package cache entries (pkg:installed:all, pkg:installed:npm, etc.)
        let _ = cache.remove_by_prefix("pkg:installed:").await;
        // Remove provider status cache (exact key)
        let _ = cache.remove("pkg:status_all").await;
    }
}

pub async fn refresh_provider_registry(
    settings: &SharedSettings,
    registry: &SharedRegistry,
) -> Result<(), String> {
    let rebuilt_registry = {
        let settings_guard = settings.read().await;
        ProviderRegistry::with_settings(&settings_guard)
            .await
            .map_err(|err| err.to_string())?
    };

    let mut registry_guard = registry.write().await;
    *registry_guard = rebuilt_registry;
    Ok(())
}

async fn update_provider_management_state<F>(
    provider_id: &str,
    settings: &SharedSettings,
    registry: &SharedRegistry,
    mutate: F,
) -> Result<(), String>
where
    F: FnOnce(&mut Settings, &str) -> Result<(), String>,
{
    {
        let registry_guard = registry.read().await;
        if registry_guard.get(provider_id).is_none() {
            return Err(format!("Provider not found: {}", provider_id));
        }
    }

    {
        let mut settings_guard = settings.write().await;
        mutate(&mut settings_guard, provider_id)?;
        settings_guard.save().await.map_err(|err| err.to_string())?;
    }

    refresh_provider_registry(settings, registry).await?;
    invalidate_package_caches(settings).await;
    Ok(())
}

#[tauri::command]
pub async fn package_search(
    query: String,
    provider: Option<String>,
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<PackageSummary>, String> {
    let cache_key = format!(
        "pkg:search:{}:{}",
        provider.as_deref().unwrap_or("all"),
        &query
    );

    // Try cache first (unless forced)
    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_metadata_cache(settings.inner(), SEARCH_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<PackageSummary>>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    // Perform actual search
    let results = {
        let reg = registry.read().await;

        if let Some(ref provider_id) = provider {
            if let Some(p) = reg.get(provider_id) {
                p.search(&query, SearchOptions::default())
                    .await
                    .map_err(|e| e.to_string())?
            } else {
                return Err(format!("Provider not found: {}", provider_id));
            }
        } else {
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
            all_results.into_iter().flatten().flatten().collect()
        }
    };

    // Store in cache
    if let Ok(mut cache) = open_metadata_cache(settings.inner(), SEARCH_CACHE_TTL).await {
        let _ = cache
            .set_with_ttl(&cache_key, &results, SEARCH_CACHE_TTL)
            .await;
    }

    Ok(results)
}

#[tauri::command]
pub async fn package_info(
    name: String,
    provider: Option<String>,
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<PackageInfo, String> {
    let cache_key = format!(
        "pkg:info:{}:{}",
        provider.as_deref().unwrap_or("auto"),
        &name
    );

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_metadata_cache(settings.inner(), INFO_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<PackageInfo>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let info = {
        let reg = registry.read().await;
        if let Some(provider_id) = provider.as_deref() {
            if let Some(p) = reg.get(provider_id) {
                p.get_package_info(&name).await.map_err(|e| e.to_string())?
            } else {
                return Err(format!("Provider not found: {}", provider_id));
            }
        } else if let Some(p) = reg
            .find_for_package(&name)
            .await
            .map_err(|e| e.to_string())?
        {
            p.get_package_info(&name).await.map_err(|e| e.to_string())?
        } else {
            return Err(format!("Package not found: {}", name));
        }
    };

    if let Ok(mut cache) = open_metadata_cache(settings.inner(), INFO_CACHE_TTL).await {
        let _ = cache.set_with_ttl(&cache_key, &info, INFO_CACHE_TTL).await;
    }

    Ok(info)
}

#[tauri::command]
pub async fn package_install(
    packages: Vec<String>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<String>, String> {
    let cloned_settings = settings.read().await.clone();
    let orchestrator = Orchestrator::new(registry.inner().clone(), cloned_settings);

    let receipts = orchestrator
        .install(&packages)
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate package caches after successful install
    invalidate_package_caches(settings.inner()).await;

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
    let cloned_settings = settings.read().await.clone();
    let orchestrator = Orchestrator::new(registry.inner().clone(), cloned_settings);
    let result = orchestrator
        .uninstall(&packages)
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate package caches after successful uninstall
    invalidate_package_caches(settings.inner()).await;

    Ok(result)
}

#[tauri::command]
pub async fn package_list(
    provider: Option<String>,
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<InstalledPackage>, String> {
    let cache_key = format!("pkg:installed:{}", provider.as_deref().unwrap_or("all"));

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_metadata_cache(settings.inner(), INSTALLED_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<InstalledPackage>>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let all_packages = {
        let reg = registry.read().await;

        let provider_ids: Vec<String> = if let Some(ref id) = provider {
            vec![id.clone()]
        } else {
            reg.list().into_iter().map(|s| s.to_string()).collect()
        };

        // Collect Arc<dyn Provider> references under the read lock, then release it
        let providers_to_check: Vec<_> = provider_ids.iter().filter_map(|id| reg.get(id)).collect();
        drop(reg);

        // Limit concurrent provider checks to avoid subprocess storms
        let max_concurrency = settings.read().await.startup.max_concurrent_scans;
        let permits = (max_concurrency as usize).max(1).min(32);
        let semaphore = Arc::new(tokio::sync::Semaphore::new(permits));
        let mut tasks = Vec::with_capacity(providers_to_check.len());

        for p in providers_to_check {
            let sem = semaphore.clone();
            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.ok();
                if p.is_available().await {
                    p.list_installed(InstalledFilter {
                        global_only: true,
                        ..Default::default()
                    })
                    .await
                    .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }));
        }

        let results = join_all(tasks).await;
        let mut pkgs = Vec::new();
        for result in results {
            if let Ok(mut packages) = result {
                pkgs.append(&mut packages);
            }
        }
        pkgs
    };

    let all_packages = dedupe_installed_packages(all_packages);

    if let Ok(mut cache) = open_metadata_cache(settings.inner(), INSTALLED_CACHE_TTL).await {
        let _ = cache
            .set_with_ttl(&cache_key, &all_packages, INSTALLED_CACHE_TTL)
            .await;
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
    if reg.get(&provider_id).is_some() {
        Ok(reg.check_provider_available(&provider_id).await)
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

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProviderStatusInfo {
    pub id: String,
    pub display_name: String,
    pub installed: bool,
    pub platforms: Vec<Platform>,
    pub scope_state: String,
    pub scope_reason: Option<String>,
    pub status: String,
    pub reason: Option<String>,
    pub reason_code: Option<String>,
    pub update_supported: bool,
    pub update_reason: Option<String>,
    pub update_reason_code: Option<String>,
}

fn build_provider_status_info(
    info: crate::provider::ProviderInfo,
    platform: Platform,
    availability: ProviderAvailabilityProbe,
) -> ProviderStatusInfo {
    let installed = availability.is_available();
    let supported_platforms = info.platforms.clone();
    let capability_set = info
        .capabilities
        .iter()
        .copied()
        .collect::<std::collections::HashSet<Capability>>();
    let update_support = update_support_reason(platform, &supported_platforms, &capability_set);
    let (scope, runtime_reason) =
        classify_provider_scope(platform, &supported_platforms, availability);

    ProviderStatusInfo {
        id: info.id,
        display_name: info.display_name,
        installed,
        platforms: supported_platforms,
        scope_state: scope.as_health_scope_state().to_string(),
        scope_reason: runtime_reason.as_ref().map(|r| r.code.to_string()),
        status: if scope.is_available() {
            SUPPORT_STATUS_SUPPORTED.into()
        } else {
            SUPPORT_STATUS_UNSUPPORTED.into()
        },
        reason: runtime_reason.as_ref().map(|r| r.message.clone()),
        reason_code: runtime_reason.as_ref().map(|r| r.code.to_string()),
        update_supported: scope.is_available() && update_support.is_none(),
        update_reason: if !scope.is_available() {
            runtime_reason.as_ref().map(|r| r.message.clone())
        } else {
            update_support.as_ref().map(|r| r.message.clone())
        },
        update_reason_code: if !scope.is_available() {
            runtime_reason.as_ref().map(|r| r.code.to_string())
        } else {
            update_support.as_ref().map(|r| r.code.to_string())
        },
    }
}

#[tauri::command]
pub async fn provider_status(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
) -> Result<ProviderStatusInfo, String> {
    let platform = current_platform();
    let info = {
        let reg = registry.read().await;
        reg.get_provider_info(&provider_id)
            .ok_or_else(|| format!("Provider not found: {}", provider_id))?
    };

    let availability = {
        let reg = registry.read().await;
        let is_api_provider = reg.get_api_provider_config(&info.id).is_some();
        if !info.enabled {
            ProviderAvailabilityProbe::Unavailable
        } else {
            match reg.get(&info.id) {
                Some(provider) => {
                    let timeout = provider_health_probe_timeout(&info.id, is_api_provider);
                    match tokio::time::timeout(timeout, provider.is_available()).await {
                        Ok(true) => ProviderAvailabilityProbe::Available,
                        Ok(false) => ProviderAvailabilityProbe::Unavailable,
                        Err(_) => ProviderAvailabilityProbe::Timeout,
                    }
                }
                None => ProviderAvailabilityProbe::Unavailable,
            }
        }
    };

    Ok(build_provider_status_info(info, platform, availability))
}

#[tauri::command]
pub async fn provider_status_all(
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<ProviderStatusInfo>, String> {
    let cache_key = "pkg:status_all";

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_metadata_cache(settings.inner(), STATUS_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<ProviderStatusInfo>>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let results = {
        let reg = registry.read().await;
        let providers = reg.list_all_info();
        let platform = current_platform();
        let to_check: Vec<_> = providers
            .into_iter()
            .map(|info| {
                let provider = reg.get(&info.id);
                let is_api_provider = reg.get_api_provider_config(&info.id).is_some();
                (info, provider, is_api_provider)
            })
            .collect();
        drop(reg);

        let futures = to_check
            .into_iter()
            .map(|(info, provider, is_api_provider)| async move {
                let availability = match provider {
                    Some(p) => {
                        let timeout_budget =
                            provider_health_probe_timeout(&info.id, is_api_provider);
                        match tokio::time::timeout(timeout_budget, p.is_available()).await {
                            Ok(true) => ProviderAvailabilityProbe::Available,
                            Ok(false) => ProviderAvailabilityProbe::Unavailable,
                            Err(_) => ProviderAvailabilityProbe::Timeout,
                        }
                    }
                    None => ProviderAvailabilityProbe::Unavailable,
                };
                build_provider_status_info(info, platform, availability)
            })
            .collect::<Vec<_>>();
        join_all(futures).await
    };

    if let Ok(mut cache) = open_metadata_cache(settings.inner(), STATUS_CACHE_TTL).await {
        let _ = cache
            .set_with_ttl(cache_key, &results, STATUS_CACHE_TTL)
            .await;
    }

    Ok(results)
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
            // O(1) targeted lookup instead of listing all packages
            let installed = p
                .get_installed_version(&name)
                .await
                .map(|v| v.is_some())
                .unwrap_or(false);
            return Ok(installed);
        }
        return Err(format!("Provider not found: {}", provider_id));
    }

    for provider_id in reg.list() {
        if let Some(p) = reg.get(provider_id) {
            if p.is_available().await {
                // O(1) per provider instead of listing all installed packages
                if let Ok(Some(_)) = p.get_installed_version(&name).await {
                    return Ok(true);
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
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<Vec<String>, String> {
    let cache_key = format!(
        "pkg:versions:{}:{}",
        provider.as_deref().unwrap_or("auto"),
        &name
    );

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_metadata_cache(settings.inner(), VERSIONS_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<String>>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let versions = {
        let reg = registry.read().await;
        if let Some(ref provider_id) = provider {
            if let Some(p) = reg.get(provider_id.as_str()) {
                p.get_versions(&name)
                    .await
                    .map(|v| v.into_iter().map(|vi| vi.version).collect())
                    .map_err(|e| e.to_string())?
            } else {
                return Err(format!("Provider not found: {}", provider_id));
            }
        } else if let Some(p) = reg
            .find_for_package(&name)
            .await
            .map_err(|e| e.to_string())?
        {
            p.get_versions(&name)
                .await
                .map(|v| v.into_iter().map(|vi| vi.version).collect())
                .map_err(|e| e.to_string())?
        } else {
            vec![]
        }
    };

    if let Ok(mut cache) = open_metadata_cache(settings.inner(), VERSIONS_CACHE_TTL).await {
        let _ = cache
            .set_with_ttl(&cache_key, &versions, VERSIONS_CACHE_TTL)
            .await;
    }

    Ok(versions)
}

#[tauri::command]
pub async fn provider_enable(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    update_provider_management_state(
        &provider_id,
        settings.inner(),
        registry.inner(),
        |settings, provider_id| {
            settings.set_provider_enabled_override(provider_id, Some(true));
            Ok(())
        },
    )
    .await
}

#[tauri::command]
pub async fn provider_disable(
    provider_id: String,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    update_provider_management_state(
        &provider_id,
        settings.inner(),
        registry.inner(),
        |settings, provider_id| {
            settings.set_provider_enabled_override(provider_id, Some(false));
            Ok(())
        },
    )
    .await
}

#[tauri::command]
pub async fn provider_set_priority(
    provider_id: String,
    priority: i32,
    registry: State<'_, SharedRegistry>,
    settings: State<'_, SharedSettings>,
) -> Result<(), String> {
    update_provider_management_state(
        &provider_id,
        settings.inner(),
        registry.inner(),
        |settings, provider_id| {
            settings.set_provider_priority_override(provider_id, Some(priority));
            Ok(())
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{build_provider_status_info, dedupe_installed_packages};
    use crate::platform::env::Platform;
    use crate::provider::support::ProviderAvailabilityProbe;
    use crate::provider::support::{REASON_HEALTH_CHECK_TIMEOUT, REASON_PROVIDER_UNAVAILABLE};
    use crate::provider::{Capability, InstalledPackage, ProviderInfo};
    use std::path::PathBuf;

    fn installed_pkg(provider: &str, name: &str, version: &str) -> InstalledPackage {
        InstalledPackage {
            name: name.to_string(),
            version: version.to_string(),
            provider: provider.to_string(),
            install_path: PathBuf::from(format!("node_modules/{}", name)),
            installed_at: String::new(),
            is_global: true,
        }
    }

    fn provider_info(id: &str, capabilities: Vec<Capability>) -> ProviderInfo {
        ProviderInfo {
            id: id.to_string(),
            display_name: id.to_uppercase(),
            capabilities,
            platforms: vec![Platform::Windows],
            priority: 1,
            is_environment_provider: false,
            enabled: true,
        }
    }

    #[test]
    fn test_dedupe_installed_packages_preserves_order() {
        let packages = vec![
            installed_pkg("npm", "react", "18.2.0"),
            installed_pkg("npm", "lodash", "4.17.21"),
            installed_pkg("npm", "react", "18.2.0"),
        ];

        let deduped = dedupe_installed_packages(packages);
        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0].name, "react");
        assert_eq!(deduped[1].name, "lodash");
    }

    #[test]
    fn test_dedupe_installed_packages_is_case_insensitive() {
        let packages = vec![
            installed_pkg("NPM", "React", "18.2.0"),
            installed_pkg("npm", "react", "18.2.0"),
            installed_pkg("npm", "react", "18.2.1"),
        ];

        let deduped = dedupe_installed_packages(packages);
        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0].version, "18.2.0");
        assert_eq!(deduped[1].version, "18.2.1");
    }

    #[test]
    fn test_dedupe_installed_packages_keeps_different_providers() {
        let packages = vec![
            installed_pkg("npm", "eslint", "9.17.0"),
            installed_pkg("yarn", "eslint", "9.17.0"),
        ];

        let deduped = dedupe_installed_packages(packages);
        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0].provider, "npm");
        assert_eq!(deduped[1].provider, "yarn");
    }

    #[test]
    fn test_build_provider_status_info_unavailable_scope() {
        let info = provider_info("npm", vec![Capability::Update]);
        let status = build_provider_status_info(
            info,
            Platform::Windows,
            ProviderAvailabilityProbe::Unavailable,
        );

        assert!(!status.installed);
        assert_eq!(status.scope_state, "unavailable");
        assert_eq!(
            status.scope_reason.as_deref(),
            Some(REASON_PROVIDER_UNAVAILABLE)
        );
        assert_eq!(
            status.reason_code.as_deref(),
            Some(REASON_PROVIDER_UNAVAILABLE)
        );
        assert_eq!(status.status, "unsupported");
        assert!(!status.update_supported);
    }

    #[test]
    fn test_build_provider_status_info_timeout_scope() {
        let info = provider_info("npm", vec![Capability::Update]);
        let status =
            build_provider_status_info(info, Platform::Windows, ProviderAvailabilityProbe::Timeout);

        assert!(!status.installed);
        assert_eq!(status.scope_state, "timeout");
        assert_eq!(
            status.scope_reason.as_deref(),
            Some(REASON_HEALTH_CHECK_TIMEOUT)
        );
        assert_eq!(
            status.reason_code.as_deref(),
            Some(REASON_HEALTH_CHECK_TIMEOUT)
        );
        assert_eq!(status.status, "unsupported");
        assert!(!status.update_supported);
    }

    #[test]
    fn test_build_provider_status_info_available_supported() {
        let info = provider_info("npm", vec![Capability::Update]);
        let status = build_provider_status_info(
            info,
            Platform::Windows,
            ProviderAvailabilityProbe::Available,
        );

        assert!(status.installed);
        assert_eq!(status.scope_state, "available");
        assert!(status.scope_reason.is_none());
        assert_eq!(status.status, "supported");
        assert!(status.update_supported);
    }

    #[test]
    fn test_build_provider_status_info_zig_unavailable_maps_to_unsupported() {
        let info = provider_info("zig", vec![Capability::Update, Capability::VersionSwitch]);
        let status = build_provider_status_info(
            info,
            Platform::Windows,
            ProviderAvailabilityProbe::Unavailable,
        );

        assert_eq!(status.id, "zig");
        assert_eq!(status.scope_state, "unavailable");
        assert_eq!(status.status, "unsupported");
        assert_eq!(
            status.reason_code.as_deref(),
            Some(REASON_PROVIDER_UNAVAILABLE)
        );
    }
}
