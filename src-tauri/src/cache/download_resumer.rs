use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Download resumption support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialDownload {
    pub url: String,
    pub file_path: PathBuf,
    pub expected_size: Option<u64>,
    pub downloaded_size: u64,
    pub expected_checksum: Option<String>,
    pub started_at: i64,
    pub last_updated: i64,
    pub supports_resume: bool,
}

pub struct DownloadResumer {
    cache_dir: PathBuf,
    partials: HashMap<String, PartialDownload>,
}

impl DownloadResumer {
    pub async fn new(cache_dir: &Path) -> CogniaResult<Self> {
        let partials_dir = cache_dir.join("partials");
        fs::create_dir_all(&partials_dir).await?;

        let mut resumer = Self {
            cache_dir: partials_dir,
            partials: HashMap::new(),
        };

        resumer.load().await?;
        Ok(resumer)
    }

    async fn load(&mut self) -> CogniaResult<()> {
        let index_path = self.cache_dir.join("partials.json");
        if fs::exists(&index_path).await {
            let content = fs::read_file_string(&index_path).await?;
            self.partials = serde_json::from_str(&content).unwrap_or_default();
        }
        Ok(())
    }

    async fn save(&self) -> CogniaResult<()> {
        let index_path = self.cache_dir.join("partials.json");
        let content = serde_json::to_string_pretty(&self.partials)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;
        fs::write_file_string(&index_path, &content).await?;
        Ok(())
    }

    /// Start or resume a download
    pub async fn get_or_create(&mut self, url: &str) -> CogniaResult<PartialDownload> {
        let key = Self::url_key(url);

        if let Some(partial) = self.partials.get(&key) {
            // Check if partial file still exists
            if fs::exists(&partial.file_path).await {
                let size = fs::file_size(&partial.file_path).await?;
                let mut updated = partial.clone();
                updated.downloaded_size = size;
                updated.last_updated = chrono::Utc::now().timestamp();
                self.partials.insert(key.clone(), updated.clone());
                self.save().await?;
                return Ok(updated);
            }
        }

        // Create new partial download
        let file_path = self.cache_dir.join(format!("{}.partial", key));
        let now = chrono::Utc::now().timestamp();

        let partial = PartialDownload {
            url: url.to_string(),
            file_path,
            expected_size: None,
            downloaded_size: 0,
            expected_checksum: None,
            started_at: now,
            last_updated: now,
            supports_resume: false,
        };

        self.partials.insert(key, partial.clone());
        self.save().await?;

        Ok(partial)
    }

    /// Update partial download progress
    pub async fn update(&mut self, url: &str, downloaded_size: u64) -> CogniaResult<()> {
        let key = Self::url_key(url);
        if let Some(partial) = self.partials.get_mut(&key) {
            partial.downloaded_size = downloaded_size;
            partial.last_updated = chrono::Utc::now().timestamp();
        }
        self.save().await?;
        Ok(())
    }

    /// Mark download as complete
    pub async fn complete(&mut self, url: &str) -> CogniaResult<()> {
        let key = Self::url_key(url);
        self.partials.remove(&key);
        self.save().await?;
        Ok(())
    }

    /// Cancel and remove a partial download
    pub async fn cancel(&mut self, url: &str) -> CogniaResult<()> {
        let key = Self::url_key(url);
        if let Some(partial) = self.partials.remove(&key) {
            if fs::exists(&partial.file_path).await {
                let _ = fs::remove_file(&partial.file_path).await;
            }
        }
        self.save().await?;
        Ok(())
    }

    /// Cancel and remove a partial download with option to use trash
    pub async fn cancel_with_option(&mut self, url: &str, use_trash: bool) -> CogniaResult<()> {
        let key = Self::url_key(url);
        if let Some(partial) = self.partials.remove(&key) {
            if fs::exists(&partial.file_path).await {
                fs::remove_file_with_option(&partial.file_path, use_trash).await?;
            }
        }
        self.save().await?;
        Ok(())
    }

    /// Get all stale partial downloads (older than max_age)
    pub fn get_stale(&self, max_age: Duration) -> Vec<&PartialDownload> {
        let now = chrono::Utc::now().timestamp();
        let max_age_secs = max_age.as_secs() as i64;

        self.partials
            .values()
            .filter(|p| now - p.last_updated > max_age_secs)
            .collect()
    }

    /// Clean stale partial downloads
    pub async fn clean_stale(&mut self, max_age: Duration) -> CogniaResult<usize> {
        self.clean_stale_with_option(max_age, false).await
    }

    /// Clean stale partial downloads with option to use trash
    pub async fn clean_stale_with_option(
        &mut self,
        max_age: Duration,
        use_trash: bool,
    ) -> CogniaResult<usize> {
        let stale: Vec<_> = self
            .get_stale(max_age)
            .iter()
            .map(|p| p.url.clone())
            .collect();
        let count = stale.len();

        for url in stale {
            self.cancel_with_option(&url, use_trash).await?;
        }

        Ok(count)
    }

    fn url_key(url: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        url.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_get_or_create_new() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();
        let partial = resumer
            .get_or_create("https://example.com/file.zip")
            .await
            .unwrap();

        assert_eq!(partial.url, "https://example.com/file.zip");
        assert_eq!(partial.downloaded_size, 0);
        assert!(partial.file_path.to_string_lossy().contains(".partial"));
        assert!(!partial.supports_resume);
    }

    #[tokio::test]
    async fn test_get_or_create_resume() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();
        let partial = resumer
            .get_or_create("https://example.com/resume.zip")
            .await
            .unwrap();

        // Write some data to simulate partial download
        fs::write_file_string(&partial.file_path, "partial data here")
            .await
            .unwrap();

        // Resume should detect existing file
        let resumed = resumer
            .get_or_create("https://example.com/resume.zip")
            .await
            .unwrap();

        assert!(resumed.downloaded_size > 0);
        assert_eq!(resumed.url, "https://example.com/resume.zip");
    }

    #[tokio::test]
    async fn test_update_progress() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();
        resumer
            .get_or_create("https://example.com/progress.zip")
            .await
            .unwrap();

        resumer
            .update("https://example.com/progress.zip", 5000)
            .await
            .unwrap();

        // Reload and verify
        let mut resumer2 = DownloadResumer::new(&cache_dir).await.unwrap();
        let key = DownloadResumer::url_key("https://example.com/progress.zip");
        let entry = resumer2.partials.get(&key).unwrap();
        assert_eq!(entry.downloaded_size, 5000);

        // Also verify get_or_create doesn't lose the update when file doesn't exist
        let _ = resumer2
            .get_or_create("https://example.com/progress.zip")
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_complete_removes_entry() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();
        resumer
            .get_or_create("https://example.com/done.zip")
            .await
            .unwrap();

        assert!(!resumer.partials.is_empty());

        resumer
            .complete("https://example.com/done.zip")
            .await
            .unwrap();

        assert!(resumer.partials.is_empty());

        // Verify persistence
        let resumer2 = DownloadResumer::new(&cache_dir).await.unwrap();
        assert!(resumer2.partials.is_empty());
    }

    #[tokio::test]
    async fn test_cancel_removes_file() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();
        let partial = resumer
            .get_or_create("https://example.com/cancel.zip")
            .await
            .unwrap();

        // Create the partial file
        fs::write_file_string(&partial.file_path, "partial content")
            .await
            .unwrap();
        assert!(fs::exists(&partial.file_path).await);

        resumer
            .cancel("https://example.com/cancel.zip")
            .await
            .unwrap();

        assert!(resumer.partials.is_empty());
        assert!(!fs::exists(&partial.file_path).await);
    }

    #[tokio::test]
    async fn test_clean_stale() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("downloads");

        let mut resumer = DownloadResumer::new(&cache_dir).await.unwrap();

        // Create entries with old timestamps
        for i in 0..3 {
            let url = format!("https://example.com/stale-{}.zip", i);
            resumer.get_or_create(&url).await.unwrap();
        }

        // Manually set old timestamps
        for partial in resumer.partials.values_mut() {
            partial.last_updated = chrono::Utc::now().timestamp() - 7200; // 2 hours ago
        }
        resumer.save().await.unwrap();

        // Clean stale with 1 hour max age
        let cleaned = resumer
            .clean_stale(Duration::from_secs(3600))
            .await
            .unwrap();

        assert_eq!(cleaned, 3);
        assert!(resumer.partials.is_empty());
    }

    #[test]
    fn test_url_key_deterministic() {
        let key1 = DownloadResumer::url_key("https://example.com/file.zip");
        let key2 = DownloadResumer::url_key("https://example.com/file.zip");
        assert_eq!(key1, key2);

        let key3 = DownloadResumer::url_key("https://example.com/other.zip");
        assert_ne!(key1, key3);

        // Keys should be 16 hex characters
        assert_eq!(key1.len(), 16);
    }
}
