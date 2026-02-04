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
                e.name.eq_ignore_ascii_case(name)
                    && e.success
                    && e.action == HistoryAction::Install
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
        Ok(history
            .get_entries(limit)
            .into_iter()
            .cloned()
            .collect())
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
    use std::env;
    use std::sync::Mutex;
    use tempfile::tempdir;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvGuard {
        old_home: Option<String>,
        old_userprofile: Option<String>,
    }

    impl EnvGuard {
        fn new() -> Self {
            let old_home = env::var("HOME").ok();
            let old_userprofile = env::var("USERPROFILE").ok();
            Self {
                old_home,
                old_userprofile,
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.old_home {
                Some(value) => env::set_var("HOME", value),
                None => env::remove_var("HOME"),
            }
            match &self.old_userprofile {
                Some(value) => env::set_var("USERPROFILE", value),
                None => env::remove_var("USERPROFILE"),
            }
        }
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
        let _lock = ENV_LOCK.lock().unwrap();
        let dir = tempdir().unwrap();
        let _env_guard = EnvGuard::new();

        env::set_var("HOME", dir.path());
        env::set_var("USERPROFILE", dir.path());

        HistoryManager::record_install("lodash", "1.0.0", "npm", true, None)
            .await
            .unwrap();
        HistoryManager::record_uninstall("lodash", "1.0.0", "npm", false, Some("error".into()))
            .await
            .unwrap();

        let entries = HistoryManager::get_history(Some(2)).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].action, HistoryAction::Uninstall);
        assert_eq!(entries[1].action, HistoryAction::Install);

    }
}
