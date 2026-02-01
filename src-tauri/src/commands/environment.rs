use crate::core::{DetectedEnvironment, EnvironmentInfo, EnvironmentManager};
use crate::provider::ProviderRegistry;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

#[tauri::command]
pub async fn env_list(registry: State<'_, SharedRegistry>) -> Result<Vec<EnvironmentInfo>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager.list_environments().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_get(
    env_type: String,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvironmentInfo, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .get_environment(&env_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_install(
    env_type: String,
    version: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .install_version(&env_type, &version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_uninstall(
    env_type: String,
    version: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .uninstall_version(&env_type, &version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_use_global(
    env_type: String,
    version: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .set_global_version(&env_type, &version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_use_local(
    env_type: String,
    version: String,
    project_path: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .set_local_version(&env_type, std::path::Path::new(&project_path), &version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_detect(
    env_type: String,
    start_path: String,
    registry: State<'_, SharedRegistry>,
) -> Result<Option<DetectedEnvironment>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .detect_version(&env_type, std::path::Path::new(&start_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_detect_all(
    start_path: String,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<DetectedEnvironment>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .detect_all_versions(std::path::Path::new(&start_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_available_versions(
    env_type: String,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<crate::provider::VersionInfo>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .get_available_versions(&env_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_list_providers() -> Result<Vec<EnvironmentProviderInfo>, String> {
    Ok(vec![
        EnvironmentProviderInfo {
            id: "fnm".to_string(),
            display_name: "fnm (Fast Node Manager)".to_string(),
            env_type: "node".to_string(),
            description: "Fast and simple Node.js version manager, built in Rust".to_string(),
        },
        EnvironmentProviderInfo {
            id: "nvm".to_string(),
            display_name: "nvm (Node Version Manager)".to_string(),
            env_type: "node".to_string(),
            description: "Node Version Manager - POSIX-compliant bash script".to_string(),
        },
        EnvironmentProviderInfo {
            id: "pyenv".to_string(),
            display_name: "pyenv".to_string(),
            env_type: "python".to_string(),
            description: "Simple Python version management".to_string(),
        },
        EnvironmentProviderInfo {
            id: "rustup".to_string(),
            display_name: "rustup".to_string(),
            env_type: "rust".to_string(),
            description: "The Rust toolchain installer".to_string(),
        },
        EnvironmentProviderInfo {
            id: "goenv".to_string(),
            display_name: "goenv".to_string(),
            env_type: "go".to_string(),
            description: "Go version management".to_string(),
        },
    ])
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvironmentProviderInfo {
    pub id: String,
    pub display_name: String,
    pub env_type: String,
    pub description: String,
}
