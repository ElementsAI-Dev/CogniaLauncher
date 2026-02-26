use crate::core::{
    EnvironmentProfile, ProfileApplyResult, ProfileEnvironment, SharedProfileManager,
};
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
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut profile = EnvironmentProfile::new(name);

    if let Some(desc) = description {
        profile = profile.with_description(desc);
    }

    for env in environments {
        profile.add_environment(env);
    }

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
    manager: State<'_, SharedProfileManager>,
) -> Result<EnvironmentProfile, String> {
    let mut mgr = manager.write().await;
    mgr.create_from_current(&name)
        .await
        .map_err(|e| e.to_string())
}
