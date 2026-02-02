use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct SelfUpdateInfo {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub release_notes: Option<String>,
}

#[tauri::command]
pub async fn self_check_update(app: AppHandle) -> Result<SelfUpdateInfo, String> {
    let current_version = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.1.0".to_string());

    // Try to check for updates using the updater plugin
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => Ok(SelfUpdateInfo {
                current_version,
                latest_version: Some(update.version.clone()),
                update_available: true,
                release_notes: update.body.clone(),
            }),
            Ok(None) => Ok(SelfUpdateInfo {
                current_version: current_version.clone(),
                latest_version: Some(current_version),
                update_available: false,
                release_notes: None,
            }),
            Err(e) => {
                log::warn!("Failed to check for updates: {}", e);
                Ok(SelfUpdateInfo {
                    current_version,
                    latest_version: None,
                    update_available: false,
                    release_notes: None,
                })
            }
        },
        Err(e) => {
            log::warn!("Updater not available: {}", e);
            Ok(SelfUpdateInfo {
                current_version,
                latest_version: None,
                update_available: false,
                release_notes: None,
            })
        }
    }
}

#[tauri::command]
pub async fn self_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    // Download and install the update
    let mut downloaded: u64 = 0;

    update
        .download_and_install(
            |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                if let Some(total) = content_length {
                    let progress = (downloaded as f64 / total as f64 * 100.0) as u32;
                    log::info!("Download progress: {}%", progress);
                }
            },
            || {
                log::info!("Download finished, preparing to install...");
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
