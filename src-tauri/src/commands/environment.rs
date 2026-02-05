use crate::core::{DetectedEnvironment, EnvironmentInfo, EnvironmentManager};
use crate::provider::{
    EnvironmentProvider, InstallProgressEvent, InstallRequest, InstallStage, 
    Provider, ProgressSender, ProviderRegistry,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, RwLock};

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
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    app: AppHandle,
) -> Result<(), String> {
    // Create a progress channel
    let (tx, mut rx): (ProgressSender, mpsc::Receiver<InstallProgressEvent>) =
        mpsc::channel(32);
    
    // Clone values for the progress forwarding task
    let env_type_clone = env_type.clone();
    let version_clone = version.clone();
    let app_clone = app.clone();
    
    // Spawn a task to forward progress events to the frontend
    let progress_task = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let step = match event.stage {
                InstallStage::Fetching => "fetching",
                InstallStage::Downloading => "downloading",
                InstallStage::Extracting => "extracting",
                InstallStage::Configuring => "configuring",
                InstallStage::PostInstall => "configuring",
                InstallStage::Done => "done",
                InstallStage::Failed => "error",
            };
            
            let progress = EnvInstallProgress {
                env_type: env_type_clone.clone(),
                version: version_clone.clone(),
                step: step.to_string(),
                progress: event.progress_percent,
                downloaded_size: if event.downloaded_bytes > 0 { Some(event.downloaded_bytes) } else { None },
                total_size: event.total_bytes,
                speed: if event.speed_bps > 0.0 { Some(event.speed_bps) } else { None },
                error: if event.stage == InstallStage::Failed { Some(event.message.clone()) } else { None },
            };
            
            let _ = app_clone.emit("env-install-progress", progress);
        }
    });
    
    // Get the provider and install with progress
    let registry_guard = registry.read().await;
    let provider_key = provider_id.as_deref().unwrap_or(&env_type);
    
    let provider = registry_guard
        .get_environment_provider(provider_key)
        .ok_or_else(|| format!("Provider not found: {}", provider_key))?;
    
    // Create the install request
    let request = InstallRequest {
        name: env_type.clone(),
        version: Some(version.clone()),
        global: true,
        force: false,
    };
    
    // Perform installation with progress reporting
    let result = provider
        .install_with_progress(request, Some(tx))
        .await;
    
    // Drop the registry guard before waiting for progress task
    drop(registry_guard);
    
    // Wait for progress task to complete
    let _ = progress_task.await;
    
    // Handle result
    match result {
        Ok(_receipt) => Ok(()),
        Err(e) => {
            // Emit final error event
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
            Err(e.to_string())
        }
    }
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
pub async fn env_list_providers(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<EnvironmentProviderInfo>, String> {
    let registry_guard = registry.inner().read().await;
    let mut providers = Vec::new();

    for provider_id in registry_guard.list_environment_providers() {
        if let Some(provider) = registry_guard.get_environment_provider(provider_id) {
            let (env_type, description) = match provider_id {
                "fnm" => (
                    "node",
                    "Fast and simple Node.js version manager, built in Rust",
                ),
                "nvm" => (
                    "node",
                    "Node Version Manager - POSIX-compliant bash script",
                ),
                "pyenv" => ("python", "Simple Python version management"),
                "rustup" => ("rust", "The Rust toolchain installer"),
                "goenv" => ("go", "Go version management"),
                _ => (provider_id, provider.display_name()),
            };

            providers.push(EnvironmentProviderInfo {
                id: provider_id.to_string(),
                display_name: provider.display_name().to_string(),
                env_type: env_type.to_string(),
                description: description.to_string(),
            });
        }
    }

    Ok(providers)
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
    let alias_env_type = match env_type.as_str() {
        "fnm" | "nvm" => "node",
        "pyenv" => "python",
        "goenv" => "go",
        "rustup" => "rust",
        _ => env_type.as_str(),
    };
    
    match alias_lower.as_str() {
        "latest" | "newest" | "current" => {
            versions
                .first()
                .map(|v| v.version.clone())
                .ok_or_else(|| "No versions available".to_string())
        }
        "lts" => {
            // For Node.js, LTS versions are even major versions
            if alias_env_type == "node" {
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

/// Environment settings structure for persistence
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvironmentSettings {
    pub env_type: String,
    pub env_variables: Vec<EnvVariableConfig>,
    pub detection_files: Vec<DetectionFileConfig>,
    pub auto_switch: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvVariableConfig {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectionFileConfig {
    pub file_name: String,
    pub enabled: bool,
}

/// Save environment settings (env variables, detection files, auto-switch)
#[tauri::command]
pub async fn env_save_settings(
    settings: EnvironmentSettings,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<(), String> {
    let key = format!("env_settings.{}", settings.env_type);
    let value = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    
    let mut s = config.write().await;
    s.set_value(&key, &value).map_err(|e| e.to_string())?;
    s.save().await.map_err(|e| e.to_string())
}

/// Load environment settings for a specific environment type
#[tauri::command]
pub async fn env_load_settings(
    env_type: String,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Option<EnvironmentSettings>, String> {
    let key = format!("env_settings.{}", env_type);
    let s = config.read().await;
    
    if let Some(value) = s.get_value(&key) {
        let settings: EnvironmentSettings = serde_json::from_str(&value)
            .map_err(|e| e.to_string())?;
        Ok(Some(settings))
    } else {
        Ok(None)
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

/// System-detected environment information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SystemEnvironmentInfo {
    pub env_type: String,
    pub version: String,
    pub executable_path: Option<String>,
    pub source: String,
}

/// Detect all system-installed environments (not managed by version managers)
/// This detects environments installed via official installers, package managers, etc.
#[tauri::command]
pub async fn env_detect_system_all() -> Result<Vec<SystemEnvironmentInfo>, String> {
    use crate::provider::{SystemEnvironmentProvider, SystemEnvironmentType};
    
    let mut results = Vec::new();
    
    for env_type in SystemEnvironmentType::all() {
        let provider = SystemEnvironmentProvider::new(env_type);
        
        if provider.is_available().await {
            if let Ok(Some(version)) = provider.get_current_version().await {
                // Get executable path
                let versions = provider.list_installed_versions().await.unwrap_or_default();
                let path = versions.first().map(|v| v.install_path.to_string_lossy().to_string());
                
                results.push(SystemEnvironmentInfo {
                    env_type: env_type.env_type().to_string(),
                    version,
                    executable_path: path,
                    source: "system".to_string(),
                });
            }
        }
    }
    
    Ok(results)
}

/// Detect a specific system-installed environment
#[tauri::command]
pub async fn env_detect_system(
    env_type: String,
) -> Result<Option<SystemEnvironmentInfo>, String> {
    use crate::provider::{SystemEnvironmentProvider, SystemEnvironmentType};
    
    let system_type = match env_type.as_str() {
        "node" | "nodejs" => Some(SystemEnvironmentType::Node),
        "python" | "python3" => Some(SystemEnvironmentType::Python),
        "go" | "golang" => Some(SystemEnvironmentType::Go),
        "rust" | "rustc" => Some(SystemEnvironmentType::Rust),
        "ruby" => Some(SystemEnvironmentType::Ruby),
        "java" => Some(SystemEnvironmentType::Java),
        "php" => Some(SystemEnvironmentType::Php),
        "dotnet" | ".net" => Some(SystemEnvironmentType::Dotnet),
        "deno" => Some(SystemEnvironmentType::Deno),
        "bun" => Some(SystemEnvironmentType::Bun),
        _ => None,
    };
    
    let Some(system_type) = system_type else {
        return Ok(None);
    };
    
    let provider = SystemEnvironmentProvider::new(system_type);
    
    if !provider.is_available().await {
        return Ok(None);
    }
    
    if let Ok(Some(version)) = provider.get_current_version().await {
        let versions = provider.list_installed_versions().await.unwrap_or_default();
        let path = versions.first().map(|v| v.install_path.to_string_lossy().to_string());
        
        return Ok(Some(SystemEnvironmentInfo {
            env_type: system_type.env_type().to_string(),
            version,
            executable_path: path,
            source: "system".to_string(),
        }));
    }
    
    Ok(None)
}

/// Get the environment type mapping from provider ID to logical environment type
#[tauri::command]
pub async fn env_get_type_mapping() -> Result<std::collections::HashMap<String, String>, String> {
    let mut mapping = std::collections::HashMap::new();
    
    // Version managers to environment types
    mapping.insert("fnm".to_string(), "node".to_string());
    mapping.insert("nvm".to_string(), "node".to_string());
    mapping.insert("pyenv".to_string(), "python".to_string());
    mapping.insert("goenv".to_string(), "go".to_string());
    mapping.insert("rbenv".to_string(), "ruby".to_string());
    mapping.insert("rustup".to_string(), "rust".to_string());
    mapping.insert("sdkman".to_string(), "java".to_string());
    mapping.insert("phpbrew".to_string(), "php".to_string());
    mapping.insert("dotnet".to_string(), "dotnet".to_string());
    mapping.insert("deno".to_string(), "deno".to_string());
    
    // System providers
    mapping.insert("system-node".to_string(), "node".to_string());
    mapping.insert("system-python".to_string(), "python".to_string());
    mapping.insert("system-go".to_string(), "go".to_string());
    mapping.insert("system-rust".to_string(), "rust".to_string());
    mapping.insert("system-ruby".to_string(), "ruby".to_string());
    mapping.insert("system-java".to_string(), "java".to_string());
    mapping.insert("system-php".to_string(), "php".to_string());
    mapping.insert("system-dotnet".to_string(), "dotnet".to_string());
    mapping.insert("system-deno".to_string(), "deno".to_string());
    mapping.insert("system-bun".to_string(), "bun".to_string());
    
    Ok(mapping)
}
