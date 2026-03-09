use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const MAX_HISTORY_ENTRIES: usize = 1000;
const HISTORY_READ_CACHE_TTL: Duration = Duration::from_secs(2);
static HISTORY_MUTATION_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
static HISTORY_READ_CACHE: Lazy<StdMutex<Option<(Instant, InstallHistory)>>> =
    Lazy::new(|| StdMutex::new(None));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallHistoryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub action: HistoryAction,
    pub timestamp: String,
    pub provider: String,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryAction {
    Install,
    Uninstall,
    Update,
    Rollback,
}

impl FromStr for HistoryAction {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "install" => Ok(Self::Install),
            "uninstall" => Ok(Self::Uninstall),
            "update" => Ok(Self::Update),
            "rollback" => Ok(Self::Rollback),
            other => Err(format!("Unsupported history action: {}", other)),
        }
    }
}

impl std::fmt::Display for HistoryAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HistoryAction::Install => write!(f, "install"),
            HistoryAction::Uninstall => write!(f, "uninstall"),
            HistoryAction::Update => write!(f, "update"),
            HistoryAction::Rollback => write!(f, "rollback"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstallHistory {
    pub entries: Vec<InstallHistoryEntry>,
}

#[derive(Debug, Clone, Default)]
pub struct HistoryQuery {
    pub limit: Option<usize>,
    pub name: Option<String>,
    pub provider: Option<String>,
    pub action: Option<HistoryAction>,
    pub success: Option<bool>,
}

impl InstallHistory {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    fn history_path() -> Option<PathBuf> {
        fs::get_cognia_dir().map(|dir| dir.join("state").join("history.json"))
    }

    pub async fn load() -> CogniaResult<Self> {
        if let Some(cached) = Self::read_cached_history() {
            return Ok(cached);
        }

        let path = Self::history_path()
            .ok_or_else(|| CogniaError::Config("Could not determine history path".into()))?;

        if !fs::exists(&path).await {
            let fresh = Self::new();
            Self::write_cached_history(&fresh);
            return Ok(fresh);
        }

        let content = fs::read_file_string(&path).await?;
        match serde_json::from_str::<InstallHistory>(&content) {
            Ok(history) => {
                Self::write_cached_history(&history);
                Ok(history)
            }
            Err(parse_err) => {
                if let Err(quarantine_err) = Self::quarantine_corrupted_file(&path).await {
                    log::warn!(
                        "Failed to quarantine malformed install history at {:?}: {}",
                        path,
                        quarantine_err
                    );
                }
                log::warn!(
                    "Recovered from malformed install history at {:?}: {}",
                    path,
                    parse_err
                );
                let recovered = Self::new();
                Self::write_cached_history(&recovered);
                Ok(recovered)
            }
        }
    }

    pub async fn save(&self) -> CogniaResult<()> {
        let path = Self::history_path()
            .ok_or_else(|| CogniaError::Config("Could not determine history path".into()))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let content = serde_json::to_string(self)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize history: {}", e)))?;

        fs::write_file_atomic(&path, content.as_bytes()).await?;
        Self::write_cached_history(self);

        Ok(())
    }

    pub fn add_entry(&mut self, entry: InstallHistoryEntry) {
        self.entries.insert(0, entry);

        // Keep only the last MAX_HISTORY_ENTRIES
        if self.entries.len() > MAX_HISTORY_ENTRIES {
            self.entries.truncate(MAX_HISTORY_ENTRIES);
        }
    }

    pub fn get_entries(&self, limit: Option<usize>) -> Vec<&InstallHistoryEntry> {
        let limit = limit.unwrap_or(100).min(self.entries.len());
        self.entries.iter().take(limit).collect()
    }

    pub fn get_package_history(&self, name: &str) -> Vec<&InstallHistoryEntry> {
        self.entries
            .iter()
            .filter(|e| e.name.eq_ignore_ascii_case(name))
            .collect()
    }

    pub fn get_last_successful_version(&self, name: &str) -> Option<&str> {
        self.entries
            .iter()
            .filter(|e| {
                e.name.eq_ignore_ascii_case(name) && e.success && e.action == HistoryAction::Install
            })
            .map(|e| e.version.as_str())
            .next()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn query_entries(&self, query: &HistoryQuery) -> Vec<&InstallHistoryEntry> {
        let max_items = query.limit.unwrap_or(100);
        if max_items == 0 {
            return Vec::new();
        }

        self.entries
            .iter()
            .filter(|entry| {
                if let Some(name) = query.name.as_deref() {
                    if !entry.name.eq_ignore_ascii_case(name) {
                        return false;
                    }
                }
                if let Some(provider) = query.provider.as_deref() {
                    if !entry.provider.eq_ignore_ascii_case(provider) {
                        return false;
                    }
                }
                if let Some(action) = query.action {
                    if entry.action != action {
                        return false;
                    }
                }
                if let Some(success) = query.success {
                    if entry.success != success {
                        return false;
                    }
                }
                true
            })
            .take(max_items)
            .collect()
    }

    async fn quarantine_corrupted_file(path: &std::path::Path) -> CogniaResult<PathBuf> {
        let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ");
        let backup_name = format!("history.corrupt.{}.json", timestamp);
        let backup_path = path.with_file_name(backup_name);
        fs::move_file(path, &backup_path).await?;
        Ok(backup_path)
    }

    fn read_cached_history() -> Option<Self> {
        let mut guard = HISTORY_READ_CACHE.lock().ok()?;
        if let Some((cached_at, history)) = guard.as_ref() {
            if cached_at.elapsed() <= HISTORY_READ_CACHE_TTL {
                return Some(history.clone());
            }
        }
        *guard = None;
        None
    }

    fn write_cached_history(history: &InstallHistory) {
        if let Ok(mut guard) = HISTORY_READ_CACHE.lock() {
            *guard = Some((Instant::now(), history.clone()));
        }
    }
}

pub struct HistoryManager;

impl HistoryManager {
    pub async fn record_install(
        name: &str,
        version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let entry = InstallHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            version: version.to_string(),
            action: HistoryAction::Install,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: provider.to_string(),
            success,
            error_message,
        };

        Self::append_entry(entry).await
    }

    pub async fn record_uninstall(
        name: &str,
        version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let entry = InstallHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            version: version.to_string(),
            action: HistoryAction::Uninstall,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: provider.to_string(),
            success,
            error_message,
        };

        Self::append_entry(entry).await
    }

    pub async fn record_update(
        name: &str,
        old_version: &str,
        new_version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let entry = InstallHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            version: format!("{} -> {}", old_version, new_version),
            action: HistoryAction::Update,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: provider.to_string(),
            success,
            error_message,
        };

        Self::append_entry(entry).await
    }

    pub async fn record_rollback(
        name: &str,
        to_version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let entry = InstallHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            version: to_version.to_string(),
            action: HistoryAction::Rollback,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: provider.to_string(),
            success,
            error_message,
        };

        Self::append_entry(entry).await
    }

    pub async fn get_history(limit: Option<usize>) -> CogniaResult<Vec<InstallHistoryEntry>> {
        Self::query_history(HistoryQuery {
            limit,
            ..Default::default()
        })
        .await
    }

    pub async fn get_package_history(name: &str) -> CogniaResult<Vec<InstallHistoryEntry>> {
        let history = InstallHistory::load().await?;
        Ok(history
            .get_package_history(name)
            .into_iter()
            .cloned()
            .collect())
    }

    pub async fn clear_history() -> CogniaResult<()> {
        let _guard = HISTORY_MUTATION_LOCK.lock().await;
        let mut history = InstallHistory::load().await?;
        history.clear();
        history.save().await?;
        Ok(())
    }

    pub async fn query_history(query: HistoryQuery) -> CogniaResult<Vec<InstallHistoryEntry>> {
        let history = InstallHistory::load().await?;
        Ok(history.query_entries(&query).into_iter().cloned().collect())
    }

    async fn append_entry(entry: InstallHistoryEntry) -> CogniaResult<()> {
        let _guard = HISTORY_MUTATION_LOCK.lock().await;
        let mut history = InstallHistory::load().await?;
        history.add_entry(entry);
        history.save().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::future::join_all;
    use std::collections::HashSet;
    use std::path::Path;
    use tokio::fs as tokio_fs;

    async fn collect_corrupt_history_files(dir: &Path) -> HashSet<String> {
        let mut files = HashSet::new();
        if let Ok(mut entries) = tokio_fs::read_dir(dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.starts_with("history.corrupt.") && file_name.ends_with(".json") {
                        files.insert(file_name.to_string());
                    }
                }
            }
        }
        files
    }

    #[test]
    fn test_history_entry_creation() {
        let entry = InstallHistoryEntry {
            id: "test-id".to_string(),
            name: "test-package".to_string(),
            version: "1.0.0".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        };

        assert_eq!(entry.name, "test-package");
        assert!(entry.success);
    }

    #[test]
    fn test_history_max_entries() {
        let mut history = InstallHistory::new();

        for i in 0..1100 {
            history.add_entry(InstallHistoryEntry {
                id: format!("id-{}", i),
                name: "pkg".to_string(),
                version: "1.0.0".to_string(),
                action: HistoryAction::Install,
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider: "test".to_string(),
                success: true,
                error_message: None,
            });
        }

        assert_eq!(history.entries.len(), MAX_HISTORY_ENTRIES);
    }

    #[tokio::test]
    async fn test_history_manager_recording() {
        // On Windows, directories::BaseDirs ignores HOME/USERPROFILE env vars,
        // so we use the real cognia dir. First clear any existing test data.
        let history_path = InstallHistory::history_path();
        if history_path.is_none() {
            // Cannot determine history path (e.g. CI without home dir) — skip
            return;
        }
        let path = history_path.unwrap();

        // Backup existing history if present
        let backup_path = path.with_extension("json.test-bak");
        let had_existing = crate::platform::fs::exists(&path).await;
        if had_existing {
            let _ = tokio::fs::copy(&path, &backup_path).await;
        }

        // Clear history for a clean test
        let _ = HistoryManager::clear_history().await;

        HistoryManager::record_install("test-lodash", "1.0.0", "npm", true, None)
            .await
            .unwrap();
        HistoryManager::record_uninstall(
            "test-lodash",
            "1.0.0",
            "npm",
            false,
            Some("error".into()),
        )
        .await
        .unwrap();

        let entries = HistoryManager::get_history(Some(2)).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].action, HistoryAction::Uninstall);
        assert_eq!(entries[1].action, HistoryAction::Install);

        // Restore original history
        if had_existing {
            let _ = tokio::fs::copy(&backup_path, &path).await;
            let _ = tokio::fs::remove_file(&backup_path).await;
        } else {
            let _ = tokio::fs::remove_file(&path).await;
        }
    }

    #[test]
    fn test_history_action_display() {
        assert_eq!(HistoryAction::Install.to_string(), "install");
        assert_eq!(HistoryAction::Uninstall.to_string(), "uninstall");
        assert_eq!(HistoryAction::Update.to_string(), "update");
        assert_eq!(HistoryAction::Rollback.to_string(), "rollback");
    }

    #[test]
    fn test_history_action_from_str() {
        assert_eq!(
            HistoryAction::from_str("install").unwrap(),
            HistoryAction::Install
        );
        assert_eq!(
            HistoryAction::from_str("ROLLBACK").unwrap(),
            HistoryAction::Rollback
        );
        assert!(HistoryAction::from_str("unknown").is_err());
    }

    #[test]
    fn test_history_action_serde_roundtrip() {
        let actions = vec![
            HistoryAction::Install,
            HistoryAction::Uninstall,
            HistoryAction::Update,
            HistoryAction::Rollback,
        ];
        for action in actions {
            let json = serde_json::to_string(&action).unwrap();
            let deser: HistoryAction = serde_json::from_str(&json).unwrap();
            assert_eq!(deser, action);
        }
    }

    #[test]
    fn test_install_history_entry_serde_roundtrip() {
        let entry = InstallHistoryEntry {
            id: "test-id".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deser: InstallHistoryEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.name, "lodash");
        assert_eq!(deser.action, HistoryAction::Install);
        assert!(deser.success);
        assert!(deser.error_message.is_none());
    }

    #[test]
    fn test_install_history_entry_with_error() {
        let entry = InstallHistoryEntry {
            id: "err-id".to_string(),
            name: "broken-pkg".to_string(),
            version: "1.0.0".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: false,
            error_message: Some("network timeout".to_string()),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("network timeout"));
    }

    #[test]
    fn test_install_history_default() {
        let history = InstallHistory::default();
        assert!(history.entries.is_empty());
    }

    #[test]
    fn test_install_history_new() {
        let history = InstallHistory::new();
        assert!(history.entries.is_empty());
    }

    #[test]
    fn test_history_add_entry_prepends() {
        let mut history = InstallHistory::new();

        history.add_entry(InstallHistoryEntry {
            id: "first".to_string(),
            name: "first-pkg".to_string(),
            version: "1.0.0".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        history.add_entry(InstallHistoryEntry {
            id: "second".to_string(),
            name: "second-pkg".to_string(),
            version: "2.0.0".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-02T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        assert_eq!(history.entries.len(), 2);
        assert_eq!(history.entries[0].name, "second-pkg");
        assert_eq!(history.entries[1].name, "first-pkg");
    }

    #[test]
    fn test_get_entries_with_limit() {
        let mut history = InstallHistory::new();
        for i in 0..10 {
            history.add_entry(InstallHistoryEntry {
                id: format!("id-{}", i),
                name: format!("pkg-{}", i),
                version: "1.0.0".to_string(),
                action: HistoryAction::Install,
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider: "npm".to_string(),
                success: true,
                error_message: None,
            });
        }

        let entries = history.get_entries(Some(3));
        assert_eq!(entries.len(), 3);

        let entries = history.get_entries(Some(100));
        assert_eq!(entries.len(), 10);

        let entries = history.get_entries(None);
        assert_eq!(entries.len(), 10);
    }

    #[test]
    fn test_get_package_history() {
        let mut history = InstallHistory::new();

        history.add_entry(InstallHistoryEntry {
            id: "1".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Install,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        history.add_entry(InstallHistoryEntry {
            id: "2".to_string(),
            name: "express".to_string(),
            version: "4.18.0".to_string(),
            action: HistoryAction::Install,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        history.add_entry(InstallHistoryEntry {
            id: "3".to_string(),
            name: "Lodash".to_string(),
            version: "4.17.22".to_string(),
            action: HistoryAction::Update,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        let lodash_history = history.get_package_history("lodash");
        assert_eq!(lodash_history.len(), 2);

        let express_history = history.get_package_history("express");
        assert_eq!(express_history.len(), 1);

        let none_history = history.get_package_history("nonexistent");
        assert!(none_history.is_empty());
    }

    #[test]
    fn test_get_last_successful_version() {
        let mut history = InstallHistory::new();

        history.add_entry(InstallHistoryEntry {
            id: "1".to_string(),
            name: "lodash".to_string(),
            version: "4.17.20".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        history.add_entry(InstallHistoryEntry {
            id: "2".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-02T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: false,
            error_message: Some("failed".into()),
        });

        // Most recent successful install (prepended order)
        let version = history.get_last_successful_version("lodash");
        assert_eq!(version, Some("4.17.20"));

        assert!(history.get_last_successful_version("nonexistent").is_none());
    }

    #[test]
    fn test_get_last_successful_version_ignores_uninstall() {
        let mut history = InstallHistory::new();

        history.add_entry(InstallHistoryEntry {
            id: "1".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Uninstall,
            timestamp: chrono::Utc::now().to_rfc3339(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        // Uninstall actions should be ignored
        assert!(history.get_last_successful_version("lodash").is_none());
    }

    #[test]
    fn test_history_clear() {
        let mut history = InstallHistory::new();
        for i in 0..5 {
            history.add_entry(InstallHistoryEntry {
                id: format!("id-{}", i),
                name: "pkg".to_string(),
                version: "1.0.0".to_string(),
                action: HistoryAction::Install,
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider: "test".to_string(),
                success: true,
                error_message: None,
            });
        }

        assert_eq!(history.entries.len(), 5);
        history.clear();
        assert!(history.entries.is_empty());
    }

    #[test]
    fn test_install_history_serde_roundtrip() {
        let mut history = InstallHistory::new();
        history.add_entry(InstallHistoryEntry {
            id: "test".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        let json = serde_json::to_string(&history).unwrap();
        let deser: InstallHistory = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.entries.len(), 1);
        assert_eq!(deser.entries[0].name, "lodash");
    }

    #[test]
    fn test_query_entries_with_filters() {
        let mut history = InstallHistory::new();
        history.add_entry(InstallHistoryEntry {
            id: "1".to_string(),
            name: "lodash".to_string(),
            version: "4.17.21".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });
        history.add_entry(InstallHistoryEntry {
            id: "2".to_string(),
            name: "flask".to_string(),
            version: "3.0.0".to_string(),
            action: HistoryAction::Update,
            timestamp: "2024-01-02T00:00:00Z".to_string(),
            provider: "pip".to_string(),
            success: false,
            error_message: Some("network timeout".into()),
        });
        history.add_entry(InstallHistoryEntry {
            id: "3".to_string(),
            name: "express".to_string(),
            version: "5.0.0".to_string(),
            action: HistoryAction::Install,
            timestamp: "2024-01-03T00:00:00Z".to_string(),
            provider: "npm".to_string(),
            success: true,
            error_message: None,
        });

        let npm_entries = history.query_entries(&HistoryQuery {
            provider: Some("NPM".to_string()),
            limit: Some(10),
            ..Default::default()
        });
        assert_eq!(npm_entries.len(), 2);
        assert_eq!(npm_entries[0].name, "express");
        assert_eq!(npm_entries[1].name, "lodash");

        let failed_updates = history.query_entries(&HistoryQuery {
            action: Some(HistoryAction::Update),
            success: Some(false),
            limit: Some(10),
            ..Default::default()
        });
        assert_eq!(failed_updates.len(), 1);
        assert_eq!(failed_updates[0].provider, "pip");
    }

    #[tokio::test]
    async fn test_history_manager_recovers_from_malformed_history_file() {
        let history_path = InstallHistory::history_path();
        if history_path.is_none() {
            return;
        }
        let path = history_path.unwrap();
        let parent = match path.parent() {
            Some(parent) => parent.to_path_buf(),
            None => return,
        };
        let existing_corrupt = collect_corrupt_history_files(&parent).await;
        let backup_path = path.with_extension("json.test-malformed-bak");
        let had_existing = crate::platform::fs::exists(&path).await;
        if had_existing {
            let _ = tokio_fs::copy(&path, &backup_path).await;
        }
        let _ = crate::platform::fs::create_dir_all(&parent).await;
        let _ = crate::platform::fs::write_file_string(&path, "{ malformed json").await;
        if let Ok(mut cache) = HISTORY_READ_CACHE.lock() {
            *cache = None;
        }

        let entries = HistoryManager::get_history(None).await.unwrap();
        assert!(entries.is_empty());
        assert!(!crate::platform::fs::exists(&path).await);

        let after_corrupt = collect_corrupt_history_files(&parent).await;
        let created: Vec<String> = after_corrupt
            .difference(&existing_corrupt)
            .cloned()
            .collect();
        assert!(
            !created.is_empty(),
            "expected at least one quarantined corrupt history file"
        );
        assert!(created
            .iter()
            .all(|file| { file.starts_with("history.corrupt.") && file.ends_with(".json") }));

        for file in created {
            let _ = crate::platform::fs::remove_file(parent.join(file)).await;
        }

        if had_existing {
            let _ = tokio_fs::copy(&backup_path, &path).await;
            let _ = tokio_fs::remove_file(&backup_path).await;
        } else {
            let _ = crate::platform::fs::remove_file(&path).await;
        }
        if let Ok(mut cache) = HISTORY_READ_CACHE.lock() {
            *cache = None;
        }
    }

    #[tokio::test]
    async fn test_history_manager_records_concurrent_entries_without_loss() {
        let history_path = InstallHistory::history_path();
        if history_path.is_none() {
            return;
        }
        let path = history_path.unwrap();
        let backup_path = path.with_extension("json.test-concurrency-bak");
        let had_existing = crate::platform::fs::exists(&path).await;
        if had_existing {
            let _ = tokio_fs::copy(&path, &backup_path).await;
        }
        let _ = HistoryManager::clear_history().await;

        let write_jobs = (0..20).map(|i| async move {
            HistoryManager::record_install(
                &format!("test-concurrent-{}", i),
                "1.0.0",
                "npm",
                true,
                None,
            )
            .await
        });
        let results = join_all(write_jobs).await;
        assert!(results.into_iter().all(|result| result.is_ok()));

        let entries = HistoryManager::get_history(Some(50)).await.unwrap();
        let concurrent: Vec<_> = entries
            .into_iter()
            .filter(|entry| entry.name.starts_with("test-concurrent-"))
            .collect();
        assert_eq!(concurrent.len(), 20);
        let unique_names = concurrent
            .iter()
            .map(|entry| entry.name.clone())
            .collect::<HashSet<_>>();
        assert_eq!(unique_names.len(), 20);

        if had_existing {
            let _ = tokio_fs::copy(&backup_path, &path).await;
            let _ = tokio_fs::remove_file(&backup_path).await;
        } else {
            let _ = crate::platform::fs::remove_file(&path).await;
        }
    }
}
