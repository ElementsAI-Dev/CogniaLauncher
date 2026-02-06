pub mod db;
pub mod download;
pub mod download_history;
pub mod enhanced;
pub mod external;
pub mod history;
pub mod metadata;
pub mod migration;
pub mod sqlite_db;

// Re-export main types (avoiding glob conflicts)
pub use db::{CacheDb, CacheEntry, CacheEntryType, CacheIndex, CacheStats};
pub use download::DownloadCache;
pub use download_history::{DownloadHistory, DownloadRecord, DownloadStatus, HistoryStats};
pub use enhanced::{
    DownloadResumer, EnhancedCache, EnhancedCacheEntry, EnhancedCacheStats, PartialDownload,
    RepairResult, VerificationResult,
};
pub use history::{CleanedFileInfo, CleanupHistory, CleanupRecord, CleanupRecordBuilder, CleanupSummary};
pub use metadata::{CachedMetadata, MetadataCache, MetadataCacheStats};
pub use sqlite_db::{CacheAccessStats, SqliteCacheDb};
pub use external::{
    CombinedCacheStats, ExternalCacheCleanResult, ExternalCacheInfo, ExternalCacheProvider,
};
pub use migration::{
    MigrationMode, MigrationResult, MigrationValidation,
};
