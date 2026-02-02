use crate::core::{DetectedEnvironment, EnvironmentInfo, EnvironmentManager};
use crate::provider::ProviderRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

/// Cancellation tokens for ongoing installations
pub type CancellationTokens = Arc<RwLock<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>;

/// Get a cancellation key for an installation
fn get_cancel_key(env_type: &str, version: &str) -> String {
    format!("{}:{}", env_type, version)
}

/// Progress event payload for environment installation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvInstallProgress {
    pub env_type: String,
    pub version: String,
    pub step: String,
    pub progress: f32,
    pub downloaded_size: Option<u64>,
    pub total_size: Option<u64>,
    pub speed: Option<f64>,
    pub error: Option<String>,
}

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
    app: AppHandle,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    
    // Emit fetching progress
    let _ = app.emit("env-install-progress", EnvInstallProgress {
        env_type: env_type.clone(),
        version: version.clone(),
        step: "fetching".to_string(),
        progress: 10.0,
        downloaded_size: None,
        total_size: None,
        speed: None,
        error: None,
    });
    
    // Emit downloading progress
    let _ = app.emit("env-install-progress", EnvInstallProgress {
        env_type: env_type.clone(),
        version: version.clone(),
        step: "downloading".to_string(),
        progress: 30.0,
        downloaded_size: None,
        total_size: None,
        speed: None,
        error: None,
    });
    
    // Perform the actual installation
    let result = manager
        .install_version(&env_type, &version)
        .await;
    
    match &result {
        Ok(_) => {
            // Emit configuring progress
            let _ = app.emit("env-install-progress", EnvInstallProgress {
                env_type: env_type.clone(),
                version: version.clone(),
                step: "configuring".to_string(),
                progress: 80.0,
                downloaded_size: None,
                total_size: None,
                speed: None,
                error: None,
            });
            
            // Emit done progress
            let _ = app.emit("env-install-progress", EnvInstallProgress {
                env_type: env_type.clone(),
                version: version.clone(),
                step: "done".to_string(),
                progress: 100.0,
                downloaded_size: None,
                total_size: None,
                speed: None,
                error: None,
            });
        }
        Err(e) => {
            // Emit error progress
            let _ = app.emit("env-install-progress", EnvInstallProgress {
                env_type: env_type.clone(),
                version: version.clone(),
                step: "error".to_string(),
                progress: 0.0,
                downloaded_size: None,
                total_size: None,
                speed: None,
                error: Some(e.to_string()),
            });
        }
    }
    
    result.map_err(|e| e.to_string())
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

/// Resolve a version alias (like 'lts', 'latest', 'stable') to an actual version number
#[tauri::command]
pub async fn env_resolve_alias(
    env_type: String,
    alias: String,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let versions = manager
        .get_available_versions(&env_type)
        .await
        .map_err(|e| e.to_string())?;
    
    let alias_lower = alias.to_lowercase();
    
    match alias_lower.as_str() {
        "latest" | "newest" | "current" => {
            versions
                .first()
                .map(|v| v.version.clone())
                .ok_or_else(|| "No versions available".to_string())
        }
        "lts" => {
            // For Node.js, LTS versions are even major versions
            if env_type.to_lowercase() == "node" {
                versions
                    .iter()
                    .find(|v| {
                        if let Some(major) = v.version.split('.').next() {
                            if let Ok(num) = major.trim_start_matches('v').parse::<u32>() {
                                return num >= 4 && num % 2 == 0;
                            }
                        }
                        false
                    })
                    .map(|v| v.version.clone())
                    .ok_or_else(|| "No LTS version available".to_string())
            } else {
                // For other languages, return the latest stable version
                versions
                    .iter()
                    .find(|v| !v.deprecated && !v.yanked)
                    .map(|v| v.version.clone())
                    .ok_or_else(|| "No stable version available".to_string())
            }
        }
        "stable" => {
            versions
                .iter()
                .find(|v| !v.deprecated && !v.yanked)
                .map(|v| v.version.clone())
                .ok_or_else(|| "No stable version available".to_string())
        }
        _ => {
            // Check if it's already a valid version number
            if versions.iter().any(|v| v.version == alias) {
                Ok(alias)
            } else {
                // Try partial matching (e.g., "20" matches "20.10.0")
                versions
                    .iter()
                    .find(|v| v.version.starts_with(&alias))
                    .map(|v| v.version.clone())
                    .ok_or_else(|| format!("Version '{}' not found", alias))
            }
        }
    }
}

/// Cancel an ongoing environment installation
#[tauri::command]
pub async fn env_install_cancel(
    env_type: String,
    version: String,
    tokens: State<'_, CancellationTokens>,
    app: AppHandle,
) -> Result<bool, String> {
    let key = get_cancel_key(&env_type, &version);
    let tokens_guard = tokens.read().await;
    
    if let Some(token) = tokens_guard.get(&key) {
        token.store(true, std::sync::atomic::Ordering::SeqCst);
        
        // Emit cancellation event
        let _ = app.emit("env-install-progress", EnvInstallProgress {
            env_type,
            version,
            step: "error".to_string(),
            progress: 0.0,
            downloaded_size: None,
            total_size: None,
            speed: None,
            error: Some("Installation cancelled by user".to_string()),
        });
        
        Ok(true)
    } else {
        Ok(false)
    }
}
