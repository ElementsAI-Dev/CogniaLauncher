use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const MAX_HISTORY_ENTRIES: usize = 1000;

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
        let path = Self::history_path()
            .ok_or_else(|| CogniaError::Config("Could not determine history path".into()))?;

        if !fs::exists(&path).await {
            return Ok(Self::new());
        }

        let content = fs::read_file_string(&path).await?;
        let history: InstallHistory = serde_json::from_str(&content)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse history: {}", e)))?;

        Ok(history)
    }

    pub async fn save(&self) -> CogniaResult<()> {
        let path = Self::history_path()
            .ok_or_else(|| CogniaError::Config("Could not determine history path".into()))?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| CogniaError::Config(format!("Failed to serialize history: {}", e)))?;

        fs::write_file_atomic(&path, content.as_bytes()).await?;

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
        let mut history = InstallHistory::load().await?;

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

        history.add_entry(entry);
        history.save().await?;

        Ok(())
    }

    pub async fn record_uninstall(
        name: &str,
        version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let mut history = InstallHistory::load().await?;

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

        history.add_entry(entry);
        history.save().await?;

        Ok(())
    }

    pub async fn record_update(
        name: &str,
        old_version: &str,
        new_version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let mut history = InstallHistory::load().await?;

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

        history.add_entry(entry);
        history.save().await?;

        Ok(())
    }

    pub async fn record_rollback(
        name: &str,
        to_version: &str,
        provider: &str,
        success: bool,
        error_message: Option<String>,
    ) -> CogniaResult<()> {
        let mut history = InstallHistory::load().await?;

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

        history.add_entry(entry);
        history.save().await?;

        Ok(())
    }

    pub async fn get_history(limit: Option<usize>) -> CogniaResult<Vec<InstallHistoryEntry>> {
        let history = InstallHistory::load().await?;
        Ok(history.get_entries(limit).into_iter().cloned().collect())
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
        let mut history = InstallHistory::load().await?;
        history.clear();
        history.save().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
