use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheIndex {
    pub version: u32,
    pub entries: Vec<CacheEntry>,
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub download_count: usize,
    pub metadata_count: usize,
    pub oldest_entry: Option<DateTime<Utc>>,
    pub newest_entry: Option<DateTime<Utc>>,
}

pub struct CacheDb {
    index_path: PathBuf,
    index: CacheIndex,
}

impl CacheDb {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let index_path = cache_dir.join("cache-index.json");

        fs::create_dir_all(cache_dir).await?;

        let index = if fs::exists(&index_path).await {
            let content = fs::read_file_string(&index_path).await?;
            serde_json::from_str(&content).unwrap_or_else(|_| CacheIndex {
                version: 1,
                entries: Vec::new(),
            })
        } else {
            CacheIndex {
                version: 1,
                entries: Vec::new(),
            }
        };

        Ok(Self { index_path, index })
    }

    pub async fn save(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.index)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;
        fs::write_file_atomic(&self.index_path, content.as_bytes()).await?;
        Ok(())
    }

    pub fn get(&self, key: &str) -> Option<&CacheEntry> {
        self.index.entries.iter().find(|e| e.key == key)
    }

    pub fn get_by_checksum(&self, checksum: &str) -> Option<&CacheEntry> {
        self.index.entries.iter().find(|e| e.checksum == checksum)
    }

    pub async fn insert(&mut self, entry: CacheEntry) -> CogniaResult<()> {
        if let Some(idx) = self.index.entries.iter().position(|e| e.key == entry.key) {
            self.index.entries[idx] = entry;
        } else {
            self.index.entries.push(entry);
        }
        self.save().await
    }

    pub async fn remove(&mut self, key: &str) -> CogniaResult<bool> {
        let len_before = self.index.entries.len();
        self.index.entries.retain(|e| e.key != key);

        if self.index.entries.len() != len_before {
            self.save().await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn touch(&mut self, key: &str) -> CogniaResult<()> {
        if let Some(entry) = self.index.entries.iter_mut().find(|e| e.key == key) {
            entry.last_accessed = Some(Utc::now());
            entry.hit_count += 1;
            self.save().await?;
        }
        Ok(())
    }

    pub fn stats(&self) -> CacheStats {
        let total_size = self.index.entries.iter().map(|e| e.size).sum();
        let entry_count = self.index.entries.len();
        let download_count = self
            .index
            .entries
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .count();
        let metadata_count = self
            .index
            .entries
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Metadata)
            .count();

        let oldest_entry = self.index.entries.iter().map(|e| e.created_at).min();
        let newest_entry = self.index.entries.iter().map(|e| e.created_at).max();

        CacheStats {
            total_size,
            entry_count,
            download_count,
            metadata_count,
            oldest_entry,
            newest_entry,
        }
    }

    pub fn get_expired(&self) -> Vec<&CacheEntry> {
        let now = Utc::now();
        self.index
            .entries
            .iter()
            .filter(|e| e.expires_at.map(|exp| exp < now).unwrap_or(false))
            .collect()
    }

    pub async fn remove_expired(&mut self) -> CogniaResult<usize> {
        let now = Utc::now();
        let len_before = self.index.entries.len();

        self.index
            .entries
            .retain(|e| e.expires_at.map(|exp| exp >= now).unwrap_or(true));

        let removed = len_before - self.index.entries.len();
        if removed > 0 {
            self.save().await?;
        }

        Ok(removed)
    }

    pub fn get_lru(&self, count: usize) -> Vec<&CacheEntry> {
        let mut entries: Vec<_> = self.index.entries.iter().collect();
        entries.sort_by_key(|e| e.last_accessed.unwrap_or(e.created_at));
        entries.into_iter().take(count).collect()
    }

    pub async fn evict_to_size(&mut self, max_size: u64) -> CogniaResult<usize> {
        let current_size: u64 = self.index.entries.iter().map(|e| e.size).sum();

        if current_size <= max_size {
            return Ok(0);
        }

        let mut entries: Vec<_> = self.index.entries.drain(..).collect();
        entries.sort_by_key(|e| std::cmp::Reverse(e.last_accessed.unwrap_or(e.created_at)));

        let mut kept_size = 0u64;
        let mut kept_entries = Vec::new();
        let mut removed_count = 0;

        for entry in entries {
            if kept_size + entry.size <= max_size {
                kept_size += entry.size;
                kept_entries.push(entry);
            } else {
                removed_count += 1;
            }
        }

        self.index.entries = kept_entries;

        if removed_count > 0 {
            self.save().await?;
        }

        Ok(removed_count)
    }

    pub async fn clear(&mut self) -> CogniaResult<()> {
        self.index.entries.clear();
        self.save().await
    }

    pub fn list(&self) -> &[CacheEntry] {
        &self.index.entries
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
}
