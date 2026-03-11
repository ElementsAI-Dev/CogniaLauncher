use crate::cache::{DatabaseInfo, DownloadCache, IntegrityCheckResult};
use crate::commands::config::SharedSettings;
use crate::commands::custom_detection::SharedCustomDetectionManager;
use crate::commands::terminal::SharedTerminalProfileManager;
use crate::core::backup::{
    self, BackupCleanupResult, BackupContentType, BackupDeleteResult, BackupExportResult,
    BackupImportResult, BackupInfo, BackupManifest, BackupOperationIssue, BackupOperationStatus,
    BackupResult, BackupValidationResult, RestoreResult,
};
use crate::core::profiles::SharedProfileManager;
use chrono::Utc;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

fn parse_content_types(contents: &[String]) -> (Vec<BackupContentType>, Vec<String>) {
    if contents.is_empty() {
        return (BackupContentType::all(), vec![]);
    }

    let mut parsed = Vec::new();
    let mut invalid = Vec::new();
    for item in contents {
        match BackupContentType::from_str(item) {
            Some(kind) => parsed.push(kind),
            None => invalid.push(item.clone()),
        }
    }
    (parsed, invalid)
}

fn invalid_content_issues(invalid_contents: &[String]) -> Vec<BackupOperationIssue> {
    invalid_contents
        .iter()
        .map(|value| BackupOperationIssue {
            code: "invalid_content_type".to_string(),
            message: format!("Unsupported backup content type: {}", value),
            content_type: Some(value.clone()),
        })
        .collect()
}

fn fallback_manifest(note: Option<String>) -> BackupManifest {
    BackupManifest {
        format_version: 1,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: Utc::now().to_rfc3339(),
        platform: std::env::consts::OS.to_string(),
        hostname: "unknown".to_string(),
        contents: vec![],
        file_checksums: HashMap::new(),
        total_size: 0,
        note,
        auto_generated: false,
    }
}

#[tauri::command]
pub async fn backup_create(
    contents: Vec<String>,
    note: Option<String>,
    settings: State<'_, SharedSettings>,
    terminal_manager: State<'_, SharedTerminalProfileManager>,
    profile_manager: State<'_, SharedProfileManager>,
    custom_detection_manager: State<'_, SharedCustomDetectionManager>,
) -> Result<BackupResult, String> {
    let (content_types, invalid_contents) = parse_content_types(&contents);
    if !invalid_contents.is_empty() {
        let msg = format!(
            "Unsupported backup content types: {}",
            invalid_contents.join(", ")
        );
        return Ok(BackupResult {
            success: false,
            status: BackupOperationStatus::Failed,
            reason_code: Some("invalid_content_types".to_string()),
            issues: invalid_content_issues(&invalid_contents),
            path: String::new(),
            manifest: fallback_manifest(note.clone()),
            duration_ms: 0,
            error: Some(msg),
        });
    }

    let s = settings.read().await;
    let tm = terminal_manager.read().await;
    let pm = profile_manager.read().await;
    let cdm = custom_detection_manager.read().await;

    Ok(backup::create_backup_with_result(
        &s,
        &content_types,
        note.as_deref(),
        &tm,
        &pm,
        &cdm,
    )
    .await)
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
    let (content_types, invalid_contents) = parse_content_types(&contents);
    if !invalid_contents.is_empty() {
        return Ok(RestoreResult {
            success: false,
            status: BackupOperationStatus::Failed,
            reason_code: Some("invalid_content_types".to_string()),
            issues: invalid_content_issues(&invalid_contents),
            restored: vec![],
            skipped: vec![],
            error: Some(format!(
                "Unsupported backup content types: {}",
                invalid_contents.join(", ")
            )),
        });
    }

    let mut s = settings.write().await;
    let mut tm = terminal_manager.write().await;
    let mut pm = profile_manager.write().await;
    let mut cdm = custom_detection_manager.write().await;

    Ok(backup::restore_backup_with_result(
        &PathBuf::from(&backup_path),
        &content_types,
        &mut s,
        &mut tm,
        &mut pm,
        &mut cdm,
    )
    .await)
}

#[tauri::command]
pub async fn backup_list(settings: State<'_, SharedSettings>) -> Result<Vec<BackupInfo>, String> {
    let s = settings.read().await;
    backup::list_backups(&s).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_delete(backup_path: String) -> Result<BackupDeleteResult, String> {
    let result = backup::delete_backup_with_result(&PathBuf::from(&backup_path)).await;
    Ok(result)
}

#[tauri::command]
pub async fn backup_validate(backup_path: String) -> Result<BackupValidationResult, String> {
    match backup::validate_backup(&PathBuf::from(&backup_path)).await {
        Ok(result) => Ok(result),
        Err(e) => Ok(BackupValidationResult {
            valid: false,
            status: BackupOperationStatus::Failed,
            reason_code: Some("backup_validate_failed".to_string()),
            issues: vec![BackupOperationIssue {
                code: "backup_validate_failed".to_string(),
                message: e.to_string(),
                content_type: None,
            }],
            manifest: None,
            missing_files: vec![],
            checksum_mismatches: vec![],
            errors: vec![e.to_string()],
        }),
    }
}

#[tauri::command]
pub async fn backup_export(
    backup_path: String,
    dest_path: String,
) -> Result<BackupExportResult, String> {
    Ok(
        backup::export_backup_with_result(&PathBuf::from(&backup_path), &PathBuf::from(&dest_path))
            .await,
    )
}

#[tauri::command]
pub async fn backup_import(
    zip_path: String,
    settings: State<'_, SharedSettings>,
) -> Result<BackupImportResult, String> {
    let s = settings.read().await;
    Ok(backup::import_backup_with_result(&PathBuf::from(&zip_path), &s).await)
}

#[tauri::command]
pub async fn backup_cleanup(
    max_count: u32,
    max_age_days: u32,
    settings: State<'_, SharedSettings>,
) -> Result<BackupCleanupResult, String> {
    let s = settings.read().await;
    Ok(backup::cleanup_old_backups_with_result(&s, max_count, max_age_days).await)
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
pub async fn db_get_info(settings: State<'_, SharedSettings>) -> Result<DatabaseInfo, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_content_types_defaults_to_all_when_empty() {
        let (parsed, invalid) = parse_content_types(&[]);
        assert_eq!(parsed.len(), BackupContentType::all().len());
        assert!(invalid.is_empty());
    }

    #[test]
    fn test_parse_content_types_collects_invalid_values() {
        let (parsed, invalid) = parse_content_types(&[
            "config".to_string(),
            "invalid_item".to_string(),
            "cache_database".to_string(),
        ]);
        assert_eq!(parsed.len(), 2);
        assert_eq!(invalid, vec!["invalid_item".to_string()]);
    }

    #[test]
    fn test_invalid_content_issues_include_content_type() {
        let issues = invalid_content_issues(&["bad-type".to_string()]);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, "invalid_content_type");
        assert_eq!(issues[0].content_type.as_deref(), Some("bad-type"));
    }
}
