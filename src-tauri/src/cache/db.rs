use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub file_path: PathBuf,
    pub size: u64,
    pub checksum: String,
    pub created_at: DateTime<Utc>,
    pub last_accessed: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub hit_count: u32,
    pub entry_type: CacheEntryType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum CacheEntryType {
    Download,
    Metadata,
    Index,
    Partial,
}

#[derive(Debug, Clone, Default)]
pub struct CacheIndex {
    pub version: u32,
    pub entries: HashMap<String, CacheEntry>,
    pub checksum_index: HashMap<String, String>,
}

/// Custom serialization to maintain backward compatibility with Vec<CacheEntry> format
impl Serialize for CacheIndex {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("CacheIndex", 2)?;
        state.serialize_field("version", &self.version)?;
        let entries_vec: Vec<&CacheEntry> = self.entries.values().collect();
        state.serialize_field("entries", &entries_vec)?;
        state.end()
    }
}

impl<'de> Deserialize<'de> for CacheIndex {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawCacheIndex {
            version: u32,
            entries: Vec<CacheEntry>,
        }
        let raw = RawCacheIndex::deserialize(deserializer)?;
        let mut entries = HashMap::new();
        let mut checksum_index = HashMap::new();
        for entry in raw.entries {
            checksum_index.insert(entry.checksum.clone(), entry.key.clone());
            entries.insert(entry.key.clone(), entry);
        }
        Ok(CacheIndex {
            version: raw.version,
            entries,
            checksum_index,
        })
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub download_count: usize,
    pub metadata_count: usize,
    pub oldest_entry: Option<DateTime<Utc>>,
    pub newest_entry: Option<DateTime<Utc>>,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

const FLUSH_INTERVAL_SECS: u64 = 30;

pub struct CacheDb {
    index_path: PathBuf,
    index: CacheIndex,
    dirty: bool,
    last_flush: std::time::Instant,
    stats_hits: u64,
    stats_misses: u64,
}

impl CacheDb {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let index_path = cache_dir.join("cache-index.json");

        fs::create_dir_all(cache_dir).await?;

        let index = if fs::exists(&index_path).await {
            let content = fs::read_file_string(&index_path).await?;
            serde_json::from_str(&content).unwrap_or_else(|_| CacheIndex {
                version: 1,
                entries: HashMap::new(),
                checksum_index: HashMap::new(),
            })
        } else {
            CacheIndex {
                version: 1,
                entries: HashMap::new(),
                checksum_index: HashMap::new(),
            }
        };

        Ok(Self {
            index_path,
            index,
            dirty: false,
            last_flush: std::time::Instant::now(),
            stats_hits: 0,
            stats_misses: 0,
        })
    }

    fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub async fn flush_if_needed(&mut self) -> CogniaResult<()> {
        if self.dirty && self.last_flush.elapsed().as_secs() >= FLUSH_INTERVAL_SECS {
            self.flush().await?;
        }
        Ok(())
    }

    pub async fn flush(&mut self) -> CogniaResult<()> {
        if self.dirty {
            self.save().await?;
            self.dirty = false;
            self.last_flush = std::time::Instant::now();
        }
        Ok(())
    }

    pub async fn save(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.index)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;
        fs::write_file_atomic(&self.index_path, content.as_bytes()).await?;
        Ok(())
    }

    pub fn get(&mut self, key: &str) -> Option<&CacheEntry> {
        if self.index.entries.contains_key(key) {
            self.stats_hits += 1;
            self.index.entries.get(key)
        } else {
            self.stats_misses += 1;
            None
        }
    }

    pub fn get_without_stats(&self, key: &str) -> Option<&CacheEntry> {
        self.index.entries.get(key)
    }

    pub fn get_by_checksum(&mut self, checksum: &str) -> Option<&CacheEntry> {
        if let Some(key) = self.index.checksum_index.get(checksum) {
            self.stats_hits += 1;
            self.index.entries.get(key)
        } else {
            self.stats_misses += 1;
            None
        }
    }

    pub async fn insert(&mut self, entry: CacheEntry) -> CogniaResult<()> {
        self.index
            .checksum_index
            .insert(entry.checksum.clone(), entry.key.clone());
        self.index.entries.insert(entry.key.clone(), entry);
        self.mark_dirty();
        self.flush_if_needed().await
    }

    pub async fn remove(&mut self, key: &str) -> CogniaResult<bool> {
        if let Some(entry) = self.index.entries.remove(key) {
            self.index.checksum_index.remove(&entry.checksum);
            self.mark_dirty();
            self.flush_if_needed().await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn touch(&mut self, key: &str) -> CogniaResult<()> {
        if let Some(entry) = self.index.entries.get_mut(key) {
            entry.last_accessed = Some(Utc::now());
            entry.hit_count += 1;
            self.mark_dirty();
        }
        Ok(())
    }

    pub fn stats(&self) -> CacheStats {
        let total_size = self.index.entries.values().map(|e| e.size).sum();
        let entry_count = self.index.entries.len();
        let download_count = self
            .index
            .entries
            .values()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .count();
        let metadata_count = self
            .index
            .entries
            .values()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .count();

        let oldest_entry = self.index.entries.values().map(|e| e.created_at).min();
        let newest_entry = self.index.entries.values().map(|e| e.created_at).max();

        let total_requests = self.stats_hits + self.stats_misses;
        let hit_rate = if total_requests > 0 {
            self.stats_hits as f64 / total_requests as f64
        } else {
            0.0
        };

        CacheStats {
            total_size,
            entry_count,
            download_count,
            metadata_count,
            oldest_entry,
            newest_entry,
            hits: self.stats_hits,
            misses: self.stats_misses,
            hit_rate,
        }
    }

    pub fn reset_stats(&mut self) {
        self.stats_hits = 0;
        self.stats_misses = 0;
    }

    pub fn get_expired(&self) -> Vec<&CacheEntry> {
        let now = Utc::now();
        self.index
            .entries
            .values()
            .filter(|e| e.expires_at.map(|exp| exp < now).unwrap_or(false))
            .collect()
    }

    pub async fn remove_expired(&mut self) -> CogniaResult<usize> {
        let now = Utc::now();
        let expired_keys: Vec<String> = self
            .index
            .entries
            .iter()
            .filter(|(_, e)| e.expires_at.map(|exp| exp < now).unwrap_or(false))
            .map(|(k, _)| k.clone())
            .collect();

        let removed = expired_keys.len();
        for key in &expired_keys {
            if let Some(entry) = self.index.entries.remove(key) {
                self.index.checksum_index.remove(&entry.checksum);
            }
        }

        if removed > 0 {
            self.save().await?;
        }

        Ok(removed)
    }

    pub fn get_lru(&self, count: usize) -> Vec<&CacheEntry> {
        let mut entries: Vec<_> = self.index.entries.values().collect();
        entries.sort_by_key(|e| e.last_accessed.unwrap_or(e.created_at));
        entries.into_iter().take(count).collect()
    }

    pub async fn evict_to_size(&mut self, max_size: u64) -> CogniaResult<usize> {
        let current_size: u64 = self.index.entries.values().map(|e| e.size).sum();

        if current_size <= max_size {
            return Ok(0);
        }

        let mut entries: Vec<_> = self.index.entries.drain().collect();
        entries.sort_by_key(|(_, e)| std::cmp::Reverse(e.last_accessed.unwrap_or(e.created_at)));

        let mut kept_size = 0u64;
        let mut removed_count = 0;

        self.index.checksum_index.clear();

        for (key, entry) in entries {
            if kept_size + entry.size <= max_size {
                kept_size += entry.size;
                self.index
                    .checksum_index
                    .insert(entry.checksum.clone(), key.clone());
                self.index.entries.insert(key, entry);
            } else {
                removed_count += 1;
            }
        }

        if removed_count > 0 {
            self.save().await?;
        }

        Ok(removed_count)
    }

    pub async fn clear(&mut self) -> CogniaResult<()> {
        self.index.entries.clear();
        self.save().await
    }

    pub fn list(&self) -> Vec<&CacheEntry> {
        self.index.entries.values().collect()
    }
}

impl CacheEntry {
    pub fn new(
        key: impl Into<String>,
        file_path: impl Into<PathBuf>,
        size: u64,
        checksum: impl Into<String>,
        entry_type: CacheEntryType,
    ) -> Self {
        Self {
            key: key.into(),
            file_path: file_path.into(),
            size,
            checksum: checksum.into(),
            created_at: Utc::now(),
            last_accessed: None,
            expires_at: None,
            hit_count: 0,
            entry_type,
        }
    }

    pub fn with_expiry(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }

    pub fn with_ttl(mut self, ttl_seconds: i64) -> Self {
        self.expires_at = Some(Utc::now() + chrono::Duration::seconds(ttl_seconds));
        self
    }

    pub fn is_expired(&self) -> bool {
        self.expires_at.map(|exp| exp < Utc::now()).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_cache_db_operations() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "test-key",
            dir.path().join("test-file"),
            1024,
            "abc123",
            CacheEntryType::Download,
        );

        db.insert(entry.clone()).await.unwrap();

        assert!(db.get("test-key").is_some());
        assert_eq!(db.stats().entry_count, 1);

        db.remove("test-key").await.unwrap();
        assert!(db.get("test-key").is_none());
    }

    #[tokio::test]
    async fn test_cache_expiry() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let expired_entry = CacheEntry::new(
            "expired",
            dir.path().join("expired"),
            100,
            "exp",
            CacheEntryType::Metadata,
        )
        .with_ttl(-1);

        let valid_entry = CacheEntry::new(
            "valid",
            dir.path().join("valid"),
            100,
            "val",
            CacheEntryType::Metadata,
        )
        .with_ttl(3600);

        db.insert(expired_entry).await.unwrap();
        db.insert(valid_entry).await.unwrap();

        let removed = db.remove_expired().await.unwrap();
        assert_eq!(removed, 1);
        assert!(db.get("valid").is_some());
        assert!(db.get("expired").is_none());
    }

    #[tokio::test]
    async fn test_hashmap_index_o1_lookup() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        // Insert multiple entries
        for i in 0..100 {
            let entry = CacheEntry::new(
                format!("key-{}", i),
                dir.path().join(format!("file-{}", i)),
                1024,
                format!("checksum-{}", i),
                CacheEntryType::Download,
            );
            db.insert(entry).await.unwrap();
        }

        // Verify O(1) lookup by key
        assert!(db.get("key-50").is_some());
        assert!(db.get("key-99").is_some());
        assert!(db.get("key-nonexistent").is_none());

        // Verify O(1) lookup by checksum
        assert!(db.get_by_checksum("checksum-50").is_some());
        assert!(db.get_by_checksum("checksum-99").is_some());
        assert!(db.get_by_checksum("nonexistent").is_none());
    }

    #[tokio::test]
    async fn test_checksum_index() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "my-key",
            dir.path().join("my-file"),
            2048,
            "sha256-abc123",
            CacheEntryType::Download,
        );

        db.insert(entry).await.unwrap();

        // Lookup by checksum should work
        let found = db.get_by_checksum("sha256-abc123");
        assert!(found.is_some());
        assert_eq!(found.unwrap().key, "my-key");

        // Remove by key should also remove from checksum index
        db.remove("my-key").await.unwrap();
        assert!(db.get_by_checksum("sha256-abc123").is_none());
    }

    #[tokio::test]
    async fn test_hit_miss_statistics() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "stats-key",
            dir.path().join("stats-file"),
            1024,
            "stats-checksum",
            CacheEntryType::Download,
        );
        db.insert(entry).await.unwrap();

        // Initial stats should be 0
        let stats = db.stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 0);

        // Hit: get existing key
        let _ = db.get("stats-key");
        let stats = db.stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 0);

        // Miss: get non-existing key
        let _ = db.get("nonexistent");
        let stats = db.stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 1);

        // Hit rate calculation
        assert!((stats.hit_rate - 0.5).abs() < 0.01);

        // Reset stats
        db.reset_stats();
        let stats = db.stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 0);
    }

    #[tokio::test]
    async fn test_dirty_flag_and_flush() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "flush-key",
            dir.path().join("flush-file"),
            1024,
            "flush-checksum",
            CacheEntryType::Download,
        );

        // Insert marks dirty and may flush
        db.insert(entry).await.unwrap();

        // Force flush
        db.flush().await.unwrap();

        // Reopen and verify persistence
        let mut db2 = CacheDb::open(dir.path()).await.unwrap();
        assert!(db2.get("flush-key").is_some());
    }

    #[tokio::test]
    async fn test_touch_updates_access_time() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "touch-key",
            dir.path().join("touch-file"),
            1024,
            "touch-checksum",
            CacheEntryType::Download,
        );
        db.insert(entry).await.unwrap();

        // Get initial hit count
        let initial_hit_count = db.get_without_stats("touch-key").unwrap().hit_count;

        // Touch the entry
        db.touch("touch-key").await.unwrap();

        // Verify hit count increased
        let updated = db.get_without_stats("touch-key").unwrap();
        assert_eq!(updated.hit_count, initial_hit_count + 1);
        assert!(updated.last_accessed.is_some());
    }

    #[tokio::test]
    async fn test_evict_to_size() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        // Insert entries totaling 3000 bytes
        for i in 0..3 {
            let entry = CacheEntry::new(
                format!("evict-key-{}", i),
                dir.path().join(format!("evict-file-{}", i)),
                1000,
                format!("evict-checksum-{}", i),
                CacheEntryType::Download,
            );
            db.insert(entry).await.unwrap();
        }

        assert_eq!(db.stats().total_size, 3000);

        // Evict to 2000 bytes
        let removed = db.evict_to_size(2000).await.unwrap();
        assert!(removed >= 1);
        assert!(db.stats().total_size <= 2000);
    }

    #[tokio::test]
    async fn test_get_without_stats() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "no-stats-key",
            dir.path().join("no-stats-file"),
            1024,
            "ns-checksum",
            CacheEntryType::Download,
        );
        db.insert(entry).await.unwrap();

        // get_without_stats should not affect hit/miss counters
        let found = db.get_without_stats("no-stats-key");
        assert!(found.is_some());
        assert_eq!(found.unwrap().key, "no-stats-key");

        let not_found = db.get_without_stats("nonexistent");
        assert!(not_found.is_none());

        let stats = db.stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 0);
    }

    #[tokio::test]
    async fn test_get_expired_entries() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let expired = CacheEntry::new(
            "exp1",
            dir.path().join("exp1"),
            100,
            "e1",
            CacheEntryType::Metadata,
        )
        .with_ttl(-1);

        let valid = CacheEntry::new(
            "val1",
            dir.path().join("val1"),
            100,
            "v1",
            CacheEntryType::Download,
        )
        .with_ttl(3600);

        let no_expiry = CacheEntry::new(
            "noexp",
            dir.path().join("noexp"),
            100,
            "ne",
            CacheEntryType::Download,
        );

        db.insert(expired).await.unwrap();
        db.insert(valid).await.unwrap();
        db.insert(no_expiry).await.unwrap();

        let expired_list = db.get_expired();
        assert_eq!(expired_list.len(), 1);
        assert_eq!(expired_list[0].key, "exp1");
    }

    #[tokio::test]
    async fn test_get_lru_entries() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        for i in 0..5 {
            let entry = CacheEntry::new(
                format!("lru-{}", i),
                dir.path().join(format!("lru-{}", i)),
                100,
                format!("lru-c-{}", i),
                CacheEntryType::Download,
            );
            db.insert(entry).await.unwrap();
        }

        // Touch some entries to make them more recently used
        db.touch("lru-3").await.unwrap();
        db.touch("lru-4").await.unwrap();

        let lru = db.get_lru(3);
        assert_eq!(lru.len(), 3);
        // Entries without last_accessed should come first (sorted by created_at)
    }

    #[tokio::test]
    async fn test_clear_all() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        for i in 0..5 {
            let entry = CacheEntry::new(
                format!("clear-{}", i),
                dir.path().join(format!("clear-{}", i)),
                100,
                format!("cl-{}", i),
                CacheEntryType::Download,
            );
            db.insert(entry).await.unwrap();
        }

        assert_eq!(db.stats().entry_count, 5);

        db.clear().await.unwrap();
        assert_eq!(db.stats().entry_count, 0);
        assert_eq!(db.stats().total_size, 0);
    }

    #[tokio::test]
    async fn test_list_entries() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        assert!(db.list().is_empty());

        for i in 0..3 {
            let entry = CacheEntry::new(
                format!("list-{}", i),
                dir.path().join(format!("list-{}", i)),
                200,
                format!("ls-{}", i),
                CacheEntryType::Metadata,
            );
            db.insert(entry).await.unwrap();
        }

        let entries = db.list();
        assert_eq!(entries.len(), 3);
    }

    #[tokio::test]
    async fn test_remove_nonexistent_returns_false() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let removed = db.remove("does-not-exist").await.unwrap();
        assert!(!removed);
    }

    #[tokio::test]
    async fn test_insert_overwrite() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry1 = CacheEntry::new(
            "dup-key",
            dir.path().join("file1"),
            100,
            "checksum-old",
            CacheEntryType::Download,
        );
        db.insert(entry1).await.unwrap();

        let entry2 = CacheEntry::new(
            "dup-key",
            dir.path().join("file2"),
            200,
            "checksum-new",
            CacheEntryType::Download,
        );
        db.insert(entry2).await.unwrap();

        // Should have only one entry
        assert_eq!(db.stats().entry_count, 1);
        assert_eq!(db.stats().total_size, 200);

        // Checksum index should be updated
        assert!(db.get_by_checksum("checksum-new").is_some());
    }

    #[test]
    fn test_cache_entry_is_expired() {
        let expired = CacheEntry::new("k", PathBuf::from("f"), 0, "c", CacheEntryType::Download)
            .with_ttl(-1);
        assert!(expired.is_expired());

        let valid = CacheEntry::new("k2", PathBuf::from("f2"), 0, "c2", CacheEntryType::Download)
            .with_ttl(3600);
        assert!(!valid.is_expired());

        let no_expiry =
            CacheEntry::new("k3", PathBuf::from("f3"), 0, "c3", CacheEntryType::Download);
        assert!(!no_expiry.is_expired());
    }

    #[test]
    fn test_cache_entry_with_expiry() {
        let future_time = Utc::now() + chrono::Duration::hours(1);
        let entry =
            CacheEntry::new("k", PathBuf::from("f"), 0, "c", CacheEntryType::Download)
                .with_expiry(future_time);
        assert!(!entry.is_expired());
        assert_eq!(entry.expires_at, Some(future_time));
    }

    #[tokio::test]
    async fn test_serialization_backward_compatibility() {
        let dir = tempdir().unwrap();
        let mut db = CacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "compat-key",
            dir.path().join("compat-file"),
            512,
            "compat-checksum",
            CacheEntryType::Metadata,
        );
        db.insert(entry).await.unwrap();
        db.flush().await.unwrap();

        // Read the JSON file directly to verify format
        let index_path = dir.path().join("cache-index.json");
        let content = std::fs::read_to_string(&index_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Verify it's serialized as array (backward compatible)
        assert!(json["entries"].is_array());
        assert_eq!(json["entries"].as_array().unwrap().len(), 1);
    }
}
