pub mod db;
pub mod download;
pub mod enhanced;
pub mod metadata;

// Re-export main types (avoiding glob conflicts)
pub use db::{CacheDb, CacheEntry, CacheEntryType, CacheIndex, CacheStats};
pub use download::DownloadCache;
pub use enhanced::{
    DownloadResumer, EnhancedCache, EnhancedCacheEntry, EnhancedCacheStats, PartialDownload,
    RepairResult, VerificationResult,
};
pub use metadata::{CachedMetadata, MetadataCache, MetadataCacheStats};
