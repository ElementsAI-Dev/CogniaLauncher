use crate::platform::fs as platform_fs;
use chrono::Local;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
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
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub current_page: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub error_context: Option<FeedbackErrorContext>,
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
    pub error_context: Option<FeedbackErrorContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackSaveResult {
    pub id: String,
    pub path: String,
    pub diagnostic_path: Option<String>,
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
pub async fn feedback_save(request: FeedbackSaveRequest) -> Result<FeedbackSaveResult, String> {
    let dir = get_feedbacks_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create feedbacks dir: {e}"))?;

    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    let item = FeedbackItem {
        id: id.clone(),
        category: request.category,
        severity: request.severity,
        title: request.title,
        description: request.description,
        contact_email: request.contact_email,
        screenshot: request.screenshot,
        include_diagnostics: request.include_diagnostics,
        diagnostic_path: None,
        app_version: request.app_version,
        os: request.os,
        arch: request.arch,
        current_page: request.current_page,
        status: "saved".to_string(),
        created_at: now.clone(),
        updated_at: now,
        error_context: request.error_context,
    };

    let file_path = dir.join(format!("{id}.json"));
    let json =
        serde_json::to_string_pretty(&item).map_err(|e| format!("Failed to serialize: {e}"))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write feedback: {e}"))?;

    info!("Feedback saved: {} ({})", item.title, id);

    if let Err(e) = cleanup_old_feedbacks(&dir, MAX_FEEDBACKS_KEEP) {
        warn!("Failed to cleanup old feedbacks: {e}");
    }

    Ok(FeedbackSaveResult {
        id,
        path: file_path.to_string_lossy().to_string(),
        diagnostic_path: None,
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
    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read feedbacks dir: {e}"))?;

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
    let path = get_feedbacks_dir().join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete feedback: {e}"))?;
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

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read: {e}"))?;
    Ok(content)
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

fn cleanup_old_feedbacks(dir: &Path, keep_count: usize) -> Result<(), String> {
    if keep_count == 0 || !dir.exists() {
        return Ok(());
    }

    let mut entries: Vec<(PathBuf, SystemTime)> = Vec::new();
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
        entries.push((path, modified));
    }

    if entries.len() <= keep_count {
        return Ok(());
    }

    // Newest first
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    for (path, _) in entries.into_iter().skip(keep_count) {
        if let Err(e) = fs::remove_file(&path) {
            warn!("Failed to delete old feedback {}: {e}", path.display());
        }
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
            app_version: "0.1.0".into(),
            os: "Windows".into(),
            arch: "x86_64".into(),
            current_page: "/".into(),
            status: "saved".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            error_context: None,
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
    fn test_make_request_fields() {
        let req = make_request();
        assert_eq!(req.category, "bug");
        assert_eq!(req.severity, Some("medium".to_string()));
        assert_eq!(req.title, "Test bug");
    }
}
