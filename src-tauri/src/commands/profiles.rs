use crate::core::{
    EnvironmentProfile, ProfileApplyResult, ProfileEnvironment, SharedProfileManager,
};
use crate::provider::wsl::{WslProfileApplyResult, WslProfileSnapshot, WslProvider};
use tauri::State;

/// List all profiles
#[tauri::command]
pub async fn profile_list(
    manager: State<'_, SharedProfileManager>,
) -> Result<Vec<EnvironmentProfile>, String> {
    let mgr = manager.read().await;
    Ok(mgr.list())
}

/// Get a profile by ID
#[tauri::command]
pub async fn profile_get(
    id: String,
    manager: State<'_, SharedProfileManager>,
) -> Result<Option<EnvironmentProfile>, String> {
    let mgr = manager.read().await;
    Ok(mgr.get(&id))
}

/// Create a new profile
#[tauri::command]
pub async fn profile_create(
    name: String,
    description: Option<String>,
    environments: Vec<ProfileEnvironment>,
    env_snapshot: Option<std::collections::HashMap<String, String>>,
    capture_wsl_snapshot: Option<bool>,
    wsl_snapshot: Option<WslProfileSnapshot>,
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut profile = EnvironmentProfile::new(name);

    if let Some(desc) = description {
        profile = profile.with_description(desc);
    }

    for env in environments {
        profile.add_environment(env);
    }

    profile.env_snapshot = env_snapshot;
    profile.wsl_snapshot = if wsl_snapshot.is_some() {
        wsl_snapshot
    } else if capture_wsl_snapshot.unwrap_or(false) {
        #[cfg(target_os = "windows")]
        {
            let provider = WslProvider::new();
            if provider.detect_runtime_snapshot().await.available {
                Some(
                    provider
                        .capture_snapshot()
                        .await
                        .map_err(|e| e.to_string())?,
                )
            } else {
                None
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            None
        }
    } else {
        None
    };

    let mut mgr = manager.write().await;
    mgr.create(profile).await.map_err(|e| e.to_string())
}

/// Update an existing profile
#[tauri::command]
pub async fn profile_update(
    profile: EnvironmentProfile,
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut mgr = manager.write().await;
    mgr.update(profile).await.map_err(|e| e.to_string())
}

/// Delete a profile
#[tauri::command]
pub async fn profile_delete(
    id: String,
    manager: State<'_, SharedProfileManager>,
) -> Result<(), String> {
    let mut mgr = manager.write().await;
    mgr.delete(&id).await.map_err(|e| e.to_string())
}

/// Apply a profile (switch to all specified versions)
#[tauri::command]
pub async fn profile_apply(
    id: String,
    manager: State<'_, SharedProfileManager>,
) -> Result<ProfileApplyResult, String> {
    let mgr = manager.read().await;
    mgr.apply(&id).await.map_err(|e| e.to_string())
}

/// Export a profile to JSON
#[tauri::command]
pub async fn profile_export(
    id: String,
    manager: State<'_, SharedProfileManager>,
) -> Result<String, String> {
    let mgr = manager.read().await;
    mgr.export(&id).map_err(|e| e.to_string())
}

/// Import a profile from JSON
#[tauri::command]
pub async fn profile_import(
    json: String,
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut mgr = manager.write().await;
    mgr.import(&json).await.map_err(|e| e.to_string())
}

/// Create a profile from current environment state
#[tauri::command]
pub async fn profile_create_from_current(
    name: String,
    include_wsl_configuration: Option<bool>,
    include_env_snapshot: Option<bool>,
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut mgr = manager.write().await;
    mgr.create_from_current(
        &name,
        include_wsl_configuration.unwrap_or(false),
        include_env_snapshot.unwrap_or(false),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn profile_capture_wsl_snapshot() -> Result<WslProfileSnapshot, String> {
    #[cfg(target_os = "windows")]
    {
        let provider = WslProvider::new();
        return provider.capture_snapshot().await.map_err(|e| e.to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WSL snapshots are only available on Windows".to_string())
    }
}

#[tauri::command]
pub async fn profile_apply_wsl_snapshot(
    snapshot: WslProfileSnapshot,
) -> Result<WslProfileApplyResult, String> {
    #[cfg(target_os = "windows")]
    {
        let provider = WslProvider::new();
        return provider
            .apply_snapshot(&snapshot)
            .await
            .map_err(|e| e.to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(WslProfileApplyResult {
            applied: false,
            skipped: snapshot
                .distros
                .into_iter()
                .map(|distro| crate::provider::wsl::WslProfileApplySkipped {
                    distro_name: distro.name,
                    reason: "WSL snapshots are only available on Windows".to_string(),
                    expected_version: Some(distro.version),
                    installed_version: None,
                })
                .collect(),
        })
    }
}
