use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

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

    #[test]
    fn test_cache_entry_new() {
        let entry = CacheEntry::new("key", PathBuf::from("file"), 1024, "checksum", CacheEntryType::Download);
        assert_eq!(entry.key, "key");
        assert_eq!(entry.size, 1024);
        assert_eq!(entry.checksum, "checksum");
        assert_eq!(entry.entry_type, CacheEntryType::Download);
        assert_eq!(entry.hit_count, 0);
        assert!(entry.last_accessed.is_none());
        assert!(entry.expires_at.is_none());
    }

    #[test]
    fn test_cache_entry_type_equality() {
        assert_eq!(CacheEntryType::Download, CacheEntryType::Download);
        assert_ne!(CacheEntryType::Download, CacheEntryType::Metadata);
    }
}
