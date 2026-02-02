use crate::error::{CogniaError, CogniaResult};
use crate::platform::fs;
use chrono::Utc;
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use std::path::{Path, PathBuf};

use super::db::{CacheEntry, CacheEntryType, CacheStats};

/// SQLite-based cache database for improved performance and ACID compliance
pub struct SqliteCacheDb {
    pool: SqlitePool,
    cache_dir: PathBuf,
}

#[derive(Debug, FromRow)]
struct CacheEntryRow {
    key: String,
    file_path: String,
    size: i64,
    checksum: String,
    created_at: String,
    last_accessed: Option<String>,
    expires_at: Option<String>,
    hit_count: i32,
    entry_type: String,
}

impl SqliteCacheDb {
    /// Open or create a SQLite cache database
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        fs::create_dir_all(cache_dir).await?;

        let db_path = cache_dir.join("cache.db");
        let url = format!("sqlite:{}?mode=rwc", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to open cache database: {}", e)))?;

        // Run migrations
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS cache_entries (
                key TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                size INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_accessed TEXT,
                expires_at TEXT,
                hit_count INTEGER DEFAULT 0,
                entry_type TEXT NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to create cache table: {}", e)))?;

        // Create indexes for common queries
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
            CREATE INDEX IF NOT EXISTS idx_cache_type ON cache_entries(entry_type);
            CREATE INDEX IF NOT EXISTS idx_cache_accessed ON cache_entries(last_accessed);
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to create indexes: {}", e)))?;

        Ok(Self {
            pool,
            cache_dir: cache_dir.to_path_buf(),
        })
    }

    /// Migrate from JSON-based cache index to SQLite
    pub async fn migrate_from_json(&self, json_path: &Path) -> CogniaResult<usize> {
        if !fs::exists(json_path).await {
            return Ok(0);
        }

        let content = fs::read_file_string(json_path).await?;
        let index: super::db::CacheIndex = serde_json::from_str(&content)
            .map_err(|e| CogniaError::Parse(format!("Failed to parse JSON cache index: {}", e)))?;

        let mut migrated = 0;
        for (_key, entry) in index.entries {
            if self.insert(entry).await.is_ok() {
                migrated += 1;
            }
        }

        // Backup the old JSON file
        let backup_path = json_path.with_extension("json.bak");
        let _ = fs::move_file(json_path, &backup_path).await;

        Ok(migrated)
    }

    /// Get a cache entry by key
    pub async fn get(&self, key: &str) -> CogniaResult<Option<CacheEntry>> {
        let row: Option<CacheEntryRow> = sqlx::query_as(
            "SELECT * FROM cache_entries WHERE key = ?",
        )
        .bind(key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(row.map(Self::row_to_entry))
    }

    /// Get a cache entry by checksum
    pub async fn get_by_checksum(&self, checksum: &str) -> CogniaResult<Option<CacheEntry>> {
        let row: Option<CacheEntryRow> = sqlx::query_as(
            "SELECT * FROM cache_entries WHERE checksum = ?",
        )
        .bind(checksum)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(row.map(Self::row_to_entry))
    }

    /// Insert or update a cache entry
    pub async fn insert(&self, entry: CacheEntry) -> CogniaResult<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO cache_entries 
            (key, file_path, size, checksum, created_at, last_accessed, expires_at, hit_count, entry_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry.key)
        .bind(entry.file_path.display().to_string())
        .bind(entry.size as i64)
        .bind(&entry.checksum)
        .bind(entry.created_at.to_rfc3339())
        .bind(entry.last_accessed.map(|d| d.to_rfc3339()))
        .bind(entry.expires_at.map(|d| d.to_rfc3339()))
        .bind(entry.hit_count as i32)
        .bind(Self::entry_type_to_str(entry.entry_type))
        .execute(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(())
    }

    /// Remove a cache entry by key
    pub async fn remove(&self, key: &str) -> CogniaResult<bool> {
        let result = sqlx::query("DELETE FROM cache_entries WHERE key = ?")
            .bind(key)
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    /// Update last accessed time and hit count
    pub async fn touch(&self, key: &str) -> CogniaResult<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE cache_entries SET last_accessed = ?, hit_count = hit_count + 1 WHERE key = ?",
        )
        .bind(&now)
        .bind(key)
        .execute(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(())
    }

    /// Get cache statistics
    pub async fn stats(&self) -> CogniaResult<CacheStats> {
        #[derive(FromRow)]
        struct StatsRow {
            total_size: Option<i64>,
            entry_count: i64,
            download_count: i64,
            metadata_count: i64,
            oldest_entry: Option<String>,
            newest_entry: Option<String>,
        }

        let row: StatsRow = sqlx::query_as(
            r#"
            SELECT 
                COALESCE(SUM(size), 0) as total_size,
                COUNT(*) as entry_count,
                SUM(CASE WHEN entry_type = 'download' THEN 1 ELSE 0 END) as download_count,
                SUM(CASE WHEN entry_type = 'metadata' THEN 1 ELSE 0 END) as metadata_count,
                MIN(created_at) as oldest_entry,
                MAX(created_at) as newest_entry
            FROM cache_entries
            "#,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(CacheStats {
            total_size: row.total_size.unwrap_or(0) as u64,
            entry_count: row.entry_count as usize,
            download_count: row.download_count as usize,
            metadata_count: row.metadata_count as usize,
            oldest_entry: row.oldest_entry.and_then(|s| s.parse().ok()),
            newest_entry: row.newest_entry.and_then(|s| s.parse().ok()),
            hits: 0,
            misses: 0,
            hit_rate: 0.0,
        })
    }

    /// Get all expired entries
    pub async fn get_expired(&self) -> CogniaResult<Vec<CacheEntry>> {
        let now = Utc::now().to_rfc3339();
        let rows: Vec<CacheEntryRow> = sqlx::query_as(
            "SELECT * FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < ?",
        )
        .bind(&now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    /// Remove all expired entries
    pub async fn remove_expired(&self) -> CogniaResult<usize> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < ?",
        )
        .bind(&now)
        .execute(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(result.rows_affected() as usize)
    }

    /// Get least recently used entries
    pub async fn get_lru(&self, count: usize) -> CogniaResult<Vec<CacheEntry>> {
        let rows: Vec<CacheEntryRow> = sqlx::query_as(
            "SELECT * FROM cache_entries ORDER BY COALESCE(last_accessed, created_at) ASC LIMIT ?",
        )
        .bind(count as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    /// Evict entries until total size is under max_size
    pub async fn evict_to_size(&self, max_size: u64) -> CogniaResult<usize> {
        let stats = self.stats().await?;
        if stats.total_size <= max_size {
            return Ok(0);
        }

        let mut to_free = stats.total_size - max_size;
        let mut removed = 0;

        // Get LRU entries and remove until we're under the limit
        let lru_entries = self.get_lru(100).await?;
        for entry in lru_entries {
            if to_free == 0 {
                break;
            }
            if self.remove(&entry.key).await? {
                removed += 1;
                to_free = to_free.saturating_sub(entry.size);
            }
        }

        Ok(removed)
    }

    /// Clear all cache entries
    pub async fn clear(&self) -> CogniaResult<()> {
        sqlx::query("DELETE FROM cache_entries")
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(())
    }

    /// List all cache entries
    pub async fn list(&self) -> CogniaResult<Vec<CacheEntry>> {
        let rows: Vec<CacheEntryRow> = sqlx::query_as("SELECT * FROM cache_entries")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    // Helper: Convert row to CacheEntry
    fn row_to_entry(row: CacheEntryRow) -> CacheEntry {
        CacheEntry {
            key: row.key,
            file_path: PathBuf::from(row.file_path),
            size: row.size as u64,
            checksum: row.checksum,
            created_at: row.created_at.parse().unwrap_or_else(|_| Utc::now()),
            last_accessed: row.last_accessed.and_then(|s| s.parse().ok()),
            expires_at: row.expires_at.and_then(|s| s.parse().ok()),
            hit_count: row.hit_count as u32,
            entry_type: Self::str_to_entry_type(&row.entry_type),
        }
    }

    // Helper: Convert entry type to string
    fn entry_type_to_str(entry_type: CacheEntryType) -> &'static str {
        match entry_type {
            CacheEntryType::Download => "download",
            CacheEntryType::Metadata => "metadata",
            CacheEntryType::Index => "index",
            CacheEntryType::Partial => "partial",
        }
    }

    // Helper: Convert string to entry type
    fn str_to_entry_type(s: &str) -> CacheEntryType {
        match s {
            "download" => CacheEntryType::Download,
            "metadata" => CacheEntryType::Metadata,
            "index" => CacheEntryType::Index,
            "partial" => CacheEntryType::Partial,
            _ => CacheEntryType::Download,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_sqlite_cache_db_operations() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "test-key",
            dir.path().join("test-file"),
            1024,
            "abc123",
            CacheEntryType::Download,
        );

        db.insert(entry.clone()).await.unwrap();

        let retrieved = db.get("test-key").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().key, "test-key");

        let stats = db.stats().await.unwrap();
        assert_eq!(stats.entry_count, 1);

        db.remove("test-key").await.unwrap();
        let retrieved = db.get("test-key").await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_sqlite_cache_expiry() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

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

        assert!(db.get("valid").await.unwrap().is_some());
        assert!(db.get("expired").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_sqlite_cache_touch() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "touch-key",
            dir.path().join("touch-file"),
            512,
            "touch123",
            CacheEntryType::Download,
        );

        db.insert(entry).await.unwrap();

        // Touch the entry to update last_accessed and hit_count
        db.touch("touch-key").await.unwrap();

        let retrieved = db.get("touch-key").await.unwrap().unwrap();
        assert!(retrieved.last_accessed.is_some());
        assert_eq!(retrieved.hit_count, 1);

        // Touch again
        db.touch("touch-key").await.unwrap();
        let retrieved = db.get("touch-key").await.unwrap().unwrap();
        assert_eq!(retrieved.hit_count, 2);
    }

    #[tokio::test]
    async fn test_sqlite_cache_get_by_checksum() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        let entry = CacheEntry::new(
            "checksum-key",
            dir.path().join("checksum-file"),
            256,
            "unique-checksum-abc",
            CacheEntryType::Download,
        );

        db.insert(entry).await.unwrap();

        let retrieved = db.get_by_checksum("unique-checksum-abc").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().key, "checksum-key");

        let not_found = db.get_by_checksum("nonexistent").await.unwrap();
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_sqlite_cache_stats() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Empty stats
        let stats = db.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size, 0);

        // Add entries
        db.insert(CacheEntry::new("d1", dir.path().join("d1"), 100, "c1", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("d2", dir.path().join("d2"), 200, "c2", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("m1", dir.path().join("m1"), 50, "c3", CacheEntryType::Metadata)).await.unwrap();

        let stats = db.stats().await.unwrap();
        assert_eq!(stats.entry_count, 3);
        assert_eq!(stats.total_size, 350);
        assert_eq!(stats.download_count, 2);
        assert_eq!(stats.metadata_count, 1);
    }

    #[tokio::test]
    async fn test_sqlite_cache_list() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.insert(CacheEntry::new("list1", dir.path().join("l1"), 100, "c1", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("list2", dir.path().join("l2"), 200, "c2", CacheEntryType::Download)).await.unwrap();

        let entries = db.list().await.unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[tokio::test]
    async fn test_sqlite_cache_clear() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.insert(CacheEntry::new("clear1", dir.path().join("c1"), 100, "c1", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("clear2", dir.path().join("c2"), 200, "c2", CacheEntryType::Download)).await.unwrap();

        let stats = db.stats().await.unwrap();
        assert_eq!(stats.entry_count, 2);

        db.clear().await.unwrap();

        let stats = db.stats().await.unwrap();
        assert_eq!(stats.entry_count, 0);
    }

    #[tokio::test]
    async fn test_sqlite_cache_get_lru() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Insert entries and touch some to update last_accessed
        db.insert(CacheEntry::new("lru1", dir.path().join("lru1"), 100, "c1", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("lru2", dir.path().join("lru2"), 100, "c2", CacheEntryType::Download)).await.unwrap();
        db.insert(CacheEntry::new("lru3", dir.path().join("lru3"), 100, "c3", CacheEntryType::Download)).await.unwrap();

        // Touch lru2 and lru3 to make them more recently used
        db.touch("lru2").await.unwrap();
        db.touch("lru3").await.unwrap();

        // Get LRU entries - lru1 should be first (least recently used)
        let lru_entries = db.get_lru(2).await.unwrap();
        assert_eq!(lru_entries.len(), 2);
        assert_eq!(lru_entries[0].key, "lru1");
    }

    #[test]
    fn test_entry_type_conversion() {
        assert_eq!(SqliteCacheDb::entry_type_to_str(CacheEntryType::Download), "download");
        assert_eq!(SqliteCacheDb::entry_type_to_str(CacheEntryType::Metadata), "metadata");
        assert_eq!(SqliteCacheDb::entry_type_to_str(CacheEntryType::Index), "index");
        assert_eq!(SqliteCacheDb::entry_type_to_str(CacheEntryType::Partial), "partial");

        assert!(matches!(SqliteCacheDb::str_to_entry_type("download"), CacheEntryType::Download));
        assert!(matches!(SqliteCacheDb::str_to_entry_type("metadata"), CacheEntryType::Metadata));
        assert!(matches!(SqliteCacheDb::str_to_entry_type("index"), CacheEntryType::Index));
        assert!(matches!(SqliteCacheDb::str_to_entry_type("partial"), CacheEntryType::Partial));
        assert!(matches!(SqliteCacheDb::str_to_entry_type("unknown"), CacheEntryType::Download));
    }
}
