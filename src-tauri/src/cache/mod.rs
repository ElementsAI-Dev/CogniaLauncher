pub mod db;
pub mod download;
pub mod download_history;
pub mod download_resumer;
pub mod external;
pub mod history;
pub mod metadata;
pub mod migration;
pub mod sqlite_db;

// Re-export main types (avoiding glob conflicts)
pub use db::{CacheEntry, CacheEntryType, CacheIndex, CacheStats};
pub use download::DownloadCache;
pub use download_history::{DownloadHistory, DownloadRecord, DownloadStatus, HistoryStats};
pub use download_resumer::{DownloadResumer, PartialDownload};
pub use external::{
    CombinedCacheStats, ExternalCacheCleanResult, ExternalCacheInfo, ExternalCacheProvider,
};
pub use history::{
    CleanedFileInfo, CleanupHistory, CleanupRecord, CleanupRecordBuilder, CleanupSummary,
};
pub use metadata::{CachedMetadata, MetadataCache, MetadataCacheStats};
pub use migration::{MigrationMode, MigrationResult, MigrationValidation};
pub use sqlite_db::{
    CacheAccessStats, CacheSizeSnapshot, DatabaseInfo, IntegrityCheckResult, SqliteCacheDb,
};
