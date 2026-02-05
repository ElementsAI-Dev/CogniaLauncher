use crate::core::{EnvironmentHealthResult, HealthCheckManager, PackageManagerHealthResult, SystemHealthResult};
use crate::provider::SharedRegistry;
use tauri::State;

/// Check health of all environments and package managers
#[tauri::command]
pub async fn health_check_all(
    registry: State<'_, SharedRegistry>,
) -> Result<SystemHealthResult, String> {
    let manager = HealthCheckManager::new(registry.inner().clone());
    manager.check_all().await.map_err(|e| e.to_string())
}

/// Check health of a specific environment
#[tauri::command]
pub async fn health_check_environment(
    env_type: String,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvironmentHealthResult, String> {
    let manager = HealthCheckManager::new(registry.inner().clone());
    manager
        .check_environment(&env_type)
        .await
        .map_err(|e| e.to_string())
}

/// Check health of all package managers
#[tauri::command]
pub async fn health_check_package_managers(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<PackageManagerHealthResult>, String> {
    let manager = HealthCheckManager::new(registry.inner().clone());
    manager
        .check_package_managers()
        .await
        .map_err(|e| e.to_string())
}
