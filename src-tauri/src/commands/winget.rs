use crate::provider::winget::{WingetInfo, WingetPin, WingetProvider, WingetSource};
use crate::SharedRegistry;
use tauri::State;

/// Helper to get the WingetProvider from the registry.
async fn get_winget(registry: &State<'_, SharedRegistry>) -> Result<WingetProvider, String> {
    let reg = registry.read().await;
    if reg.get("winget").is_none() {
        return Err("winget provider not registered".into());
    }
    Ok(WingetProvider::new())
}

// ── Pin management ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_pin_list(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<WingetPin>, String> {
    let provider = get_winget(&registry).await?;
    provider.pin_list().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_pin_add(
    id: String,
    version: Option<String>,
    blocking: bool,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider
        .pin_add(&id, version.as_deref(), blocking)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_pin_remove(
    id: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider.pin_remove(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_pin_reset(
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider.pin_reset().await.map_err(|e| e.to_string())
}

// ── Source management ───────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_source_list(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<WingetSource>, String> {
    let provider = get_winget(&registry).await?;
    provider.source_list().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_source_add(
    name: String,
    url: String,
    source_type: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider
        .source_add(&name, &url, source_type.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_source_remove(
    name: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider
        .source_remove(&name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_source_reset(
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider.source_reset().await.map_err(|e| e.to_string())
}

// ── Export / Import ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_export(
    output_path: String,
    include_versions: bool,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider
        .export_packages(&output_path, include_versions)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn winget_import(
    input_path: String,
    ignore_unavailable: bool,
    ignore_versions: bool,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let provider = get_winget(&registry).await?;
    provider
        .import_packages(&input_path, ignore_unavailable, ignore_versions)
        .await
        .map_err(|e| e.to_string())
}

// ── Repair ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_repair(
    id: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let provider = get_winget(&registry).await?;
    provider
        .repair_package(&id)
        .await
        .map_err(|e| e.to_string())
}

// ── Download (offline installer) ────────────────────────────────────────

#[tauri::command]
pub async fn winget_download(
    id: String,
    version: Option<String>,
    directory: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let provider = get_winget(&registry).await?;
    provider
        .download_installer(&id, version.as_deref(), directory.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// ── Info ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_get_info(
    registry: State<'_, SharedRegistry>,
) -> Result<WingetInfo, String> {
    let provider = get_winget(&registry).await?;
    provider.get_info().await.map_err(|e| e.to_string())
}

// ── Advanced install ────────────────────────────────────────────────────

#[tauri::command]
pub async fn winget_install_advanced(
    id: String,
    version: Option<String>,
    scope: Option<String>,
    architecture: Option<String>,
    locale: Option<String>,
    location: Option<String>,
    force: bool,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let provider = get_winget(&registry).await?;
    provider
        .install_advanced(
            &id,
            version.as_deref(),
            scope.as_deref(),
            architecture.as_deref(),
            locale.as_deref(),
            location.as_deref(),
            force,
        )
        .await
        .map_err(|e| e.to_string())
}
