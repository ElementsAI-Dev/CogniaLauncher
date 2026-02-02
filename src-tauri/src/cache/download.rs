use super::db::{CacheDb, CacheEntry, CacheEntryType};
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    fs,
    network::{DownloadProgress, HttpClient},
};
use std::path::{Path, PathBuf};

pub struct DownloadCache {
    cache_dir: PathBuf,
    db: CacheDb,
}

impl DownloadCache {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let downloads_dir = cache_dir.join("downloads");
        fs::create_dir_all(&downloads_dir).await?;

        let db = CacheDb::open(cache_dir).await?;

        Ok(Self {
            cache_dir: downloads_dir,
            db,
        })
    }

    pub fn get_by_checksum(&mut self, checksum: &str) -> Option<PathBuf> {
        self.db
            .get_by_checksum(checksum)
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone())
    }

    pub fn get(&mut self, key: &str) -> Option<PathBuf> {
        self.db
            .get(key)
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone())
    }

    pub async fn download<F>(
        &mut self,
        url: &str,
        expected_checksum: Option<&str>,
        on_progress: Option<F>,
    ) -> CogniaResult<PathBuf>
    where
        F: FnMut(DownloadProgress),
    {
        if let Some(checksum) = expected_checksum {
            if let Some(cached_path) = self.get_by_checksum(checksum) {
                if fs::exists(&cached_path).await {
                    self.db.touch(&format!("checksum:{}", checksum)).await?;
                    return Ok(cached_path);
                }
            }
        }

        let temp_path = self
            .cache_dir
            .join(format!(".download-{}.tmp", uuid::Uuid::new_v4()));

        let client = HttpClient::new();
        let downloaded_size = client.download(url, &temp_path, on_progress).await?;

        let actual_checksum = fs::calculate_sha256(&temp_path).await?;

        if let Some(expected) = expected_checksum {
            if actual_checksum != expected {
                fs::remove_file(&temp_path).await?;
                return Err(CogniaError::ChecksumMismatch {
                    expected: expected.to_string(),
                    actual: actual_checksum,
                });
            }
        }

        let final_path = self.cache_dir.join(&actual_checksum);
        fs::move_file(&temp_path, &final_path).await?;

        let entry = CacheEntry::new(
            format!("checksum:{}", actual_checksum),
            &final_path,
            downloaded_size,
            &actual_checksum,
            CacheEntryType::Download,
        );

        self.db.insert(entry).await?;

        Ok(final_path)
    }

    pub async fn add_file(&mut self, source: &Path, checksum: &str) -> CogniaResult<PathBuf> {
        let target_path = self.cache_dir.join(checksum);

        if fs::exists(&target_path).await {
            return Ok(target_path);
        }

        fs::copy_file(source, &target_path).await?;
        let size = fs::file_size(&target_path).await?;

        let entry = CacheEntry::new(
            format!("checksum:{}", checksum),
            &target_path,
            size,
            checksum,
            CacheEntryType::Download,
        );

        self.db.insert(entry).await?;

        Ok(target_path)
    }

    pub async fn verify(&mut self, checksum: &str) -> CogniaResult<bool> {
        if let Some(path) = self.get_by_checksum(checksum) {
            if fs::exists(&path).await {
                let actual = fs::calculate_sha256(&path).await?;
                return Ok(actual == checksum);
            }
        }
        Ok(false)
    }

    pub async fn remove(&mut self, checksum: &str) -> CogniaResult<bool> {
        let key = format!("checksum:{}", checksum);

        if let Some(entry) = self.db.get(&key) {
            let path = entry.file_path.clone();
            if fs::exists(&path).await {
                fs::remove_file(&path).await?;
            }
        }

        self.db.remove(&key).await
    }

    pub async fn clean(&mut self) -> CogniaResult<u64> {
        self.clean_with_option(false).await
    }

    /// Clean all download cache entries with option to use trash
    pub async fn clean_with_option(&mut self, use_trash: bool) -> CogniaResult<u64> {
        let mut total_freed = 0u64;

        let entries: Vec<CacheEntry> = self
            .db
            .list()
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .cloned()
            .collect();

        for entry in entries {
            if fs::exists(&entry.file_path).await {
                total_freed += entry.size;
                fs::remove_file_with_option(&entry.file_path, use_trash).await?;
            }
            self.db.remove(&entry.key).await?;
        }

        Ok(total_freed)
    }

    /// Get list of entries that would be cleaned (for preview)
    pub fn preview_clean(&self) -> Vec<&CacheEntry> {
        self.db
            .list()
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect()
    }

    pub async fn evict_to_size(&mut self, max_size: u64) -> CogniaResult<usize> {
        self.db.evict_to_size(max_size).await
    }

    pub async fn stats(&self) -> DownloadCacheStats {
        let binding = self.db.list();
        let entries: Vec<_> = binding
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect();

        let total_size = entries.iter().map(|e| e.size).sum();
        let entry_count = entries.len();

        DownloadCacheStats {
            total_size,
            entry_count,
            location: self.cache_dir.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DownloadCacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub location: PathBuf,
}

impl DownloadCacheStats {
    pub fn size_human(&self) -> String {
        const KB: u64 = 1024;
        const MB: u64 = KB * 1024;
        const GB: u64 = MB * 1024;

        if self.total_size >= GB {
            format!("{:.2} GB", self.total_size as f64 / GB as f64)
        } else if self.total_size >= MB {
            format!("{:.2} MB", self.total_size as f64 / MB as f64)
        } else if self.total_size >= KB {
            format!("{:.2} KB", self.total_size as f64 / KB as f64)
        } else {
            format!("{} B", self.total_size)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_add_and_get_file() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("test.txt");
        fs::write_file_string(&test_file, "test content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();

        let cached_path = cache.add_file(&test_file, &checksum).await.unwrap();
        assert!(fs::exists(&cached_path).await);

        let retrieved = cache.get_by_checksum(&checksum);
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_size_human() {
        let stats = DownloadCacheStats {
            total_size: 1536,
            entry_count: 1,
            location: PathBuf::new(),
        };
        assert_eq!(stats.size_human(), "1.50 KB");

        let stats = DownloadCacheStats {
            total_size: 1572864,
            entry_count: 1,
            location: PathBuf::new(),
        };
        assert_eq!(stats.size_human(), "1.50 MB");
    }

    #[tokio::test]
    async fn test_get_by_key() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("key-test.txt");
        fs::write_file_string(&test_file, "key test content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        // Get by key format used internally
        let key = format!("checksum:{}", checksum);
        let retrieved = cache.get(&key);
        assert!(retrieved.is_some());
    }

    #[tokio::test]
    async fn test_verify_checksum() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("verify-test.txt");
        fs::write_file_string(&test_file, "verify content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        // Verify should pass for valid checksum
        let is_valid = cache.verify(&checksum).await.unwrap();
        assert!(is_valid);

        // Verify should fail for non-existent checksum
        let is_valid = cache.verify("nonexistent").await.unwrap();
        assert!(!is_valid);
    }

    #[tokio::test]
    async fn test_remove_file() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("remove-test.txt");
        fs::write_file_string(&test_file, "remove content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        let cached_path = cache.add_file(&test_file, &checksum).await.unwrap();
        assert!(fs::exists(&cached_path).await);

        // Remove the file
        let removed = cache.remove(&checksum).await.unwrap();
        assert!(removed);

        // File should be gone
        assert!(!fs::exists(&cached_path).await);

        // Get should return None
        assert!(cache.get_by_checksum(&checksum).is_none());
    }

    #[tokio::test]
    async fn test_clean_cache() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add multiple files
        for i in 0..3 {
            let test_file = dir.path().join(format!("clean-test-{}.txt", i));
            fs::write_file_string(&test_file, &format!("content {}", i))
                .await
                .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 3);

        // Clean all
        let freed = cache.clean().await.unwrap();
        assert!(freed > 0);

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_evict_to_size() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add files with unique content (different checksums)
        for i in 0..5 {
            let test_file = dir.path().join(format!("evict-test-{}.txt", i));
            // Unique content for each file to get different checksums
            fs::write_file_string(&test_file, &format!("unique content {}: {}", i, "x".repeat(100)))
                .await
                .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        let stats_before = cache.stats().await;
        assert!(stats_before.entry_count >= 3, "Expected at least 3 entries, got {}", stats_before.entry_count);
        assert!(stats_before.total_size > 0);

        // Evict to smaller size - use a size smaller than total
        let target_size = stats_before.total_size / 3;
        let evicted = cache.evict_to_size(target_size).await.unwrap();
        assert!(evicted > 0);

        let stats_after = cache.stats().await;
        assert!(stats_after.total_size <= target_size);
    }

    #[tokio::test]
    async fn test_stats() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size, 0);

        let test_file = dir.path().join("stats-test.txt");
        fs::write_file_string(&test_file, "stats content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 1);
        assert!(stats.total_size > 0);
    }

    #[tokio::test]
    async fn test_preview_clean() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add multiple files
        for i in 0..3 {
            let test_file = dir.path().join(format!("preview-test-{}.txt", i));
            fs::write_file_string(&test_file, &format!("preview content {}", i))
                .await
                .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        // Preview should return all files without deleting
        let entries = cache.preview_clean();
        assert_eq!(entries.len(), 3);

        // Files should still exist
        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 3);
    }

    #[tokio::test]
    async fn test_clean_with_option_permanent() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add files
        for i in 0..2 {
            let test_file = dir.path().join(format!("clean-opt-{}.txt", i));
            fs::write_file_string(&test_file, &format!("content {}", i))
                .await
                .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        // Clean with permanent delete
        let freed = cache.clean_with_option(false).await.unwrap();
        assert!(freed > 0);

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_clean_with_option_trash() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add files
        for i in 0..2 {
            let test_file = dir.path().join(format!("trash-opt-{}.txt", i));
            fs::write_file_string(&test_file, &format!("trash content {}", i))
                .await
                .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        // Clean with trash option
        let freed = cache.clean_with_option(true).await.unwrap();
        assert!(freed > 0);

        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
    }
}
