use crate::commands::config::SharedSettings;
use crate::commands::diagnostic::{
    diagnostic_export_bundle, DiagnosticExportOptions, ErrorContext,
};
use crate::platform::fs as platform_fs;
use chrono::Local;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, State};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackItem {
    pub id: String,
    pub category: String,
    pub severity: Option<String>,
    pub title: String,
    pub description: String,
    pub contact_email: Option<String>,
    pub screenshot: Option<String>,
    pub include_diagnostics: bool,
    pub diagnostic_path: Option<String>,
    pub diagnostic_error: Option<String>,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub current_page: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub error_context: Option<FeedbackErrorContext>,
    pub release_context: Option<FeedbackReleaseContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackErrorContext {
    pub message: Option<String>,
    pub stack: Option<String>,
    pub component: Option<String>,
    pub digest: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackReleaseContext {
    pub version: String,
    pub date: String,
    pub source: String,
    pub trigger: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackSaveRequest {
    pub category: String,
    pub severity: Option<String>,
    pub title: String,
    pub description: String,
    pub contact_email: Option<String>,
    pub screenshot: Option<String>,
    pub include_diagnostics: bool,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub current_page: String,
    pub release_context: Option<FeedbackReleaseContext>,
    pub error_context: Option<FeedbackErrorContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackSaveResult {
    pub id: String,
    pub path: String,
    pub diagnostic_path: Option<String>,
    pub diagnostic_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackListResult {
    pub items: Vec<FeedbackItem>,
    pub total: usize,
}

const MAX_FEEDBACKS_KEEP: usize = 100;

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn feedback_save(
    app: AppHandle,
    settings: State<'_, SharedSettings>,
    request: FeedbackSaveRequest,
) -> Result<FeedbackSaveResult, String> {
    let dir = get_feedbacks_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create feedbacks dir: {e}"))?;

    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    let mut item = FeedbackItem {
        id: id.clone(),
        category: request.category.clone(),
        severity: request.severity.clone(),
        title: request.title.clone(),
        description: request.description.clone(),
        contact_email: request.contact_email.clone(),
        screenshot: request.screenshot.clone(),
        include_diagnostics: request.include_diagnostics,
        diagnostic_path: None,
        diagnostic_error: None,
        app_version: request.app_version.clone(),
        os: request.os.clone(),
        arch: request.arch.clone(),
        current_page: request.current_page.clone(),
        status: "saved".to_string(),
        created_at: now.clone(),
        updated_at: now,
        error_context: request.error_context.clone(),
        release_context: request.release_context.clone(),
    };

    let file_path = dir.join(format!("{id}.json"));
    save_feedback_item(&file_path, &item)?;

    let diagnostics_outcome =
        maybe_export_feedback_diagnostics(&id, &request, &dir, app, settings).await;
    apply_diagnostics_outcome(&mut item, diagnostics_outcome);
    save_feedback_item(&file_path, &item)?;

    info!("Feedback saved: {} ({})", item.title, id);

    if let Err(e) = cleanup_old_feedbacks(&dir, MAX_FEEDBACKS_KEEP) {
        warn!("Failed to cleanup old feedbacks: {e}");
    }

    Ok(FeedbackSaveResult {
        id,
        path: file_path.to_string_lossy().to_string(),
        diagnostic_path: item.diagnostic_path.clone(),
        diagnostic_error: item.diagnostic_error.clone(),
    })
}

#[tauri::command]
pub fn feedback_list() -> Result<FeedbackListResult, String> {
    let dir = get_feedbacks_dir();
    if !dir.exists() {
        return Ok(FeedbackListResult {
            items: Vec::new(),
            total: 0,
        });
    }

    let mut items: Vec<FeedbackItem> = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read feedbacks dir: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<FeedbackItem>(&content) {
                    Ok(item) => items.push(item),
                    Err(e) => warn!("Failed to parse feedback {}: {e}", path.display()),
                },
                Err(e) => warn!("Failed to read feedback {}: {e}", path.display()),
            }
        }
    }

    // Sort by created_at descending (newest first)
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let total = items.len();

    Ok(FeedbackListResult { items, total })
}

#[tauri::command]
pub fn feedback_get(id: String) -> Result<Option<FeedbackItem>, String> {
    let path = get_feedbacks_dir().join(format!("{id}.json"));
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read: {e}"))?;
    let item: FeedbackItem =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse: {e}"))?;
    Ok(Some(item))
}

#[tauri::command]
pub fn feedback_delete(id: String) -> Result<(), String> {
    let dir = get_feedbacks_dir();
    let path = dir.join(format!("{id}.json"));
    let attachment_path = read_feedback_item(&path)
        .ok()
        .and_then(|item| item.diagnostic_path.clone());
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete feedback: {e}"))?;
        cleanup_feedback_attachments(&dir, &id, attachment_path.as_deref());
        info!("Feedback deleted: {id}");
    }
    Ok(())
}

#[tauri::command]
pub fn feedback_export(id: String) -> Result<String, String> {
    let path = get_feedbacks_dir().join(format!("{id}.json"));
    if !path.exists() {
        return Err("Feedback not found".to_string());
    }

    let mut item = read_feedback_item(&path)?;
    mark_feedback_exported(&mut item);
    save_feedback_item(&path, &item)?;
    serde_json::to_string_pretty(&item).map_err(|e| format!("Failed to serialize: {e}"))
}

#[tauri::command]
pub fn feedback_count() -> Result<usize, String> {
    let dir = get_feedbacks_dir();
    if !dir.exists() {
        return Ok(0);
    }

    let count = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read dir: {e}"))?
        .flatten()
        .filter(|e| {
            e.path().is_file() && e.path().extension().and_then(|e| e.to_str()) == Some("json")
        })
        .count();

    Ok(count)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn get_feedbacks_dir() -> PathBuf {
    platform_fs::get_cognia_dir()
        .unwrap_or_else(|| PathBuf::from(".CogniaLauncher"))
        .join("feedbacks")
}

fn save_feedback_item(path: &Path, item: &FeedbackItem) -> Result<(), String> {
    let json =
        serde_json::to_string_pretty(item).map_err(|e| format!("Failed to serialize: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write feedback: {e}"))
}

fn read_feedback_item(path: &Path) -> Result<FeedbackItem, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse: {e}"))
}

async fn maybe_export_feedback_diagnostics(
    id: &str,
    request: &FeedbackSaveRequest,
    feedback_dir: &Path,
    app: AppHandle,
    settings: State<'_, SharedSettings>,
) -> Result<Option<String>, String> {
    if !request.include_diagnostics {
        return Ok(None);
    }

    let output_path = feedback_dir.join(format!("{id}-diagnostic.zip"));
    let error_context = request.error_context.as_ref().map(|ctx| ErrorContext {
        message: ctx.message.clone(),
        stack: ctx.stack.clone(),
        component: ctx.component.clone(),
        timestamp: Some(Local::now().to_rfc3339()),
        extra: Some(json!({ "digest": ctx.digest })),
    });
    let options = DiagnosticExportOptions {
        output_path: Some(output_path.to_string_lossy().to_string()),
        include_config: Some(true),
        error_context,
    };

    diagnostic_export_bundle(app, options, settings)
        .await
        .map(|result| Some(result.path))
}

fn apply_diagnostics_outcome(item: &mut FeedbackItem, outcome: Result<Option<String>, String>) {
    match outcome {
        Ok(Some(path)) => {
            item.diagnostic_path = Some(path);
            item.diagnostic_error = None;
            item.updated_at = Local::now().to_rfc3339();
        }
        Ok(None) => {
            item.diagnostic_path = None;
            item.diagnostic_error = None;
        }
        Err(error) => {
            warn!(
                "Failed to attach diagnostics for feedback {}: {error}",
                item.id
            );
            item.diagnostic_path = None;
            item.diagnostic_error = Some(error);
            item.updated_at = Local::now().to_rfc3339();
        }
    }
}

fn mark_feedback_exported(item: &mut FeedbackItem) {
    item.status = "exported".to_string();
    item.updated_at = Local::now().to_rfc3339();
}

fn cleanup_feedback_attachments(dir: &Path, id: &str, explicit_path: Option<&str>) {
    if let Some(path) = explicit_path {
        if let Err(e) = fs::remove_file(path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                warn!("Failed to delete feedback diagnostic {}: {e}", path);
            }
        }
    }

    let prefix = format!("{id}-diagnostic.");
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !name.starts_with(&prefix) {
                continue;
            }
            if let Err(e) = fs::remove_file(&path) {
                if e.kind() != std::io::ErrorKind::NotFound {
                    warn!(
                        "Failed to delete feedback attachment {}: {e}",
                        path.display()
                    );
                }
            }
        }
    }
}

fn cleanup_old_feedbacks(dir: &Path, keep_count: usize) -> Result<(), String> {
    if keep_count == 0 || !dir.exists() {
        return Ok(());
    }

    let mut entries: Vec<(PathBuf, SystemTime, Option<String>)> = Vec::new();
    let dir_entries =
        fs::read_dir(dir).map_err(|e| format!("Failed to read feedbacks dir: {e}"))?;

    for entry in dir_entries.flatten() {
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let diagnostic_path = read_feedback_item(&path)
            .ok()
            .and_then(|item| item.diagnostic_path.clone());
        entries.push((path, modified, diagnostic_path));
    }

    if entries.len() <= keep_count {
        return Ok(());
    }

    // Newest first
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    for (path, _, diagnostic_path) in entries.into_iter().skip(keep_count) {
        let id = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_string();
        if let Err(e) = fs::remove_file(&path) {
            warn!("Failed to delete old feedback {}: {e}", path.display());
            continue;
        }
        cleanup_feedback_attachments(dir, &id, diagnostic_path.as_deref());
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_request() -> FeedbackSaveRequest {
        FeedbackSaveRequest {
            category: "bug".to_string(),
            severity: Some("medium".to_string()),
            title: "Test bug".to_string(),
            description: "Something is broken".to_string(),
            contact_email: Some("test@example.com".to_string()),
            screenshot: None,
            include_diagnostics: false,
            app_version: "0.1.0".to_string(),
            os: "Windows".to_string(),
            arch: "x86_64".to_string(),
            current_page: "/dashboard".to_string(),
            release_context: None,
            error_context: None,
        }
    }

    #[test]
    fn test_feedback_item_serialization() {
        let item = FeedbackItem {
            id: "test-id".into(),
            category: "bug".into(),
            severity: Some("high".into()),
            title: "Test".into(),
            description: "Desc".into(),
            contact_email: None,
            screenshot: None,
            include_diagnostics: false,
            diagnostic_path: None,
            diagnostic_error: None,
            app_version: "0.1.0".into(),
            os: "Windows".into(),
            arch: "x86_64".into(),
            current_page: "/".into(),
            status: "saved".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            error_context: None,
            release_context: None,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"category\":\"bug\""));
        assert!(json.contains("\"includeDiagnostics\":false"));
    }

    #[test]
    fn test_feedback_save_request_deserialization() {
        let json = r#"{
            "category": "feature",
            "title": "Add dark mode",
            "description": "Please add dark mode",
            "includeDiagnostics": true,
            "appVersion": "0.1.0",
            "os": "macOS",
            "arch": "arm64",
            "currentPage": "/settings"
        }"#;

        let req: FeedbackSaveRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.category, "feature");
        assert!(req.include_diagnostics);
        assert!(req.severity.is_none());
    }

    #[test]
    fn test_feedback_save_request_deserializes_optional_release_context() {
        let json = r#"{
            "category": "bug",
            "title": "Broken release",
            "description": "Something regressed",
            "includeDiagnostics": false,
            "appVersion": "0.1.0",
            "os": "Windows",
            "arch": "x86_64",
            "currentPage": "/about",
            "releaseContext": {
                "version": "1.2.3",
                "date": "2026-03-16",
                "source": "remote",
                "trigger": "changelog",
                "url": "https://github.com/test/releases/tag/v1.2.3"
            }
        }"#;

        let req: FeedbackSaveRequest = serde_json::from_str(json).unwrap();
        let release_context = req
            .release_context
            .expect("release context should deserialize");
        assert_eq!(release_context.version, "1.2.3");
        assert_eq!(release_context.trigger, "changelog");
        assert_eq!(release_context.source, "remote");
    }

    #[test]
    fn test_feedback_item_deserializes_without_release_context_for_backward_compatibility() {
        let json = r#"{
            "id": "fb-legacy",
            "category": "bug",
            "severity": "high",
            "title": "Legacy item",
            "description": "Saved before release context existed",
            "contactEmail": null,
            "screenshot": null,
            "includeDiagnostics": false,
            "diagnosticPath": null,
            "diagnosticError": null,
            "appVersion": "0.1.0",
            "os": "Windows",
            "arch": "x86_64",
            "currentPage": "/about",
            "status": "saved",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T00:00:00Z",
            "errorContext": null
        }"#;

        let item: FeedbackItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.id, "fb-legacy");
        assert!(item.release_context.is_none());
    }

    #[test]
    fn test_cleanup_old_feedbacks() {
        let dir = tempdir().unwrap();

        for i in 0..15 {
            let path = dir.path().join(format!("feedback-{i}.json"));
            fs::write(&path, "{}").unwrap();
        }

        cleanup_old_feedbacks(dir.path(), 10).unwrap();

        let remaining: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|e| e.path().extension().and_then(|e| e.to_str()) == Some("json"))
            .collect();

        assert_eq!(remaining.len(), 10);
    }

    #[test]
    fn test_apply_diagnostics_outcome_success() {
        let mut item = FeedbackItem {
            id: "test-id".into(),
            category: "bug".into(),
            severity: Some("high".into()),
            title: "Test".into(),
            description: "Desc".into(),
            contact_email: None,
            screenshot: None,
            include_diagnostics: true,
            diagnostic_path: None,
            diagnostic_error: Some("old".into()),
            app_version: "0.1.0".into(),
            os: "Windows".into(),
            arch: "x86_64".into(),
            current_page: "/".into(),
            status: "saved".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            error_context: None,
            release_context: None,
        };

        apply_diagnostics_outcome(&mut item, Ok(Some("C:/diag.zip".into())));
        assert_eq!(item.diagnostic_path, Some("C:/diag.zip".into()));
        assert_eq!(item.diagnostic_error, None);
    }

    #[test]
    fn test_apply_diagnostics_outcome_failure() {
        let mut item = FeedbackItem {
            id: "test-id".into(),
            category: "bug".into(),
            severity: Some("high".into()),
            title: "Test".into(),
            description: "Desc".into(),
            contact_email: None,
            screenshot: None,
            include_diagnostics: true,
            diagnostic_path: None,
            diagnostic_error: None,
            app_version: "0.1.0".into(),
            os: "Windows".into(),
            arch: "x86_64".into(),
            current_page: "/".into(),
            status: "saved".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            error_context: None,
            release_context: None,
        };

        apply_diagnostics_outcome(&mut item, Err("zip failed".into()));
        assert_eq!(item.diagnostic_path, None);
        assert_eq!(item.diagnostic_error, Some("zip failed".into()));
        assert_eq!(item.status, "saved");
    }

    #[test]
    fn test_cleanup_old_feedbacks_removes_diagnostic_attachments() {
        let dir = tempdir().unwrap();
        for i in 0..3 {
            let id = format!("feedback-{i}");
            let item = FeedbackItem {
                id: id.clone(),
                category: "bug".into(),
                severity: Some("medium".into()),
                title: format!("title-{i}"),
                description: "desc".into(),
                contact_email: None,
                screenshot: None,
                include_diagnostics: true,
                diagnostic_path: Some(
                    dir.path()
                        .join(format!("{id}-diagnostic.zip"))
                        .to_string_lossy()
                        .to_string(),
                ),
                diagnostic_error: None,
                app_version: "0.1.0".into(),
                os: "Windows".into(),
                arch: "x86_64".into(),
                current_page: "/".into(),
                status: "saved".into(),
                created_at: format!("2026-01-01T00:00:0{i}Z"),
                updated_at: format!("2026-01-01T00:00:0{i}Z"),
                error_context: None,
                release_context: None,
            };
            let json_path = dir.path().join(format!("{id}.json"));
            let attachment_path = dir.path().join(format!("{id}-diagnostic.zip"));
            fs::write(&json_path, serde_json::to_string_pretty(&item).unwrap()).unwrap();
            fs::write(attachment_path, b"zip").unwrap();
        }

        cleanup_old_feedbacks(dir.path(), 1).unwrap();

        let remaining_json = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("json"))
            .count();
        let remaining_attachments = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("zip"))
            .count();

        assert_eq!(remaining_json, 1);
        assert_eq!(remaining_attachments, 1);
    }

    #[test]
    fn test_mark_feedback_exported_updates_status_and_timestamp() {
        let mut item = FeedbackItem {
            id: "test-id".into(),
            category: "bug".into(),
            severity: Some("high".into()),
            title: "Test".into(),
            description: "Desc".into(),
            contact_email: None,
            screenshot: None,
            include_diagnostics: false,
            diagnostic_path: None,
            diagnostic_error: None,
            app_version: "0.1.0".into(),
            os: "Windows".into(),
            arch: "x86_64".into(),
            current_page: "/".into(),
            status: "saved".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            error_context: None,
            release_context: None,
        };

        mark_feedback_exported(&mut item);
        assert_eq!(item.status, "exported");
        assert_ne!(item.updated_at, "2026-01-01T00:00:00Z");
        assert_eq!(item.created_at, "2026-01-01T00:00:00Z");
    }

    #[test]
    fn test_make_request_fields() {
        let req = make_request();
        assert_eq!(req.category, "bug");
        assert_eq!(req.severity, Some("medium".to_string()));
        assert_eq!(req.title, "Test bug");
    }
}
