use super::{CacheEntry, CacheEntryType, SqliteCacheDb};
use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const DEFAULT_TTL_SECONDS: i64 = 3600;

pub struct MetadataCache {
    cache_dir: PathBuf,
    db: SqliteCacheDb,
    default_ttl: i64,
}

impl MetadataCache {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        Self::open_with_ttl(cache_dir, DEFAULT_TTL_SECONDS).await
    }

    pub async fn open_with_ttl(cache_dir: &Path, default_ttl: i64) -> CogniaResult<Self> {
        let metadata_dir = cache_dir.join("metadata");
        fs::create_dir_all(&metadata_dir).await?;

        let db = SqliteCacheDb::open(cache_dir).await?;

        Ok(Self {
            cache_dir: metadata_dir,
            db,
            default_ttl,
        })
    }

    pub async fn get<T>(&mut self, key: &str) -> CogniaResult<Option<CachedMetadata<T>>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let cache_key = format!("metadata:{}", key);

        let entry = match self.db.get(&cache_key).await? {
            Some(e) => e,
            None => return Ok(None),
        };

        if !fs::exists(&entry.file_path).await {
            self.db.remove(&cache_key).await?;
            return Ok(None);
        }

        let content = fs::read_file_string(&entry.file_path).await?;
        let data: T =
            serde_json::from_str(&content).map_err(|e| CogniaError::Parse(e.to_string()))?;

        let is_stale = entry.is_expired();

        self.db.touch(&cache_key).await?;

        Ok(Some(CachedMetadata {
            data,
            is_stale,
            cached_at: entry.created_at,
        }))
    }

    pub async fn get_or_fetch<T, F, Fut>(&mut self, key: &str, fetch: F) -> CogniaResult<T>
    where
        T: Serialize + for<'de> Deserialize<'de>,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = CogniaResult<T>>,
    {
        if let Some(cached) = self.get::<T>(key).await? {
            if !cached.is_stale {
                return Ok(cached.data);
            }
        }

        match fetch().await {
            Ok(data) => {
                self.set(key, &data).await?;
                Ok(data)
            }
            Err(e) => {
                if let Some(cached) = self.get::<T>(key).await? {
                    log::warn!("Fetch failed, returning stale cache for {}: {}", key, e);
                    Ok(cached.data)
                } else {
                    Err(e)
                }
            }
        }
    }

    pub async fn set<T>(&mut self, key: &str, data: &T) -> CogniaResult<()>
    where
        T: Serialize,
    {
        self.set_with_ttl(key, data, self.default_ttl).await
    }

    pub async fn set_with_ttl<T>(
        &mut self,
        key: &str,
        data: &T,
        ttl_seconds: i64,
    ) -> CogniaResult<()>
    where
        T: Serialize,
    {
        let cache_key = format!("metadata:{}", key);
        let safe_filename = key.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
        let file_path = self.cache_dir.join(format!("{}.json", safe_filename));

        let content =
            serde_json::to_string_pretty(data).map_err(|e| CogniaError::Internal(e.to_string()))?;

        fs::write_file_atomic(&file_path, content.as_bytes()).await?;
        let size = content.len() as u64;

        let checksum = hex::encode(sha2::Sha256::digest(content.as_bytes()));

        let entry = CacheEntry::new(
            &cache_key,
            &file_path,
            size,
            checksum,
            CacheEntryType::Metadata,
        )
        .with_ttl(ttl_seconds);

        self.db.insert(entry).await
    }

    pub async fn remove(&mut self, key: &str) -> CogniaResult<bool> {
        let cache_key = format!("metadata:{}", key);

        if let Some(entry) = self.db.get(&cache_key).await? {
            let path = entry.file_path.clone();
            if fs::exists(&path).await {
                fs::remove_file(&path).await?;
            }
        }

        self.db.remove(&cache_key).await
    }

    pub async fn clean_expired(&mut self) -> CogniaResult<usize> {
        self.clean_expired_with_option(false).await
    }

    /// Clean expired metadata entries with option to use trash
    pub async fn clean_expired_with_option(&mut self, use_trash: bool) -> CogniaResult<usize> {
        let expired: Vec<_> = self
            .db
            .get_expired()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .collect();

        let count = expired.len();

        for entry in expired {
            if fs::exists(&entry.file_path).await {
                let _ = fs::remove_file_with_option(&entry.file_path, use_trash).await;
            }
            self.db.remove(&entry.key).await?;
        }

        Ok(count)
    }

    pub async fn clean_all(&mut self) -> CogniaResult<usize> {
        self.clean_all_with_option(false).await
    }

    /// Clean all metadata entries with option to use trash
    pub async fn clean_all_with_option(&mut self, use_trash: bool) -> CogniaResult<usize> {
        let entries: Vec<CacheEntry> = self
            .db
            .list()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .collect();

        let count = entries.len();

        for entry in entries {
            if fs::exists(&entry.file_path).await {
                let _ = fs::remove_file_with_option(&entry.file_path, use_trash).await;
            }
            self.db.remove(&entry.key).await?;
        }

        Ok(count)
    }

    /// Get list of entries that would be cleaned (for preview)
    pub async fn preview_clean(&self) -> CogniaResult<Vec<CacheEntry>> {
        Ok(self
            .db
            .list()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .collect())
    }

    /// Get list of expired entries (for preview)
    pub async fn preview_expired(&self) -> CogniaResult<Vec<CacheEntry>> {
        Ok(self
            .db
            .get_expired()
            .await?
            .into_iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .collect())
    }

    pub async fn stats(&self) -> CogniaResult<MetadataCacheStats> {
        let binding = self.db.list().await?;
        let entries: Vec<_> = binding
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .collect();

        let total_size = entries.iter().map(|e| e.size).sum();
        let entry_count = entries.len();
        let expired_count = entries.iter().filter(|e| e.is_expired()).count();

        Ok(MetadataCacheStats {
            total_size,
            entry_count,
            expired_count,
            location: self.cache_dir.clone(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct CachedMetadata<T> {
    pub data: T,
    pub is_stale: bool,
    pub cached_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct MetadataCacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub expired_count: usize,
    pub location: PathBuf,
}

use sha2::Digest;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        value: i32,
    }

    #[tokio::test]
    async fn test_set_and_get() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        let data = TestData {
            name: "test".to_string(),
            value: 42,
        };

        cache.set("test-key", &data).await.unwrap();

        let cached = cache.get::<TestData>("test-key").await.unwrap().unwrap();
        assert_eq!(cached.data, data);
        assert!(!cached.is_stale);
    }

    #[tokio::test]
    async fn test_expiry() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        let data = TestData {
            name: "expired".to_string(),
            value: 0,
        };

        cache.set("expired-key", &data).await.unwrap();

        let cached = cache.get::<TestData>("expired-key").await.unwrap().unwrap();
        assert!(cached.is_stale);
    }

    #[tokio::test]
    async fn test_remove() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        cache.set("to-remove", &"value").await.unwrap();
        assert!(cache.get::<String>("to-remove").await.unwrap().is_some());

        cache.remove("to-remove").await.unwrap();
        assert!(cache.get::<String>("to-remove").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_preview_clean() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        // Add some metadata
        for i in 0..3 {
            cache
                .set(&format!("preview-key-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        // Preview should return all entries without deleting
        let entries = cache.preview_clean().await.unwrap();
        assert_eq!(entries.len(), 3);

        // Entries should still exist
        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 3);
    }

    #[tokio::test]
    async fn test_preview_expired() {
        let dir = tempdir().unwrap();
        // Create cache with negative TTL so entries are immediately expired
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        // Add expired entries
        for i in 0..2 {
            cache
                .set(&format!("expired-key-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        // Preview expired should return all entries (since TTL is -1)
        let entries = cache.preview_expired().await.unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[tokio::test]
    async fn test_clean_expired_with_option_permanent() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        for i in 0..2 {
            cache
                .set(&format!("expired-perm-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        let count = cache.clean_expired_with_option(false).await.unwrap();
        assert_eq!(count, 2);

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_clean_expired_with_option_trash() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        for i in 0..2 {
            cache
                .set(&format!("expired-trash-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        let count = cache.clean_expired_with_option(true).await.unwrap();
        assert_eq!(count, 2);

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_clean_all_with_option_permanent() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        for i in 0..3 {
            cache
                .set(&format!("all-perm-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        let count = cache.clean_all_with_option(false).await.unwrap();
        assert_eq!(count, 3);

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_clean_all_with_option_trash() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        for i in 0..3 {
            cache
                .set(&format!("all-trash-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        let count = cache.clean_all_with_option(true).await.unwrap();
        assert_eq!(count, 3);

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_set_with_custom_ttl() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        let data = TestData {
            name: "ttl-test".to_string(),
            value: 99,
        };

        // Set with very short TTL (already expired)
        cache.set_with_ttl("ttl-key", &data, -1).await.unwrap();

        let cached = cache.get::<TestData>("ttl-key").await.unwrap().unwrap();
        assert!(cached.is_stale);
        assert_eq!(cached.data, data);

        // Set with long TTL
        cache.set_with_ttl("ttl-key-long", &data, 86400).await.unwrap();

        let cached = cache.get::<TestData>("ttl-key-long").await.unwrap().unwrap();
        assert!(!cached.is_stale);
    }

    #[tokio::test]
    async fn test_stats_fields() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        // Add 3 entries (all expired due to TTL=-1)
        for i in 0..3 {
            cache
                .set(&format!("stats-{}", i), &format!("value-{}", i))
                .await
                .unwrap();
        }

        let stats = cache.stats().await.unwrap();
        assert_eq!(stats.entry_count, 3);
        assert!(stats.total_size > 0);
        assert_eq!(stats.expired_count, 3);
        assert!(stats.location.to_string_lossy().contains("metadata"));
    }

    #[tokio::test]
    async fn test_get_missing_file_on_disk() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        let data = TestData {
            name: "orphan".to_string(),
            value: 42,
        };
        cache.set("orphan-key", &data).await.unwrap();

        // Manually delete the metadata file from disk
        let metadata_dir = dir.path().join("metadata");
        let mut entries = tokio::fs::read_dir(&metadata_dir).await.unwrap();
        while let Some(entry) = entries.next_entry().await.unwrap() {
            tokio::fs::remove_file(entry.path()).await.unwrap();
        }

        // get() should return None and clean up the DB entry
        let result = cache.get::<TestData>("orphan-key").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_or_fetch_fresh_cache() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        let data = TestData {
            name: "cached".to_string(),
            value: 1,
        };
        cache.set("fetch-key", &data).await.unwrap();

        // Should return cached data without calling fetch
        let result = cache
            .get_or_fetch::<TestData, _, _>("fetch-key", || async {
                panic!("fetch should not be called when cache is fresh");
            })
            .await
            .unwrap();
        assert_eq!(result.name, "cached");
    }

    #[tokio::test]
    async fn test_get_or_fetch_stale_cache() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        let stale_data = TestData {
            name: "stale".to_string(),
            value: 1,
        };
        cache.set("stale-key", &stale_data).await.unwrap();

        // Fetch should be called because cache is stale
        let result = cache
            .get_or_fetch::<TestData, _, _>("stale-key", || async {
                Ok(TestData {
                    name: "fresh".to_string(),
                    value: 2,
                })
            })
            .await
            .unwrap();
        assert_eq!(result.name, "fresh");
        assert_eq!(result.value, 2);
    }

    #[tokio::test]
    async fn test_clean_expired_wrapper() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open_with_ttl(dir.path(), -1).await.unwrap();

        cache.set("exp-wrap", &"value").await.unwrap();

        let count = cache.clean_expired().await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_clean_all_wrapper() {
        let dir = tempdir().unwrap();
        let mut cache = MetadataCache::open(dir.path()).await.unwrap();

        cache.set("all-wrap", &"value").await.unwrap();

        let count = cache.clean_all().await.unwrap();
        assert_eq!(count, 1);
    }
}
