use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk::format_size, fs};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use super::db::{CacheEntry, CacheEntryType, CacheStats};

/// Cache access statistics for hit rate tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheAccessStats {
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
    pub total_requests: u64,
    pub last_reset: Option<DateTime<Utc>>,
}

impl Default for CacheAccessStats {
    fn default() -> Self {
        Self {
            hits: 0,
            misses: 0,
            hit_rate: 0.0,
            total_requests: 0,
            last_reset: Some(Utc::now()),
        }
    }
}

/// SQLite-based cache database for improved performance and ACID compliance
pub struct SqliteCacheDb {
    pool: SqlitePool,
    cache_dir: PathBuf,
    // In-memory stats counters for performance (persisted periodically)
    stats_hits: AtomicU64,
    stats_misses: AtomicU64,
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

        // Enable WAL mode for better concurrent read/write performance
        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("Failed to set WAL mode: {}", e)))?;
        sqlx::query("PRAGMA synchronous=NORMAL")
            .execute(&pool)
            .await
            .map_err(|e| {
                CogniaError::Internal(format!("Failed to set synchronous mode: {}", e))
            })?;

        // Run migrations for cache_entries table
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

        // Create cache_access_stats table for hit/miss tracking
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS cache_access_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                hits INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                last_reset TEXT NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to create stats table: {}", e)))?;

        // Initialize stats row if not exists
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO cache_access_stats (id, hits, misses, last_reset)
            VALUES (1, 0, 0, ?)
            "#,
        )
        .bind(Utc::now().to_rfc3339())
        .execute(&pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to init stats: {}", e)))?;

        // Create indexes for common queries
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
            CREATE INDEX IF NOT EXISTS idx_cache_type ON cache_entries(entry_type);
            CREATE INDEX IF NOT EXISTS idx_cache_accessed ON cache_entries(last_accessed);
            CREATE INDEX IF NOT EXISTS idx_cache_hit_count ON cache_entries(hit_count DESC);
            CREATE INDEX IF NOT EXISTS idx_cache_checksum ON cache_entries(checksum);
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to create indexes: {}", e)))?;

        // Create cache_size_snapshots table for trend tracking
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS cache_size_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                internal_size INTEGER NOT NULL,
                download_count INTEGER NOT NULL,
                metadata_count INTEGER NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| {
            CogniaError::Internal(format!("Failed to create snapshots table: {}", e))
        })?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_snapshot_ts ON cache_size_snapshots(timestamp)",
        )
        .execute(&pool)
        .await
        .map_err(|e| {
            CogniaError::Internal(format!("Failed to create snapshot index: {}", e))
        })?;

        // Load persisted stats
        let (hits, misses) = Self::load_stats_from_db(&pool).await.unwrap_or((0, 0));

        let db = Self {
            pool,
            cache_dir: cache_dir.to_path_buf(),
            stats_hits: AtomicU64::new(hits),
            stats_misses: AtomicU64::new(misses),
        };

        let json_path = db.cache_dir.join("cache-index.json");
        if fs::exists(&json_path).await {
            let stats = db.stats().await?;
            if stats.entry_count == 0 {
                let _ = db.migrate_from_json(&json_path).await?;
            }
        }

        Ok(db)
    }

    /// Load stats from database
    async fn load_stats_from_db(pool: &SqlitePool) -> CogniaResult<(u64, u64)> {
        #[derive(FromRow)]
        struct StatsRow {
            hits: i64,
            misses: i64,
        }

        let row: Option<StatsRow> =
            sqlx::query_as("SELECT hits, misses FROM cache_access_stats WHERE id = 1")
                .fetch_optional(pool)
                .await
                .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(row
            .map(|r| (r.hits as u64, r.misses as u64))
            .unwrap_or((0, 0)))
    }

    /// Persist current stats to database
    pub async fn persist_stats(&self) -> CogniaResult<()> {
        let hits = self.stats_hits.load(Ordering::Relaxed);
        let misses = self.stats_misses.load(Ordering::Relaxed);

        sqlx::query("UPDATE cache_access_stats SET hits = ?, misses = ? WHERE id = 1")
            .bind(hits as i64)
            .bind(misses as i64)
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(())
    }

    /// Get current access statistics
    pub fn get_access_stats(&self) -> CacheAccessStats {
        let hits = self.stats_hits.load(Ordering::Relaxed);
        let misses = self.stats_misses.load(Ordering::Relaxed);
        let total = hits + misses;
        let hit_rate = if total > 0 {
            hits as f64 / total as f64
        } else {
            0.0
        };

        CacheAccessStats {
            hits,
            misses,
            hit_rate,
            total_requests: total,
            last_reset: None, // Will be filled from DB if needed
        }
    }

    /// Reset access statistics
    pub async fn reset_access_stats(&self) -> CogniaResult<()> {
        self.stats_hits.store(0, Ordering::Relaxed);
        self.stats_misses.store(0, Ordering::Relaxed);

        sqlx::query(
            "UPDATE cache_access_stats SET hits = 0, misses = 0, last_reset = ? WHERE id = 1",
        )
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(())
    }

    /// Record a cache hit
    fn record_hit(&self) {
        self.stats_hits.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a cache miss
    fn record_miss(&self) {
        self.stats_misses.fetch_add(1, Ordering::Relaxed);
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

    /// Get a cache entry by key (tracks hit/miss statistics)
    pub async fn get(&self, key: &str) -> CogniaResult<Option<CacheEntry>> {
        let row: Option<CacheEntryRow> =
            sqlx::query_as("SELECT * FROM cache_entries WHERE key = ?")
                .bind(key)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| CogniaError::Internal(e.to_string()))?;

        if row.is_some() {
            self.record_hit();
        } else {
            self.record_miss();
        }

        Ok(row.map(Self::row_to_entry))
    }

    /// Get a cache entry by checksum (tracks hit/miss statistics)
    pub async fn get_by_checksum(&self, checksum: &str) -> CogniaResult<Option<CacheEntry>> {
        let row: Option<CacheEntryRow> =
            sqlx::query_as("SELECT * FROM cache_entries WHERE checksum = ?")
                .bind(checksum)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| CogniaError::Internal(e.to_string()))?;

        if row.is_some() {
            self.record_hit();
        } else {
            self.record_miss();
        }

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

        let hits = self.stats_hits.load(Ordering::Relaxed);
        let misses = self.stats_misses.load(Ordering::Relaxed);
        let total_requests = hits + misses;
        let hit_rate = if total_requests > 0 {
            hits as f64 / total_requests as f64
        } else {
            0.0
        };

        Ok(CacheStats {
            total_size: row.total_size.unwrap_or(0) as u64,
            entry_count: row.entry_count as usize,
            download_count: row.download_count as usize,
            metadata_count: row.metadata_count as usize,
            oldest_entry: row.oldest_entry.and_then(|s| s.parse().ok()),
            newest_entry: row.newest_entry.and_then(|s| s.parse().ok()),
            hits,
            misses,
            hit_rate,
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

    /// List cache entries with filtering, sorting, and pagination
    pub async fn list_filtered(
        &self,
        entry_type: Option<CacheEntryType>,
        search: Option<&str>,
        sort_by: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> CogniaResult<(Vec<CacheEntry>, usize)> {
        // Build WHERE clause
        let mut conditions = Vec::new();
        if entry_type.is_some() {
            conditions.push("entry_type = ?");
        }
        if search.is_some() {
            conditions.push("(key LIKE ? OR file_path LIKE ?)");
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Build ORDER BY clause
        let order_clause = match sort_by {
            Some("size_asc") => "ORDER BY size ASC",
            Some("size_desc") => "ORDER BY size DESC",
            Some("created_asc") => "ORDER BY created_at ASC",
            Some("created_desc") => "ORDER BY created_at DESC",
            Some("accessed_asc") => "ORDER BY COALESCE(last_accessed, created_at) ASC",
            Some("accessed_desc") => "ORDER BY COALESCE(last_accessed, created_at) DESC",
            Some("hits_desc") => "ORDER BY hit_count DESC",
            Some("hits_asc") => "ORDER BY hit_count ASC",
            _ => "ORDER BY created_at DESC",
        };

        // Get total count
        let count_query = format!(
            "SELECT COUNT(*) as count FROM cache_entries {}",
            where_clause
        );
        let mut count_builder = sqlx::query_scalar::<_, i64>(&count_query);

        if let Some(et) = &entry_type {
            count_builder = count_builder.bind(Self::entry_type_to_str(*et));
        }
        if let Some(s) = &search {
            let pattern = format!("%{}%", s);
            count_builder = count_builder.bind(pattern.clone()).bind(pattern);
        }

        let total_count: i64 = count_builder
            .fetch_one(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        // Get entries
        let query = format!(
            "SELECT * FROM cache_entries {} {} LIMIT ? OFFSET ?",
            where_clause, order_clause
        );

        let mut builder = sqlx::query_as::<_, CacheEntryRow>(&query);

        if let Some(et) = &entry_type {
            builder = builder.bind(Self::entry_type_to_str(*et));
        }
        if let Some(s) = &search {
            let pattern = format!("%{}%", s);
            builder = builder.bind(pattern.clone()).bind(pattern);
        }
        builder = builder.bind(limit as i64).bind(offset as i64);

        let rows: Vec<CacheEntryRow> = builder
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok((
            rows.into_iter().map(Self::row_to_entry).collect(),
            total_count as usize,
        ))
    }

    /// Get top accessed entries (hot files)
    pub async fn get_top_accessed(&self, limit: usize) -> CogniaResult<Vec<CacheEntry>> {
        let rows: Vec<CacheEntryRow> = sqlx::query_as(
            "SELECT * FROM cache_entries WHERE hit_count > 0 ORDER BY hit_count DESC LIMIT ?",
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(rows.into_iter().map(Self::row_to_entry).collect())
    }

    /// Get entries by type
    pub async fn list_by_type(&self, entry_type: CacheEntryType) -> CogniaResult<Vec<CacheEntry>> {
        let rows: Vec<CacheEntryRow> =
            sqlx::query_as("SELECT * FROM cache_entries WHERE entry_type = ?")
                .bind(Self::entry_type_to_str(entry_type))
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

    // ==================== Database Maintenance ====================

    /// Get database file size in bytes
    pub async fn db_file_size(&self) -> CogniaResult<u64> {
        let db_path = self.cache_dir.join("cache.db");
        if fs::exists(&db_path).await {
            fs::file_size(&db_path)
                .await
                .map_err(|e| CogniaError::Io(std::io::Error::other(e.to_string())))
        } else {
            Ok(0)
        }
    }

    /// Optimize database: WAL checkpoint + VACUUM + ANALYZE
    /// Returns (size_before, size_after) in bytes
    pub async fn optimize(&self) -> CogniaResult<(u64, u64)> {
        let size_before = self.db_file_size().await.unwrap_or(0);

        // Checkpoint WAL first to prevent VACUUM from doubling disk usage
        sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("WAL checkpoint failed: {}", e)))?;

        sqlx::query("VACUUM")
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("VACUUM failed: {}", e)))?;

        sqlx::query("ANALYZE")
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("ANALYZE failed: {}", e)))?;

        let size_after = self.db_file_size().await.unwrap_or(0);
        Ok((size_before, size_after))
    }

    /// Check database structural integrity via PRAGMA integrity_check
    pub async fn integrity_check(&self) -> CogniaResult<IntegrityCheckResult> {
        #[derive(FromRow)]
        struct IcRow {
            integrity_check: String,
        }

        let rows: Vec<IcRow> = sqlx::query_as("PRAGMA integrity_check")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("integrity_check failed: {}", e)))?;

        let errors: Vec<String> = rows
            .into_iter()
            .map(|r| r.integrity_check)
            .filter(|s| s != "ok")
            .collect();

        Ok(IntegrityCheckResult {
            ok: errors.is_empty(),
            errors,
        })
    }

    /// Create a consistent backup of the database using VACUUM INTO
    pub async fn backup_to_file(&self, dest: &Path) -> CogniaResult<u64> {
        // Checkpoint WAL first for a clean snapshot
        sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("WAL checkpoint failed: {}", e)))?;

        let dest_str = dest.display().to_string();
        let query = format!("VACUUM INTO '{}'", dest_str.replace('\'', "''"));
        sqlx::query(&query)
            .execute(&self.pool)
            .await
            .map_err(|e| CogniaError::Internal(format!("VACUUM INTO failed: {}", e)))?;

        // Return backup file size
        let metadata = tokio::fs::metadata(dest)
            .await
            .map_err(|e| CogniaError::Io(e))?;
        Ok(metadata.len())
    }

    /// Get comprehensive database metadata
    pub async fn get_db_info(&self) -> CogniaResult<DatabaseInfo> {
        let db_size = self.db_file_size().await.unwrap_or(0);

        // WAL file size
        let wal_path = self.cache_dir.join("cache.db-wal");
        let wal_size = if fs::exists(&wal_path).await {
            fs::file_size(&wal_path).await.unwrap_or(0)
        } else {
            0
        };

        // Page count
        let page_count: i64 = sqlx::query_scalar("PRAGMA page_count")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        // Page size
        let page_size: i64 = sqlx::query_scalar("PRAGMA page_size")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(4096);

        // Freelist count (unused pages)
        let freelist_count: i64 = sqlx::query_scalar("PRAGMA freelist_count")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        // Row counts per table
        let mut table_counts = HashMap::new();
        for table in &["cache_entries", "cache_access_stats", "cache_size_snapshots"] {
            let query = format!("SELECT COUNT(*) FROM {}", table);
            let count: i64 = sqlx::query_scalar(&query)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(0);
            table_counts.insert(table.to_string(), count as u64);
        }

        Ok(DatabaseInfo {
            db_size,
            db_size_human: format_size(db_size),
            wal_size,
            wal_size_human: format_size(wal_size),
            page_count: page_count as u64,
            page_size: page_size as u64,
            freelist_count: freelist_count as u64,
            table_counts,
        })
    }

    // ==================== Size Snapshots ====================

    /// Record a cache size snapshot for trend tracking
    pub async fn record_size_snapshot(
        &self,
        internal_size: u64,
        download_count: usize,
        metadata_count: usize,
    ) -> CogniaResult<()> {
        sqlx::query(
            r#"
            INSERT INTO cache_size_snapshots (timestamp, internal_size, download_count, metadata_count)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(Utc::now().to_rfc3339())
        .bind(internal_size as i64)
        .bind(download_count as i64)
        .bind(metadata_count as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(format!("Failed to record snapshot: {}", e)))?;

        Ok(())
    }

    /// Get size snapshots for the last N days
    pub async fn get_size_snapshots(&self, days: u32) -> CogniaResult<Vec<CacheSizeSnapshot>> {
        let cutoff = Utc::now() - ChronoDuration::days(days as i64);

        #[derive(FromRow)]
        struct SnapshotRow {
            timestamp: String,
            internal_size: i64,
            download_count: i64,
            metadata_count: i64,
        }

        let rows: Vec<SnapshotRow> = sqlx::query_as(
            "SELECT timestamp, internal_size, download_count, metadata_count FROM cache_size_snapshots WHERE timestamp >= ? ORDER BY timestamp ASC",
        )
        .bind(cutoff.to_rfc3339())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| CacheSizeSnapshot {
                timestamp: r.timestamp,
                internal_size: r.internal_size as u64,
                internal_size_human: format_size(r.internal_size as u64),
                download_count: r.download_count as usize,
                metadata_count: r.metadata_count as usize,
            })
            .collect())
    }

    /// Prune snapshots older than N days
    pub async fn prune_old_snapshots(&self, max_age_days: u32) -> CogniaResult<usize> {
        let cutoff = Utc::now() - ChronoDuration::days(max_age_days as i64);

        let result =
            sqlx::query("DELETE FROM cache_size_snapshots WHERE timestamp < ?")
                .bind(cutoff.to_rfc3339())
                .execute(&self.pool)
                .await
                .map_err(|e| CogniaError::Internal(e.to_string()))?;

        Ok(result.rows_affected() as usize)
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

/// Result of a database integrity check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityCheckResult {
    pub ok: bool,
    pub errors: Vec<String>,
}

/// Comprehensive database metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub db_size: u64,
    pub db_size_human: String,
    pub wal_size: u64,
    pub wal_size_human: String,
    pub page_count: u64,
    pub page_size: u64,
    pub freelist_count: u64,
    pub table_counts: HashMap<String, u64>,
}

/// Cache size snapshot for trend tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheSizeSnapshot {
    pub timestamp: String,
    pub internal_size: u64,
    pub internal_size_human: String,
    pub download_count: usize,
    pub metadata_count: usize,
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
        db.insert(CacheEntry::new(
            "d1",
            dir.path().join("d1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "d2",
            dir.path().join("d2"),
            200,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "m1",
            dir.path().join("m1"),
            50,
            "c3",
            CacheEntryType::Metadata,
        ))
        .await
        .unwrap();

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

        db.insert(CacheEntry::new(
            "list1",
            dir.path().join("l1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "list2",
            dir.path().join("l2"),
            200,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();

        let entries = db.list().await.unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[tokio::test]
    async fn test_sqlite_cache_clear() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.insert(CacheEntry::new(
            "clear1",
            dir.path().join("c1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "clear2",
            dir.path().join("c2"),
            200,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();

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
        db.insert(CacheEntry::new(
            "lru1",
            dir.path().join("lru1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "lru2",
            dir.path().join("lru2"),
            100,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "lru3",
            dir.path().join("lru3"),
            100,
            "c3",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();

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
        assert_eq!(
            SqliteCacheDb::entry_type_to_str(CacheEntryType::Download),
            "download"
        );
        assert_eq!(
            SqliteCacheDb::entry_type_to_str(CacheEntryType::Metadata),
            "metadata"
        );
        assert_eq!(
            SqliteCacheDb::entry_type_to_str(CacheEntryType::Index),
            "index"
        );
        assert_eq!(
            SqliteCacheDb::entry_type_to_str(CacheEntryType::Partial),
            "partial"
        );

        assert!(matches!(
            SqliteCacheDb::str_to_entry_type("download"),
            CacheEntryType::Download
        ));
        assert!(matches!(
            SqliteCacheDb::str_to_entry_type("metadata"),
            CacheEntryType::Metadata
        ));
        assert!(matches!(
            SqliteCacheDb::str_to_entry_type("index"),
            CacheEntryType::Index
        ));
        assert!(matches!(
            SqliteCacheDb::str_to_entry_type("partial"),
            CacheEntryType::Partial
        ));
        assert!(matches!(
            SqliteCacheDb::str_to_entry_type("unknown"),
            CacheEntryType::Download
        ));
    }

    #[tokio::test]
    async fn test_sqlite_cache_hit_miss_stats() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Initial stats should be 0
        let stats = db.get_access_stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 0);

        // Insert an entry
        db.insert(CacheEntry::new(
            "stats-key",
            dir.path().join("f"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();

        // Hit: get existing key
        let _ = db.get("stats-key").await.unwrap();
        let stats = db.get_access_stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 0);

        // Miss: get non-existing key
        let _ = db.get("nonexistent").await.unwrap();
        let stats = db.get_access_stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 1);

        // Hit rate calculation
        assert!((stats.hit_rate - 0.5).abs() < 0.01);

        // Reset stats
        db.reset_access_stats().await.unwrap();
        let stats = db.get_access_stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 0);
    }

    #[tokio::test]
    async fn test_sqlite_cache_persist_stats() {
        let dir = tempdir().unwrap();

        // Open db and generate some stats
        {
            let db = SqliteCacheDb::open(dir.path()).await.unwrap();
            db.insert(CacheEntry::new(
                "persist-key",
                dir.path().join("f"),
                100,
                "c1",
                CacheEntryType::Download,
            ))
            .await
            .unwrap();
            let _ = db.get("persist-key").await.unwrap(); // hit
            let _ = db.get("miss-key").await.unwrap(); // miss
            db.persist_stats().await.unwrap();
        }

        // Reopen db and verify stats are loaded
        {
            let db = SqliteCacheDb::open(dir.path()).await.unwrap();
            let stats = db.get_access_stats();
            assert_eq!(stats.hits, 1);
            assert_eq!(stats.misses, 1);
        }
    }

    #[tokio::test]
    async fn test_sqlite_cache_list_filtered() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Insert entries of different types
        db.insert(CacheEntry::new(
            "download1",
            dir.path().join("d1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "download2",
            dir.path().join("d2"),
            200,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "metadata1",
            dir.path().join("m1"),
            50,
            "c3",
            CacheEntryType::Metadata,
        ))
        .await
        .unwrap();

        // Filter by type
        let (entries, total) = db
            .list_filtered(Some(CacheEntryType::Download), None, None, 10, 0)
            .await
            .unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(total, 2);

        // Search by key
        let (entries, total) = db
            .list_filtered(None, Some("download"), None, 10, 0)
            .await
            .unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(total, 2);

        // Pagination
        let (entries, total) = db.list_filtered(None, None, None, 2, 0).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(total, 3);

        let (entries, _) = db.list_filtered(None, None, None, 2, 2).await.unwrap();
        assert_eq!(entries.len(), 1);
    }

    #[tokio::test]
    async fn test_sqlite_cache_get_top_accessed() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.insert(CacheEntry::new(
            "hot1",
            dir.path().join("h1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "hot2",
            dir.path().join("h2"),
            100,
            "c2",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "cold",
            dir.path().join("cold"),
            100,
            "c3",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();

        // Touch hot1 multiple times
        db.touch("hot1").await.unwrap();
        db.touch("hot1").await.unwrap();
        db.touch("hot1").await.unwrap();
        // Touch hot2 once
        db.touch("hot2").await.unwrap();

        let top = db.get_top_accessed(2).await.unwrap();
        assert_eq!(top.len(), 2);
        assert_eq!(top[0].key, "hot1");
        assert_eq!(top[0].hit_count, 3);
        assert_eq!(top[1].key, "hot2");
        assert_eq!(top[1].hit_count, 1);
    }

    #[tokio::test]
    async fn test_sqlite_cache_list_by_type() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.insert(CacheEntry::new(
            "d1",
            dir.path().join("d1"),
            100,
            "c1",
            CacheEntryType::Download,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "m1",
            dir.path().join("m1"),
            50,
            "c2",
            CacheEntryType::Metadata,
        ))
        .await
        .unwrap();
        db.insert(CacheEntry::new(
            "m2",
            dir.path().join("m2"),
            50,
            "c3",
            CacheEntryType::Metadata,
        ))
        .await
        .unwrap();

        let downloads = db.list_by_type(CacheEntryType::Download).await.unwrap();
        assert_eq!(downloads.len(), 1);

        let metadata = db.list_by_type(CacheEntryType::Metadata).await.unwrap();
        assert_eq!(metadata.len(), 2);
    }

    #[tokio::test]
    async fn test_wal_mode_enabled() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        #[derive(FromRow)]
        struct PragmaRow {
            journal_mode: String,
        }

        let row: PragmaRow = sqlx::query_as("PRAGMA journal_mode")
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(row.journal_mode, "wal");
    }

    #[tokio::test]
    async fn test_optimize() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Insert some entries
        for i in 0..10 {
            db.insert(CacheEntry::new(
                &format!("opt-{}", i),
                dir.path().join(format!("f{}", i)),
                1000,
                &format!("c{}", i),
                CacheEntryType::Download,
            ))
            .await
            .unwrap();
        }

        // Delete most entries
        for i in 0..9 {
            db.remove(&format!("opt-{}", i)).await.unwrap();
        }

        let (size_before, size_after) = db.optimize().await.unwrap();
        // After VACUUM, size should be <= before (may not shrink for tiny DBs)
        assert!(size_after <= size_before || size_before == 0);
    }

    #[tokio::test]
    async fn test_record_and_get_snapshots() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        db.record_size_snapshot(1000, 5, 3).await.unwrap();
        db.record_size_snapshot(2000, 10, 6).await.unwrap();
        db.record_size_snapshot(3000, 15, 9).await.unwrap();

        let snapshots = db.get_size_snapshots(30).await.unwrap();
        assert_eq!(snapshots.len(), 3);
        assert_eq!(snapshots[0].internal_size, 1000);
        assert_eq!(snapshots[1].internal_size, 2000);
        assert_eq!(snapshots[2].internal_size, 3000);
        assert_eq!(snapshots[2].download_count, 15);
        assert_eq!(snapshots[2].metadata_count, 9);
        assert!(!snapshots[0].internal_size_human.is_empty());
    }

    #[tokio::test]
    async fn test_prune_old_snapshots() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        // Insert a snapshot with old timestamp manually
        let old_ts =
            (Utc::now() - ChronoDuration::days(100)).to_rfc3339();
        sqlx::query(
            "INSERT INTO cache_size_snapshots (timestamp, internal_size, download_count, metadata_count) VALUES (?, ?, ?, ?)",
        )
        .bind(&old_ts)
        .bind(500i64)
        .bind(2i64)
        .bind(1i64)
        .execute(&db.pool)
        .await
        .unwrap();

        // Insert a recent snapshot
        db.record_size_snapshot(1000, 5, 3).await.unwrap();

        let all = db.get_size_snapshots(365).await.unwrap();
        assert_eq!(all.len(), 2);

        let pruned = db.prune_old_snapshots(90).await.unwrap();
        assert_eq!(pruned, 1);

        let remaining = db.get_size_snapshots(365).await.unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].internal_size, 1000);
    }

    #[tokio::test]
    async fn test_empty_snapshots() {
        let dir = tempdir().unwrap();
        let db = SqliteCacheDb::open(dir.path()).await.unwrap();

        let snapshots = db.get_size_snapshots(30).await.unwrap();
        assert!(snapshots.is_empty());
    }
}
