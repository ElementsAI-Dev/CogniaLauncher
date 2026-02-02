use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use super::db::CacheEntryType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

const FLUSH_INTERVAL_SECS: u64 = 30;

/// Enhanced download cache with resumption and LRU eviction
pub struct EnhancedCache {
    cache_dir: PathBuf,
    max_size: u64,
    max_age: Duration,
    entries: HashMap<String, EnhancedCacheEntry>,
    dirty: bool,
    last_flush: std::time::Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedCacheEntry {
    pub key: String,
    pub file_path: PathBuf,
    pub size: u64,
    pub checksum: Option<String>,
    pub created_at: i64,
    pub last_accessed: i64,
    pub access_count: u64,
    pub entry_type: CacheEntryType,
    pub metadata: HashMap<String, String>,
}

impl EnhancedCache {
    pub async fn open(cache_dir: &Path, max_size: u64, max_age: Duration) -> CogniaResult<Self> {
        fs::create_dir_all(cache_dir).await?;

        let mut cache = Self {
            cache_dir: cache_dir.to_path_buf(),
            max_size,
            max_age,
            entries: HashMap::new(),
            dirty: false,
            last_flush: std::time::Instant::now(),
        };

        cache.load_index().await?;
        Ok(cache)
    }

    async fn load_index(&mut self) -> CogniaResult<()> {
        let index_path = self.cache_dir.join("index.json");
        if fs::exists(&index_path).await {
            let content = fs::read_file_string(&index_path).await?;
            self.entries = serde_json::from_str(&content).unwrap_or_default();
        }
        Ok(())
    }

    async fn save_index(&self) -> CogniaResult<()> {
        let index_path = self.cache_dir.join("index.json");
        let content = serde_json::to_string_pretty(&self.entries)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;
        fs::write_file_string(&index_path, &content).await?;
        Ok(())
    }

    fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    async fn flush_if_needed(&mut self) -> CogniaResult<()> {
        if self.dirty && self.last_flush.elapsed().as_secs() >= FLUSH_INTERVAL_SECS {
            self.flush().await?;
        }
        Ok(())
    }

    pub async fn flush(&mut self) -> CogniaResult<()> {
        if self.dirty {
            self.save_index().await?;
            self.dirty = false;
            self.last_flush = std::time::Instant::now();
        }
        Ok(())
    }

    /// Get an entry from cache, updating access time
    pub async fn get(&mut self, key: &str) -> Option<PathBuf> {
        // First check if entry exists and gather info
        let entry_info = self.entries.get(key).map(|e| {
            (e.file_path.clone(), e.created_at)
        });

        let (file_path, created_at) = match entry_info {
            Some(info) => info,
            None => return None,
        };

        // Check if file exists
        if !fs::exists(&file_path).await {
            self.entries.remove(key);
            let _ = self.save_index().await;
            return None;
        }

        // Check age
        let now = chrono::Utc::now().timestamp();
        let age = Duration::from_secs((now - created_at) as u64);
        if age > self.max_age {
            // Expired
            let _ = fs::remove_file(&file_path).await;
            self.entries.remove(key);
            let _ = self.save_index().await;
            return None;
        }

        // Update access time and count
        if let Some(entry) = self.entries.get_mut(key) {
            entry.last_accessed = now;
            entry.access_count += 1;
            self.mark_dirty();
        }

        Some(file_path)
    }

    /// Store an entry in the cache
    pub async fn put(&mut self, entry: EnhancedCacheEntry) -> CogniaResult<()> {
        // Check if we need to evict entries
        self.evict_if_needed(entry.size).await?;

        self.entries.insert(entry.key.clone(), entry);
        self.mark_dirty();
        self.flush_if_needed().await?;
        Ok(())
    }

    /// Remove an entry from the cache
    pub async fn remove(&mut self, key: &str) -> CogniaResult<bool> {
        if let Some(entry) = self.entries.remove(key) {
            if fs::exists(&entry.file_path).await {
                fs::remove_file(&entry.file_path).await?;
            }
            self.mark_dirty();
            self.flush_if_needed().await?;
            return Ok(true);
        }
        Ok(false)
    }

    /// Evict entries using LRU strategy if needed
    async fn evict_if_needed(&mut self, needed_size: u64) -> CogniaResult<()> {
        let current_size = self.total_size();
        
        if current_size + needed_size <= self.max_size {
            return Ok(());
        }

        // Collect entry info for sorting (key, last_accessed, access_count, size, file_path)
        let mut entries: Vec<_> = self.entries.iter()
            .map(|(k, e)| (k.clone(), e.last_accessed, e.access_count, e.size, e.file_path.clone()))
            .collect();
        
        // Sort by last accessed (oldest first) and access count
        entries.sort_by(|a, b| {
            match a.1.cmp(&b.1) {
                std::cmp::Ordering::Equal => a.2.cmp(&b.2),
                other => other,
            }
        });

        let mut freed = 0u64;
        let target_free = needed_size + (self.max_size / 10); // Free a bit extra

        for (key, _last_accessed, _access_count, size, file_path) in entries {
            if freed >= target_free {
                break;
            }

            if fs::exists(&file_path).await {
                let _ = fs::remove_file(&file_path).await;
            }
            freed += size;
            self.entries.remove(&key);
        }

        self.save_index().await?;
        Ok(())
    }

    /// Get total cache size
    pub fn total_size(&self) -> u64 {
        self.entries.values().map(|e| e.size).sum()
    }

    /// Get cache statistics
    pub fn stats(&self) -> EnhancedCacheStats {
        let total_size = self.total_size();
        let entry_count = self.entries.len();

        let mut by_type: HashMap<CacheEntryType, (usize, u64)> = HashMap::new();
        for entry in self.entries.values() {
            let stat = by_type.entry(entry.entry_type).or_insert((0, 0));
            stat.0 += 1;
            stat.1 += entry.size;
        }

        EnhancedCacheStats {
            total_size,
            entry_count,
            max_size: self.max_size,
            usage_percent: (total_size as f64 / self.max_size as f64 * 100.0) as u8,
            by_type,
        }
    }

    /// Clean expired entries
    pub async fn clean_expired(&mut self) -> CogniaResult<u64> {
        self.clean_expired_with_option(false).await
    }

    /// Clean expired entries with option to use trash
    pub async fn clean_expired_with_option(&mut self, use_trash: bool) -> CogniaResult<u64> {
        let now = chrono::Utc::now().timestamp();
        let max_age_secs = self.max_age.as_secs() as i64;

        let expired: Vec<_> = self
            .entries
            .iter()
            .filter(|(_, e)| now - e.created_at > max_age_secs)
            .map(|(k, _)| k.clone())
            .collect();

        let mut freed = 0u64;
        for key in expired {
            if let Some(entry) = self.entries.remove(&key) {
                if fs::exists(&entry.file_path).await {
                    let _ = fs::remove_file_with_option(&entry.file_path, use_trash).await;
                }
                freed += entry.size;
            }
        }

        self.save_index().await?;
        Ok(freed)
    }

    /// Clean entries of a specific type
    pub async fn clean_type(&mut self, entry_type: CacheEntryType) -> CogniaResult<u64> {
        self.clean_type_with_option(entry_type, false).await
    }

    /// Clean entries of a specific type with option to use trash
    pub async fn clean_type_with_option(&mut self, entry_type: CacheEntryType, use_trash: bool) -> CogniaResult<u64> {
        let to_remove: Vec<_> = self
            .entries
            .iter()
            .filter(|(_, e)| e.entry_type == entry_type)
            .map(|(k, _)| k.clone())
            .collect();

        let mut freed = 0u64;
        for key in to_remove {
            if let Some(entry) = self.entries.remove(&key) {
                if fs::exists(&entry.file_path).await {
                    let _ = fs::remove_file_with_option(&entry.file_path, use_trash).await;
                }
                freed += entry.size;
            }
        }

        self.save_index().await?;
        Ok(freed)
    }

    /// Clean all entries
    pub async fn clean_all(&mut self) -> CogniaResult<u64> {
        self.clean_all_with_option(false).await
    }

    /// Clean all entries with option to use trash
    pub async fn clean_all_with_option(&mut self, use_trash: bool) -> CogniaResult<u64> {
        let mut freed = 0u64;

        for entry in self.entries.values() {
            if fs::exists(&entry.file_path).await {
                let _ = fs::remove_file_with_option(&entry.file_path, use_trash).await;
            }
            freed += entry.size;
        }

        self.entries.clear();
        self.save_index().await?;
        Ok(freed)
    }

    /// Get list of all entries for preview
    pub fn preview_all(&self) -> Vec<&EnhancedCacheEntry> {
        self.entries.values().collect()
    }

    /// Get list of expired entries for preview
    pub fn preview_expired(&self) -> Vec<&EnhancedCacheEntry> {
        let now = chrono::Utc::now().timestamp();
        let max_age_secs = self.max_age.as_secs() as i64;
        
        self.entries
            .values()
            .filter(|e| now - e.created_at > max_age_secs)
            .collect()
    }

    /// Get list of entries by type for preview
    pub fn preview_type(&self, entry_type: CacheEntryType) -> Vec<&EnhancedCacheEntry> {
        self.entries
            .values()
            .filter(|e| e.entry_type == entry_type)
            .collect()
    }

    /// Verify cache integrity
    pub async fn verify(&mut self) -> CogniaResult<VerificationResult> {
        let mut result = VerificationResult::default();

        let keys: Vec<_> = self.entries.keys().cloned().collect();

        for key in keys {
            if let Some(entry) = self.entries.get(&key) {
                // Check if file exists
                if !fs::exists(&entry.file_path).await {
                    result.missing.push(key.clone());
                    continue;
                }

                // Check size
                let actual_size = fs::file_size(&entry.file_path).await.unwrap_or(0);
                if actual_size != entry.size {
                    result.size_mismatch.push((key.clone(), entry.size, actual_size));
                    continue;
                }

                // Check checksum if available
                if let Some(ref expected_checksum) = entry.checksum {
                    let actual_checksum = fs::calculate_sha256(&entry.file_path).await.ok();
                    if actual_checksum.as_ref() != Some(expected_checksum) {
                        result.checksum_mismatch.push(key.clone());
                        continue;
                    }
                }

                result.valid += 1;
            }
        }

        Ok(result)
    }

    /// Repair cache by removing invalid entries
    pub async fn repair(&mut self) -> CogniaResult<RepairResult> {
        let verification = self.verify().await?;
        let mut result = RepairResult::default();

        // Remove missing files
        for key in &verification.missing {
            if let Some(entry) = self.entries.remove(key) {
                result.freed_bytes += entry.size;
                result.removed += 1;
            }
        }

        // Remove size mismatched files
        for (key, _, _) in &verification.size_mismatch {
            if let Some(entry) = self.entries.remove(key) {
                result.freed_bytes += entry.size;
                let _ = fs::remove_file(&entry.file_path).await;
                result.removed += 1;
            }
        }

        // Remove checksum mismatched files
        for key in &verification.checksum_mismatch {
            if let Some(entry) = self.entries.remove(key) {
                result.freed_bytes += entry.size;
                let _ = fs::remove_file(&entry.file_path).await;
                result.removed += 1;
            }
        }

        self.save_index().await?;
        Ok(result)
    }
}

#[derive(Debug, Clone, Default)]
pub struct EnhancedCacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub max_size: u64,
    pub usage_percent: u8,
    pub by_type: HashMap<CacheEntryType, (usize, u64)>,
}

impl EnhancedCacheStats {
    pub fn size_human(&self) -> String {
        format_size(self.total_size)
    }

    pub fn max_size_human(&self) -> String {
        format_size(self.max_size)
    }
}

#[derive(Debug, Clone, Default)]
pub struct VerificationResult {
    pub valid: usize,
    pub missing: Vec<String>,
    pub size_mismatch: Vec<(String, u64, u64)>,
    pub checksum_mismatch: Vec<String>,
}

impl VerificationResult {
    pub fn is_valid(&self) -> bool {
        self.missing.is_empty() && self.size_mismatch.is_empty() && self.checksum_mismatch.is_empty()
    }

    pub fn total_errors(&self) -> usize {
        self.missing.len() + self.size_mismatch.len() + self.checksum_mismatch.len()
    }
}

#[derive(Debug, Clone, Default)]
pub struct RepairResult {
    pub removed: usize,
    pub recovered: usize,
    pub freed_bytes: u64,
}

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
        let stale: Vec<_> = self.get_stale(max_age).iter().map(|p| p.url.clone()).collect();
        let count = stale.len();

        for url in stale {
            self.cancel(&url).await?;
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

fn format_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} B", size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(500), "500 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1536), "1.50 KB");
        assert_eq!(format_size(1048576), "1.00 MB");
        assert_eq!(format_size(1073741824), "1.00 GB");
    }

    #[tokio::test]
    async fn test_enhanced_cache_put_get() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024, // 1MB
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        // Create a test file
        let test_file = cache_dir.join("test-file.txt");
        fs::create_dir_all(&cache_dir).await.unwrap();
        fs::write_file_string(&test_file, "test content").await.unwrap();

        let entry = EnhancedCacheEntry {
            key: "test-key".to_string(),
            file_path: test_file.clone(),
            size: 12,
            checksum: Some("abc123".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            access_count: 0,
            entry_type: CacheEntryType::Download,
            metadata: HashMap::new(),
        };

        cache.put(entry).await.unwrap();

        let result = cache.get("test-key").await;
        assert!(result.is_some());
        assert_eq!(result.unwrap(), test_file);
    }

    #[tokio::test]
    async fn test_enhanced_cache_dirty_flag() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        // Create a test file
        let test_file = cache_dir.join("dirty-test.txt");
        fs::create_dir_all(&cache_dir).await.unwrap();
        fs::write_file_string(&test_file, "dirty content").await.unwrap();

        let entry = EnhancedCacheEntry {
            key: "dirty-key".to_string(),
            file_path: test_file,
            size: 13,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            access_count: 0,
            entry_type: CacheEntryType::Download,
            metadata: HashMap::new(),
        };

        cache.put(entry).await.unwrap();
        cache.flush().await.unwrap();

        // Reopen and verify persistence
        let mut cache2 = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        let result = cache2.get("dirty-key").await;
        assert!(result.is_some());
    }

    #[tokio::test]
    async fn test_enhanced_cache_verification() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        // Create valid file
        let valid_file = cache_dir.join("valid.txt");
        fs::create_dir_all(&cache_dir).await.unwrap();
        fs::write_file_string(&valid_file, "valid").await.unwrap();

        let valid_entry = EnhancedCacheEntry {
            key: "valid-key".to_string(),
            file_path: valid_file,
            size: 5,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            access_count: 0,
            entry_type: CacheEntryType::Download,
            metadata: HashMap::new(),
        };
        cache.put(valid_entry).await.unwrap();

        // Add entry with missing file
        let missing_entry = EnhancedCacheEntry {
            key: "missing-key".to_string(),
            file_path: cache_dir.join("nonexistent.txt"),
            size: 100,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            access_count: 0,
            entry_type: CacheEntryType::Download,
            metadata: HashMap::new(),
        };
        cache.entries.insert("missing-key".to_string(), missing_entry);
        cache.flush().await.unwrap();

        let result = cache.verify().await.unwrap();
        assert_eq!(result.valid, 1);
        assert_eq!(result.missing.len(), 1);
        assert!(result.missing.contains(&"missing-key".to_string()));
    }

    #[tokio::test]
    async fn test_enhanced_cache_repair() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        // Add entry with missing file
        let missing_entry = EnhancedCacheEntry {
            key: "repair-missing".to_string(),
            file_path: cache_dir.join("missing-for-repair.txt"),
            size: 500,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            access_count: 0,
            entry_type: CacheEntryType::Download,
            metadata: HashMap::new(),
        };
        cache.entries.insert("repair-missing".to_string(), missing_entry);
        cache.flush().await.unwrap();

        let repair_result = cache.repair().await.unwrap();
        assert_eq!(repair_result.removed, 1);
        assert_eq!(repair_result.freed_bytes, 500);

        // Verify entry is removed
        assert!(cache.entries.get("repair-missing").is_none());
    }

    #[tokio::test]
    async fn test_enhanced_cache_lru_eviction() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        // Small max size to trigger eviction
        let mut cache = EnhancedCache::open(
            &cache_dir,
            200, // 200 bytes max
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        // Add 3 files of 100 bytes each
        for i in 0..3 {
            let file = cache_dir.join(format!("evict-{}.txt", i));
            fs::write_file_string(&file, &"x".repeat(100)).await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("evict-key-{}", i),
                file_path: file,
                size: 100,
                checksum: None,
                created_at: chrono::Utc::now().timestamp() - (2 - i) as i64, // Older entries first
                last_accessed: chrono::Utc::now().timestamp() - (2 - i) as i64,
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        // Should have evicted at least one entry
        assert!(cache.total_size() <= 200);
    }

    #[tokio::test]
    async fn test_verification_result_helpers() {
        let result = VerificationResult {
            valid: 10,
            missing: vec!["a".to_string(), "b".to_string()],
            size_mismatch: vec![("c".to_string(), 100, 200)],
            checksum_mismatch: vec!["d".to_string()],
        };

        assert!(!result.is_valid());
        assert_eq!(result.total_errors(), 4);

        let valid_result = VerificationResult {
            valid: 5,
            missing: vec![],
            size_mismatch: vec![],
            checksum_mismatch: vec![],
        };
        assert!(valid_result.is_valid());
    }

    #[tokio::test]
    async fn test_preview_expired() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        // Use very short max_age so entries are immediately expired
        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(0), // 0 seconds = immediately expired
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        // Add entries that will be expired
        for i in 0..3 {
            let file = cache_dir.join(format!("preview-expired-{}.txt", i));
            fs::write_file_string(&file, &format!("content {}", i)).await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("preview-expired-{}", i),
                file_path: file,
                size: 10,
                checksum: None,
                created_at: chrono::Utc::now().timestamp() - 100, // Created 100 seconds ago
                last_accessed: chrono::Utc::now().timestamp() - 100,
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        let preview = cache.preview_expired();
        assert_eq!(preview.len(), 3);

        // Verify entries still exist
        assert_eq!(cache.entries.len(), 3);
    }

    #[tokio::test]
    async fn test_preview_type() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        // Add mixed type entries
        for i in 0..2 {
            let file = cache_dir.join(format!("download-{}.txt", i));
            fs::write_file_string(&file, "download").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("download-{}", i),
                file_path: file,
                size: 8,
                checksum: None,
                created_at: chrono::Utc::now().timestamp(),
                last_accessed: chrono::Utc::now().timestamp(),
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        for i in 0..3 {
            let file = cache_dir.join(format!("metadata-{}.txt", i));
            fs::write_file_string(&file, "metadata").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("metadata-{}", i),
                file_path: file,
                size: 8,
                checksum: None,
                created_at: chrono::Utc::now().timestamp(),
                last_accessed: chrono::Utc::now().timestamp(),
                access_count: 0,
                entry_type: CacheEntryType::Metadata,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        let download_preview = cache.preview_type(CacheEntryType::Download);
        assert_eq!(download_preview.len(), 2);

        let metadata_preview = cache.preview_type(CacheEntryType::Metadata);
        assert_eq!(metadata_preview.len(), 3);
    }

    #[tokio::test]
    async fn test_clean_expired_with_option_permanent() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(0),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        for i in 0..2 {
            let file = cache_dir.join(format!("expired-perm-{}.txt", i));
            fs::write_file_string(&file, "content").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("expired-perm-{}", i),
                file_path: file,
                size: 7,
                checksum: None,
                created_at: chrono::Utc::now().timestamp() - 100,
                last_accessed: chrono::Utc::now().timestamp() - 100,
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        let freed = cache.clean_expired_with_option(false).await.unwrap();
        assert!(freed > 0);
        assert_eq!(cache.entries.len(), 0);
    }

    #[tokio::test]
    async fn test_clean_expired_with_option_trash() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(0),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        for i in 0..2 {
            let file = cache_dir.join(format!("expired-trash-{}.txt", i));
            fs::write_file_string(&file, "content").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("expired-trash-{}", i),
                file_path: file,
                size: 7,
                checksum: None,
                created_at: chrono::Utc::now().timestamp() - 100,
                last_accessed: chrono::Utc::now().timestamp() - 100,
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        let freed = cache.clean_expired_with_option(true).await.unwrap();
        assert!(freed > 0);
        assert_eq!(cache.entries.len(), 0);
    }

    #[tokio::test]
    async fn test_clean_type_with_option() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        // Add Download entries
        for i in 0..2 {
            let file = cache_dir.join(format!("clean-type-dl-{}.txt", i));
            fs::write_file_string(&file, "download").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("clean-type-dl-{}", i),
                file_path: file,
                size: 8,
                checksum: None,
                created_at: chrono::Utc::now().timestamp(),
                last_accessed: chrono::Utc::now().timestamp(),
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        // Add Metadata entries
        for i in 0..3 {
            let file = cache_dir.join(format!("clean-type-md-{}.txt", i));
            fs::write_file_string(&file, "metadata").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("clean-type-md-{}", i),
                file_path: file,
                size: 8,
                checksum: None,
                created_at: chrono::Utc::now().timestamp(),
                last_accessed: chrono::Utc::now().timestamp(),
                access_count: 0,
                entry_type: CacheEntryType::Metadata,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        // Clean only Download type
        let freed = cache.clean_type_with_option(CacheEntryType::Download, false).await.unwrap();
        assert!(freed > 0);

        // Only Metadata entries should remain
        assert_eq!(cache.entries.len(), 3);
    }

    #[tokio::test]
    async fn test_clean_all_with_option() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("cache");

        let mut cache = EnhancedCache::open(
            &cache_dir,
            1024 * 1024,
            Duration::from_secs(3600),
        )
        .await
        .unwrap();

        fs::create_dir_all(&cache_dir).await.unwrap();

        for i in 0..3 {
            let file = cache_dir.join(format!("clean-all-{}.txt", i));
            fs::write_file_string(&file, "content").await.unwrap();

            let entry = EnhancedCacheEntry {
                key: format!("clean-all-{}", i),
                file_path: file,
                size: 7,
                checksum: None,
                created_at: chrono::Utc::now().timestamp(),
                last_accessed: chrono::Utc::now().timestamp(),
                access_count: 0,
                entry_type: CacheEntryType::Download,
                metadata: HashMap::new(),
            };
            cache.put(entry).await.unwrap();
        }

        let freed = cache.clean_all_with_option(false).await.unwrap();
        assert!(freed > 0);
        assert_eq!(cache.entries.len(), 0);
    }
}
