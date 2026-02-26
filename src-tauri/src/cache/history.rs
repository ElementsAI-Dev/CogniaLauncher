//! Cleanup history tracking for cache operations
//!
//! This module provides persistent storage for cache cleanup operations,
//! allowing users to review past cleanup actions and their results.

use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk::format_size, fs};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const MAX_HISTORY_RECORDS: usize = 100;
const MAX_FILES_PER_RECORD: usize = 50;

/// A single cleanup operation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupRecord {
    /// Unique identifier for this cleanup operation
    pub id: String,
    /// When the cleanup was performed
    pub timestamp: DateTime<Utc>,
    /// Type of cleanup: "downloads", "metadata", "expired", "all"
    pub clean_type: String,
    /// Whether files were moved to trash or permanently deleted
    pub use_trash: bool,
    /// Total bytes freed by this operation
    pub freed_bytes: u64,
    /// Human-readable size freed
    pub freed_human: String,
    /// Number of files affected
    pub file_count: usize,
    /// Details of individual files cleaned (limited to MAX_FILES_PER_RECORD)
    pub files: Vec<CleanedFileInfo>,
    /// Whether the list of files was truncated
    pub files_truncated: bool,
}

/// Information about a single cleaned file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanedFileInfo {
    /// Original file path
    pub path: String,
    /// File size in bytes
    pub size: u64,
    /// Human-readable size
    pub size_human: String,
    /// Entry type: "download", "metadata", "partial", etc.
    pub entry_type: String,
}

/// Internal storage format for cleanup history
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HistoryIndex {
    version: u32,
    records: Vec<CleanupRecord>,
}

/// Manager for cleanup history persistence
pub struct CleanupHistory {
    history_path: PathBuf,
    index: HistoryIndex,
}

impl CleanupHistory {
    /// Open or create cleanup history for the given cache directory
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let history_path = cache_dir.join("cleanup-history.json");

        let index = if fs::exists(&history_path).await {
            let content = fs::read_file_string(&history_path).await?;
            serde_json::from_str(&content).unwrap_or_else(|_| HistoryIndex {
                version: 1,
                records: Vec::new(),
            })
        } else {
            HistoryIndex {
                version: 1,
                records: Vec::new(),
            }
        };

        Ok(Self {
            history_path,
            index,
        })
    }

    /// Add a new cleanup record to history
    pub async fn add(&mut self, mut record: CleanupRecord) -> CogniaResult<()> {
        // Truncate files list if too long
        if record.files.len() > MAX_FILES_PER_RECORD {
            record.files.truncate(MAX_FILES_PER_RECORD);
            record.files_truncated = true;
        }

        // Insert at the beginning (most recent first)
        self.index.records.insert(0, record);

        // Trim old records
        if self.index.records.len() > MAX_HISTORY_RECORDS {
            self.index.records.truncate(MAX_HISTORY_RECORDS);
        }

        self.save().await
    }

    /// Get cleanup records, optionally limited
    pub fn list(&self, limit: Option<usize>) -> Vec<&CleanupRecord> {
        let limit = limit.unwrap_or(self.index.records.len());
        self.index.records.iter().take(limit).collect()
    }

    /// Get a specific record by ID
    pub fn get(&self, id: &str) -> Option<&CleanupRecord> {
        self.index.records.iter().find(|r| r.id == id)
    }

    /// Get total number of records
    pub fn count(&self) -> usize {
        self.index.records.len()
    }

    /// Get summary statistics across all records
    pub fn summary(&self) -> CleanupSummary {
        let total_freed: u64 = self.index.records.iter().map(|r| r.freed_bytes).sum();
        let total_files: usize = self.index.records.iter().map(|r| r.file_count).sum();
        let trash_count = self.index.records.iter().filter(|r| r.use_trash).count();
        let permanent_count = self.index.records.len() - trash_count;

        CleanupSummary {
            total_cleanups: self.index.records.len(),
            total_freed_bytes: total_freed,
            total_freed_human: format_size(total_freed),
            total_files_cleaned: total_files,
            trash_cleanups: trash_count,
            permanent_cleanups: permanent_count,
        }
    }

    /// Clear all cleanup history
    pub async fn clear(&mut self) -> CogniaResult<usize> {
        let count = self.index.records.len();
        self.index.records.clear();
        self.save().await?;
        Ok(count)
    }

    /// Save history to disk
    async fn save(&self) -> CogniaResult<()> {
        let content = serde_json::to_string_pretty(&self.index)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;
        fs::write_file_atomic(&self.history_path, content.as_bytes()).await?;
        Ok(())
    }
}

/// Summary statistics for cleanup history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupSummary {
    pub total_cleanups: usize,
    pub total_freed_bytes: u64,
    pub total_freed_human: String,
    pub total_files_cleaned: usize,
    pub trash_cleanups: usize,
    pub permanent_cleanups: usize,
}

/// Builder for creating CleanupRecord
pub struct CleanupRecordBuilder {
    clean_type: String,
    use_trash: bool,
    freed_bytes: u64,
    files: Vec<CleanedFileInfo>,
}

impl CleanupRecordBuilder {
    pub fn new(clean_type: impl Into<String>, use_trash: bool) -> Self {
        Self {
            clean_type: clean_type.into(),
            use_trash,
            freed_bytes: 0,
            files: Vec::new(),
        }
    }

    pub fn add_file(
        &mut self,
        path: impl Into<String>,
        size: u64,
        entry_type: impl Into<String>,
    ) -> &mut Self {
        self.freed_bytes += size;
        self.files.push(CleanedFileInfo {
            path: path.into(),
            size,
            size_human: format_size(size),
            entry_type: entry_type.into(),
        });
        self
    }

    pub fn build(self) -> CleanupRecord {
        let file_count = self.files.len();
        CleanupRecord {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            clean_type: self.clean_type,
            use_trash: self.use_trash,
            freed_bytes: self.freed_bytes,
            freed_human: format_size(self.freed_bytes),
            file_count,
            files: self.files,
            files_truncated: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_cleanup_history_crud() {
        let dir = tempdir().unwrap();
        let mut history = CleanupHistory::open(dir.path()).await.unwrap();

        // Initially empty
        assert_eq!(history.count(), 0);

        // Add a record
        let mut builder = CleanupRecordBuilder::new("downloads", false);
        builder.add_file("/cache/file1.bin", 1024, "download");
        builder.add_file("/cache/file2.bin", 2048, "download");
        let record = builder.build();
        let record_id = record.id.clone();

        history.add(record).await.unwrap();
        assert_eq!(history.count(), 1);

        // Retrieve by ID
        let retrieved = history.get(&record_id).unwrap();
        assert_eq!(retrieved.file_count, 2);
        assert_eq!(retrieved.freed_bytes, 3072);

        // List records
        let records = history.list(None);
        assert_eq!(records.len(), 1);

        // Clear history
        let cleared = history.clear().await.unwrap();
        assert_eq!(cleared, 1);
        assert_eq!(history.count(), 0);
    }

    #[tokio::test]
    async fn test_cleanup_history_persistence() {
        let dir = tempdir().unwrap();

        // Create and save
        {
            let mut history = CleanupHistory::open(dir.path()).await.unwrap();
            let mut builder = CleanupRecordBuilder::new("all", true);
            builder.add_file("/cache/test.bin", 500, "download");
            history.add(builder.build()).await.unwrap();
        }

        // Reopen and verify
        {
            let history = CleanupHistory::open(dir.path()).await.unwrap();
            assert_eq!(history.count(), 1);
            let records = history.list(None);
            assert!(records[0].use_trash);
        }
    }

    #[tokio::test]
    async fn test_cleanup_history_limit() {
        let dir = tempdir().unwrap();
        let mut history = CleanupHistory::open(dir.path()).await.unwrap();

        // Add more than MAX_HISTORY_RECORDS
        for i in 0..150 {
            let mut builder = CleanupRecordBuilder::new("test", false);
            builder.add_file(format!("/file{}", i), 100, "download");
            history.add(builder.build()).await.unwrap();
        }

        // Should be capped at MAX_HISTORY_RECORDS
        assert_eq!(history.count(), MAX_HISTORY_RECORDS);
    }

    #[tokio::test]
    async fn test_cleanup_summary() {
        let dir = tempdir().unwrap();
        let mut history = CleanupHistory::open(dir.path()).await.unwrap();

        // Add some records with different settings
        for i in 0..5 {
            let mut builder = CleanupRecordBuilder::new("downloads", i % 2 == 0);
            builder.add_file(format!("/file{}", i), 1000, "download");
            history.add(builder.build()).await.unwrap();
        }

        let summary = history.summary();
        assert_eq!(summary.total_cleanups, 5);
        assert_eq!(summary.total_freed_bytes, 5000);
        assert_eq!(summary.total_files_cleaned, 5);
        assert_eq!(summary.trash_cleanups, 3); // i=0,2,4
        assert_eq!(summary.permanent_cleanups, 2); // i=1,3
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(500), "500 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1536), "1.50 KB");
        assert_eq!(format_size(1048576), "1.00 MB");
        assert_eq!(format_size(1073741824), "1.00 GB");
    }
}
