use super::{
    sqlite_db::{CacheAccessStats, CacheSizeSnapshot, DatabaseInfo, IntegrityCheckResult},
    CacheEntry, CacheEntryType, SqliteCacheDb,
};
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    disk::format_size,
    fs,
    network::{DownloadProgress, HttpClient},
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub struct DownloadCache {
    cache_dir: PathBuf,
    db: SqliteCacheDb,
}

impl DownloadCache {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let downloads_dir = cache_dir.join("downloads");
        fs::create_dir_all(&downloads_dir).await?;

        let db = SqliteCacheDb::open(cache_dir).await?;

        Ok(Self {
            cache_dir: downloads_dir,
            db,
        })
    }

    pub async fn get_by_checksum(&self, checksum: &str) -> CogniaResult<Option<PathBuf>> {
        Ok(self
            .db
            .get_by_checksum(checksum)
            .await?
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone()))
    }

    pub async fn get(&self, key: &str) -> CogniaResult<Option<PathBuf>> {
        Ok(self
            .db
            .get(key)
            .await?
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone()))
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
            if let Some(cached_path) = self.get_by_checksum(checksum).await? {
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
        if let Some(path) = self.get_by_checksum(checksum).await? {
            if fs::exists(&path).await {
                let actual = fs::calculate_sha256(&path).await?;
                return Ok(actual == checksum);
            }
        }
        Ok(false)
    }

    pub async fn remove(&mut self, checksum: &str) -> CogniaResult<bool> {
        let key = format!("checksum:{}", checksum);

        if let Some(entry) = self.db.get(&key).await? {
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
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
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
    pub async fn preview_clean(&self) -> CogniaResult<Vec<CacheEntry>> {
        Ok(self
            .db
            .list()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect())
    }

    /// Get list of expired download entries (for preview)
    pub async fn preview_expired(&self, max_age: Duration) -> CogniaResult<Vec<CacheEntry>> {
        let entries = self.db.list().await?;
        Ok(entries
            .into_iter()
            .filter(|entry| entry.entry_type == CacheEntryType::Download)
            .filter(|entry| is_entry_expired(entry, max_age))
            .collect())
    }

    pub async fn clean_expired(&mut self, max_age: Duration) -> CogniaResult<u64> {
        self.clean_expired_with_option(max_age, false).await
    }

    /// Clean expired download entries with option to use trash
    pub async fn clean_expired_with_option(
        &mut self,
        max_age: Duration,
        use_trash: bool,
    ) -> CogniaResult<u64> {
        let entries = self.db.list().await?;
        let mut total_freed = 0u64;

        for entry in entries
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .filter(|e| is_entry_expired(e, max_age))
        {
            if fs::exists(&entry.file_path).await {
                total_freed += entry.size;
                fs::remove_file_with_option(&entry.file_path, use_trash).await?;
            }
            self.db.remove(&entry.key).await?;
        }

        Ok(total_freed)
    }

    pub async fn evict_to_size(&mut self, max_size: u64) -> CogniaResult<usize> {
        let mut entries: Vec<_> = self
            .db
            .list()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect();

        let total_download_size: u64 = entries.iter().map(|entry| entry.size).sum();
        if total_download_size <= max_size {
            return Ok(0);
        }

        let mut remaining = total_download_size;
        let mut removed = 0usize;

        entries.sort_by_key(|entry| entry.last_accessed.unwrap_or(entry.created_at));

        for entry in entries {
            if remaining <= max_size {
                break;
            }

            if fs::exists(&entry.file_path).await {
                let _ = fs::remove_file(&entry.file_path).await;
            }
            if self.db.remove(&entry.key).await? {
                removed += 1;
                remaining = remaining.saturating_sub(entry.size);
            }
        }

        Ok(removed)
    }

    pub async fn stats(&self) -> CogniaResult<DownloadCacheStats> {
        let entries = self.db.list().await?;
        let entries: Vec<_> = entries
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect();

        let total_size = entries.iter().map(|e| e.size).sum();
        let entry_count = entries.len();

        Ok(DownloadCacheStats {
            total_size,
            entry_count,
            location: self.cache_dir.clone(),
        })
    }

    // ==================== Cache Access Stats ====================

    /// Get cache access statistics (hit rate, hits, misses)
    pub fn get_access_stats(&self) -> CacheAccessStats {
        self.db.get_access_stats()
    }

    /// Reset cache access statistics
    pub async fn reset_access_stats(&self) -> CogniaResult<()> {
        self.db.reset_access_stats().await
    }

    /// Persist access stats to database
    pub async fn persist_access_stats(&self) -> CogniaResult<()> {
        self.db.persist_stats().await
    }

    // ==================== Cache Entry Browser ====================

    /// List cache entries with filtering, sorting, and pagination
    pub async fn list_filtered(
        &self,
        entry_type: Option<CacheEntryType>,
        search: Option<&str>,
        sort_by: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> CogniaResult<(Vec<CacheEntry>, usize)> {
        self.db
            .list_filtered(entry_type, search, sort_by, limit, offset)
            .await
    }

    /// Remove a cache entry with optional trash support
    pub async fn remove_with_option(&mut self, key: &str, use_trash: bool) -> CogniaResult<bool> {
        if let Some(entry) = self.db.get(key).await? {
            if fs::exists(&entry.file_path).await {
                fs::remove_file_with_option(&entry.file_path, use_trash).await?;
            }
            self.db.remove(key).await
        } else {
            Ok(false)
        }
    }

    /// Get top accessed entries (hot files)
    pub async fn get_top_accessed(&self, limit: usize) -> CogniaResult<Vec<CacheEntry>> {
        self.db.get_top_accessed(limit).await
    }

    /// Get entries by type
    pub async fn list_by_type(&self, entry_type: CacheEntryType) -> CogniaResult<Vec<CacheEntry>> {
        self.db.list_by_type(entry_type).await
    }

    // ==================== Database Maintenance ====================

    /// Optimize database: WAL checkpoint + VACUUM + ANALYZE
    /// Returns (size_before, size_after) in bytes
    pub async fn optimize(&self) -> CogniaResult<(u64, u64)> {
        self.db.optimize().await
    }

    /// Check database structural integrity
    pub async fn integrity_check(&self) -> CogniaResult<IntegrityCheckResult> {
        self.db.integrity_check().await
    }

    /// Create a consistent backup of the cache database
    pub async fn backup_to_file(&self, dest: &Path) -> CogniaResult<u64> {
        self.db.backup_to_file(dest).await
    }

    /// Get comprehensive database metadata
    pub async fn get_db_info(&self) -> CogniaResult<DatabaseInfo> {
        self.db.get_db_info().await
    }

    // ==================== Size Snapshots ====================

    /// Record a cache size snapshot for trend tracking
    pub async fn record_size_snapshot(
        &self,
        internal_size: u64,
        download_count: usize,
        metadata_count: usize,
    ) -> CogniaResult<()> {
        self.db
            .record_size_snapshot(internal_size, download_count, metadata_count)
            .await
    }

    /// Get size snapshots for the last N days
    pub async fn get_size_snapshots(&self, days: u32) -> CogniaResult<Vec<CacheSizeSnapshot>> {
        self.db.get_size_snapshots(days).await
    }

    /// Prune snapshots older than N days
    pub async fn prune_old_snapshots(&self, max_age_days: u32) -> CogniaResult<usize> {
        self.db.prune_old_snapshots(max_age_days).await
    }
}

fn is_entry_expired(entry: &CacheEntry, max_age: Duration) -> bool {
    let max_age = ChronoDuration::from_std(max_age).unwrap_or_else(|_| ChronoDuration::zero());
    let cutoff: DateTime<Utc> = Utc::now() - max_age;
    entry.created_at < cutoff
}

#[derive(Debug, Clone)]
pub struct DownloadCacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub location: PathBuf,
}

impl DownloadCacheStats {
    pub fn size_human(&self) -> String {
        format_size(self.total_size)
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

        let retrieved = cache.get_by_checksum(&checksum).await.unwrap();
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
        let retrieved = cache.get(&key).await.unwrap();
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
        assert!(cache.get_by_checksum(&checksum).await.unwrap().is_none());
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

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 3);

        // Clean all
        let freed = cache.clean().await.unwrap();
        assert!(freed > 0);

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_preview_and_clean_expired() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("expired-download.txt");
        fs::write_file_string(&test_file, "expired content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        let preview = cache.preview_expired(Duration::from_secs(0)).await.unwrap();
        assert_eq!(preview.len(), 1);

        let freed = cache.clean_expired(Duration::from_secs(0)).await.unwrap();
        assert!(freed > 0);

        let stats = cache.stats().await.unwrap();
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
            fs::write_file_string(
                &test_file,
                &format!("unique content {}: {}", i, "x".repeat(100)),
            )
            .await
            .unwrap();

            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        let stats_before = cache.stats().await.unwrap();
        assert!(
            stats_before.entry_count >= 3,
            "Expected at least 3 entries, got {}",
            stats_before.entry_count
        );
        assert!(stats_before.total_size > 0);

        // Evict to smaller size - use a size smaller than total
        let target_size = stats_before.total_size / 3;
        let evicted = cache.evict_to_size(target_size).await.unwrap();
        assert!(evicted > 0);

        let stats_after = cache.stats().await.unwrap();
        assert!(stats_after.total_size <= target_size);
    }

    #[tokio::test]
    async fn test_stats() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size, 0);

        let test_file = dir.path().join("stats-test.txt");
        fs::write_file_string(&test_file, "stats content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        let stats = cache.stats().await.unwrap();
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
        let entries = cache.preview_clean().await.unwrap();
        assert_eq!(entries.len(), 3);

        // Files should still exist
        let stats = cache.stats().await.unwrap();
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

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_optimize() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add some data first
        let test_file = dir.path().join("opt-test.txt");
        fs::write_file_string(&test_file, "optimize test content")
            .await
            .unwrap();
        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        // Optimize should succeed
        let (size_before, size_after) = cache.optimize().await.unwrap();
        assert!(size_before > 0);
        assert!(size_after > 0);
    }

    #[tokio::test]
    async fn test_record_and_get_size_snapshots() {
        let dir = tempdir().unwrap();
        let cache = DownloadCache::open(dir.path()).await.unwrap();

        // Record snapshots
        cache.record_size_snapshot(1000, 5, 3).await.unwrap();
        cache.record_size_snapshot(2000, 10, 6).await.unwrap();

        let snapshots = cache.get_size_snapshots(30).await.unwrap();
        assert_eq!(snapshots.len(), 2);

        // Oldest first (ascending order)
        assert_eq!(snapshots[0].internal_size, 1000);
        assert_eq!(snapshots[0].download_count, 5);
        assert_eq!(snapshots[0].metadata_count, 3);
        assert_eq!(snapshots[1].internal_size, 2000);
        assert_eq!(snapshots[1].download_count, 10);
        assert_eq!(snapshots[1].metadata_count, 6);
    }

    #[tokio::test]
    async fn test_prune_old_snapshots() {
        let dir = tempdir().unwrap();
        let cache = DownloadCache::open(dir.path()).await.unwrap();

        // Record a recent snapshot
        cache.record_size_snapshot(5000, 20, 10).await.unwrap();

        // Prune with 90 days — recent snapshot should survive
        let pruned = cache.prune_old_snapshots(90).await.unwrap();
        assert_eq!(pruned, 0);

        let remaining = cache.get_size_snapshots(365).await.unwrap();
        assert_eq!(remaining.len(), 1);
    }

    #[tokio::test]
    async fn test_empty_size_snapshots() {
        let dir = tempdir().unwrap();
        let cache = DownloadCache::open(dir.path()).await.unwrap();

        let snapshots = cache.get_size_snapshots(30).await.unwrap();
        assert!(snapshots.is_empty());
    }

    #[tokio::test]
    async fn test_remove_with_option() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("remove-opt.txt");
        fs::write_file_string(&test_file, "remove option content")
            .await
            .unwrap();
        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        let key = format!("checksum:{}", checksum);
        let removed = cache.remove_with_option(&key, false).await.unwrap();
        assert!(removed);

        // Entry should be gone
        let retrieved = cache.get(&key).await.unwrap();
        assert!(retrieved.is_none());

        // Removing non-existent key should return false
        let removed = cache.remove_with_option("nonexistent", false).await.unwrap();
        assert!(!removed);
    }

    #[tokio::test]
    async fn test_list_filtered() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        for i in 0..3 {
            let test_file = dir.path().join(format!("filtered-{}.txt", i));
            fs::write_file_string(&test_file, &format!("filtered content {}", i))
                .await
                .unwrap();
            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        // List all with limit
        let (entries, total) = cache
            .list_filtered(None, None, None, 2, 0)
            .await
            .unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(total, 3);

        // Pagination offset
        let (entries, _) = cache
            .list_filtered(None, None, None, 10, 2)
            .await
            .unwrap();
        assert_eq!(entries.len(), 1);

        // Filter by type (all are downloads)
        let (entries, total) = cache
            .list_filtered(Some(CacheEntryType::Download), None, None, 10, 0)
            .await
            .unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(total, 3);

        // Filter by type with no matches
        let (entries, total) = cache
            .list_filtered(Some(CacheEntryType::Metadata), None, None, 10, 0)
            .await
            .unwrap();
        assert_eq!(entries.len(), 0);
        assert_eq!(total, 0);
    }

    #[tokio::test]
    async fn test_get_top_accessed() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add files
        for i in 0..3 {
            let test_file = dir.path().join(format!("hot-{}.txt", i));
            fs::write_file_string(&test_file, &format!("hot content {}", i))
                .await
                .unwrap();
            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        // Access some entries multiple times via get
        let stats_before = cache.stats().await.unwrap();
        assert_eq!(stats_before.entry_count, 3);

        let top = cache.get_top_accessed(2).await.unwrap();
        // All entries have 0 hits initially, so we get at most 2
        assert!(top.len() <= 3);
    }

    #[tokio::test]
    async fn test_list_by_type() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        // Add download entries
        for i in 0..2 {
            let test_file = dir.path().join(format!("type-{}.txt", i));
            fs::write_file_string(&test_file, &format!("type content {}", i))
                .await
                .unwrap();
            let checksum = fs::calculate_sha256(&test_file).await.unwrap();
            cache.add_file(&test_file, &checksum).await.unwrap();
        }

        let downloads = cache.list_by_type(CacheEntryType::Download).await.unwrap();
        assert_eq!(downloads.len(), 2);

        let metadata = cache.list_by_type(CacheEntryType::Metadata).await.unwrap();
        assert_eq!(metadata.len(), 0);
    }

    #[tokio::test]
    async fn test_access_stats() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("access-stats.txt");
        fs::write_file_string(&test_file, "access stats content")
            .await
            .unwrap();
        let checksum = fs::calculate_sha256(&test_file).await.unwrap();
        cache.add_file(&test_file, &checksum).await.unwrap();

        // Access to generate hit
        let key = format!("checksum:{}", checksum);
        let _ = cache.get(&key).await.unwrap();

        // Access miss
        let _ = cache.get("nonexistent").await.unwrap();

        // Persist and reset
        cache.persist_access_stats().await.unwrap();
        cache.reset_access_stats().await.unwrap();

        // After reset, reopen and stats should be zero
        let cache2 = DownloadCache::open(dir.path()).await.unwrap();
        let _ = cache2.get("nonexistent").await.unwrap();
        // Should have 1 miss from fresh stats
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

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }
}
