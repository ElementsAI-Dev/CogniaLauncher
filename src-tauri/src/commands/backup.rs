use crate::cache::{DatabaseInfo, DownloadCache, IntegrityCheckResult};
use crate::commands::config::SharedSettings;
use crate::commands::custom_detection::SharedCustomDetectionManager;
use crate::commands::terminal::SharedTerminalProfileManager;
use crate::core::backup::{
    self, BackupContentType, BackupInfo, BackupResult, BackupValidationResult, RestoreResult,
};
use crate::core::profiles::SharedProfileManager;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn backup_create(
    contents: Vec<String>,
    note: Option<String>,
    settings: State<'_, SharedSettings>,
    terminal_manager: State<'_, SharedTerminalProfileManager>,
    profile_manager: State<'_, SharedProfileManager>,
    custom_detection_manager: State<'_, SharedCustomDetectionManager>,
) -> Result<BackupResult, String> {
    let content_types: Vec<BackupContentType> = if contents.is_empty() {
        BackupContentType::all()
    } else {
        contents
            .iter()
            .filter_map(|s| BackupContentType::from_str(s))
            .collect()
    };

    if content_types.is_empty() {
        return Err("No valid content types specified".to_string());
    }

    let s = settings.read().await;
    let tm = terminal_manager.read().await;
    let pm = profile_manager.read().await;
    let cdm = custom_detection_manager.read().await;

    backup::create_backup(&s, &content_types, note.as_deref(), &tm, &pm, &cdm)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_restore(
    backup_path: String,
    contents: Vec<String>,
    settings: State<'_, SharedSettings>,
    terminal_manager: State<'_, SharedTerminalProfileManager>,
    profile_manager: State<'_, SharedProfileManager>,
    custom_detection_manager: State<'_, SharedCustomDetectionManager>,
) -> Result<RestoreResult, String> {
    let content_types: Vec<BackupContentType> = if contents.is_empty() {
        BackupContentType::all()
    } else {
        contents
            .iter()
            .filter_map(|s| BackupContentType::from_str(s))
            .collect()
    };

    let mut s = settings.write().await;
    let mut tm = terminal_manager.write().await;
    let mut pm = profile_manager.write().await;
    let mut cdm = custom_detection_manager.write().await;

    backup::restore_backup(
        &PathBuf::from(&backup_path),
        &content_types,
        &mut s,
        &mut tm,
        &mut pm,
        &mut cdm,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_list(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<BackupInfo>, String> {
    let s = settings.read().await;
    backup::list_backups(&s).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_delete(backup_path: String) -> Result<bool, String> {
    backup::delete_backup(&PathBuf::from(&backup_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_validate(
    backup_path: String,
) -> Result<BackupValidationResult, String> {
    backup::validate_backup(&PathBuf::from(&backup_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_export(
    backup_path: String,
    dest_path: String,
) -> Result<u64, String> {
    backup::export_backup(&PathBuf::from(&backup_path), &PathBuf::from(&dest_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_import(
    zip_path: String,
    settings: State<'_, SharedSettings>,
) -> Result<BackupInfo, String> {
    let s = settings.read().await;
    backup::import_backup(&PathBuf::from(&zip_path), &s)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_cleanup(
    max_count: u32,
    max_age_days: u32,
    settings: State<'_, SharedSettings>,
) -> Result<u32, String> {
    let s = settings.read().await;
    backup::cleanup_old_backups(&s, max_count, max_age_days)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_integrity_check(
    settings: State<'_, SharedSettings>,
) -> Result<IntegrityCheckResult, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    download_cache
        .integrity_check()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_get_info(
    settings: State<'_, SharedSettings>,
) -> Result<DatabaseInfo, String> {
    let s = settings.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);

    let download_cache = DownloadCache::open(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    download_cache
        .get_db_info()
        .await
        .map_err(|e| e.to_string())
}
