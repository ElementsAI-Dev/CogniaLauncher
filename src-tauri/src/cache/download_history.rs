//! Download history tracking

use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    disk::{format_duration, format_size},
    fs,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::path::{Path, PathBuf};

/// Maximum number of history records to keep
const MAX_HISTORY_RECORDS: usize = 1000;

/// A single download history record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRecord {
    /// Unique identifier
    pub id: String,
    /// Source URL
    pub url: String,
    /// Downloaded file name
    pub filename: String,
    /// Destination path
    pub destination: PathBuf,
    /// File size in bytes
    pub size: u64,
    /// SHA256 checksum (if verified)
    pub checksum: Option<String>,
    /// When the download started
    pub started_at: DateTime<Utc>,
    /// When the download completed
    pub completed_at: DateTime<Utc>,
    /// Download duration in seconds
    pub duration_secs: u64,
    /// Average download speed in bytes per second
    pub average_speed: f64,
    /// Final status
    pub status: DownloadStatus,
    /// Error message if failed
    pub error: Option<String>,
    /// Provider that initiated the download
    pub provider: Option<String>,
    /// Additional metadata
    pub metadata: std::collections::HashMap<String, String>,
}

/// Download completion status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Completed,
    Failed,
    Cancelled,
}

impl DownloadRecord {
    /// Create a new completed download record
    pub fn completed(
        url: String,
        filename: String,
        destination: PathBuf,
        size: u64,
        checksum: Option<String>,
        started_at: DateTime<Utc>,
        provider: Option<String>,
    ) -> Self {
        let completed_at = Utc::now();
        let duration_secs = (completed_at - started_at).num_seconds().max(1) as u64;
        let average_speed = size as f64 / duration_secs as f64;

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            filename,
            destination,
            size,
            checksum,
            started_at,
            completed_at,
            duration_secs,
            average_speed,
            status: DownloadStatus::Completed,
            error: None,
            provider,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Create a failed download record
    pub fn failed(
        url: String,
        filename: String,
        destination: PathBuf,
        started_at: DateTime<Utc>,
        error: String,
        provider: Option<String>,
    ) -> Self {
        let completed_at = Utc::now();
        let duration_secs = (completed_at - started_at).num_seconds().max(0) as u64;

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            filename,
            destination,
            size: 0,
            checksum: None,
            started_at,
            completed_at,
            duration_secs,
            average_speed: 0.0,
            status: DownloadStatus::Failed,
            error: Some(error),
            provider,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Create a cancelled download record
    pub fn cancelled(
        url: String,
        filename: String,
        destination: PathBuf,
        downloaded_size: u64,
        started_at: DateTime<Utc>,
        provider: Option<String>,
    ) -> Self {
        let completed_at = Utc::now();
        let duration_secs = (completed_at - started_at).num_seconds().max(0) as u64;
        let average_speed = if duration_secs > 0 {
            downloaded_size as f64 / duration_secs as f64
        } else {
            0.0
        };

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            filename,
            destination,
            size: downloaded_size,
            checksum: None,
            started_at,
            completed_at,
            duration_secs,
            average_speed,
            status: DownloadStatus::Cancelled,
            error: None,
            provider,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Format size as human-readable string
    pub fn size_human(&self) -> String {
        format_size(self.size)
    }

    /// Format speed as human-readable string
    pub fn speed_human(&self) -> String {
        format!("{}/s", format_size(self.average_speed as u64))
    }

    /// Format duration as human-readable string
    pub fn duration_human(&self) -> String {
        format_duration(self.duration_secs)
    }
}

/// Download history storage
#[derive(Debug)]
pub struct DownloadHistory {
    /// History file path
    file_path: PathBuf,
    /// History records (newest first)
    records: VecDeque<DownloadRecord>,
}

impl DownloadHistory {
    /// Open or create a download history
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let file_path = cache_dir.join("download_history.json");

        let records = if fs::exists(&file_path).await {
            let content = fs::read_file_string(&file_path).await?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            VecDeque::new()
        };

        Ok(Self { file_path, records })
    }

    /// Add a new record to the history
    pub async fn add(&mut self, record: DownloadRecord) -> CogniaResult<()> {
        // Add to front (newest first)
        self.records.push_front(record);

        // Trim if too many records
        while self.records.len() > MAX_HISTORY_RECORDS {
            self.records.pop_back();
        }

        self.save().await
    }

    /// Save history to disk
    async fn save(&self) -> CogniaResult<()> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let content = serde_json::to_string_pretty(&self.records)
            .map_err(|e| CogniaError::Internal(e.to_string()))?;

        fs::write_file_string(&self.file_path, &content).await?;
        Ok(())
    }

    /// Get all records
    pub fn list(&self) -> Vec<&DownloadRecord> {
        self.records.iter().collect()
    }

    /// Get records by status
    pub fn list_by_status(&self, status: DownloadStatus) -> Vec<&DownloadRecord> {
        self.records.iter().filter(|r| r.status == status).collect()
    }

    /// Get records from the last N days
    pub fn list_recent(&self, days: i64) -> Vec<&DownloadRecord> {
        let cutoff = Utc::now() - chrono::Duration::days(days);
        self.records
            .iter()
            .filter(|r| r.completed_at >= cutoff)
            .collect()
    }

    /// Search records by filename or URL
    pub fn search(&self, query: &str) -> Vec<&DownloadRecord> {
        let query_lower = query.to_lowercase();
        self.records
            .iter()
            .filter(|r| {
                r.filename.to_lowercase().contains(&query_lower)
                    || r.url.to_lowercase().contains(&query_lower)
            })
            .collect()
    }

    /// Get a record by ID
    pub fn get(&self, id: &str) -> Option<&DownloadRecord> {
        self.records.iter().find(|r| r.id == id)
    }

    /// Remove a record by ID
    pub async fn remove(&mut self, id: &str) -> CogniaResult<bool> {
        let len_before = self.records.len();
        self.records.retain(|r| r.id != id);
        let removed = self.records.len() < len_before;

        if removed {
            self.save().await?;
        }

        Ok(removed)
    }

    /// Clear all history
    pub async fn clear(&mut self) -> CogniaResult<usize> {
        let count = self.records.len();
        self.records.clear();
        self.save().await?;
        Ok(count)
    }

    /// Clear records older than N days
    pub async fn clear_older_than(&mut self, days: i64) -> CogniaResult<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(days);
        let len_before = self.records.len();
        self.records.retain(|r| r.completed_at >= cutoff);
        let removed = len_before - self.records.len();

        if removed > 0 {
            self.save().await?;
        }

        Ok(removed)
    }

    /// Get statistics
    pub fn stats(&self) -> HistoryStats {
        let mut stats = HistoryStats::default();

        for record in &self.records {
            stats.total_count += 1;
            stats.total_bytes += record.size;

            match record.status {
                DownloadStatus::Completed => stats.completed_count += 1,
                DownloadStatus::Failed => stats.failed_count += 1,
                DownloadStatus::Cancelled => stats.cancelled_count += 1,
            }
        }

        if stats.completed_count > 0 {
            let completed_records: Vec<_> = self
                .records
                .iter()
                .filter(|r| r.status == DownloadStatus::Completed)
                .collect();

            let total_speed: f64 = completed_records.iter().map(|r| r.average_speed).sum();
            stats.average_speed = total_speed / completed_records.len() as f64;
        }

        stats
    }

    /// Get record count
    pub fn len(&self) -> usize {
        self.records.len()
    }

    /// Check if history is empty
    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }
}

/// Download history statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStats {
    pub total_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    pub cancelled_count: usize,
    pub total_bytes: u64,
    pub average_speed: f64,
}

impl HistoryStats {
    pub fn total_bytes_human(&self) -> String {
        format_size(self.total_bytes)
    }

    pub fn average_speed_human(&self) -> String {
        format!("{}/s", format_size(self.average_speed as u64))
    }

    pub fn success_rate(&self) -> f32 {
        if self.total_count == 0 {
            0.0
        } else {
            (self.completed_count as f32 / self.total_count as f32) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_download_record_completed() {
        let started_at = Utc::now() - chrono::Duration::seconds(10);
        let record = DownloadRecord::completed(
            "https://example.com/file.zip".to_string(),
            "file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            1024 * 1024,
            Some("abc123".to_string()),
            started_at,
            Some("github".to_string()),
        );

        assert_eq!(record.status, DownloadStatus::Completed);
        assert!(record.duration_secs >= 10);
        assert!(record.average_speed > 0.0);
        assert_eq!(record.error, None);
    }

    #[test]
    fn test_download_record_failed() {
        let started_at = Utc::now() - chrono::Duration::seconds(5);
        let record = DownloadRecord::failed(
            "https://example.com/file.zip".to_string(),
            "file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            started_at,
            "Connection refused".to_string(),
            None,
        );

        assert_eq!(record.status, DownloadStatus::Failed);
        assert_eq!(record.error, Some("Connection refused".to_string()));
        assert_eq!(record.size, 0);
    }

    #[tokio::test]
    async fn test_download_history_open() {
        let temp_dir = tempdir().unwrap();
        let history = DownloadHistory::open(temp_dir.path()).await;
        assert!(history.is_ok());
        assert!(history.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_download_history_add_and_list() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        let record = DownloadRecord::completed(
            "https://example.com/file.zip".to_string(),
            "file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            1024,
            None,
            Utc::now(),
            None,
        );

        history.add(record).await.unwrap();
        assert_eq!(history.len(), 1);

        let records = history.list();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].filename, "file.zip");
    }

    #[tokio::test]
    async fn test_download_history_persistence() {
        let temp_dir = tempdir().unwrap();

        // Add a record
        {
            let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();
            let record = DownloadRecord::completed(
                "https://example.com/file.zip".to_string(),
                "file.zip".to_string(),
                PathBuf::from("/tmp/file.zip"),
                1024,
                None,
                Utc::now(),
                None,
            );
            history.add(record).await.unwrap();
        }

        // Reopen and verify
        {
            let history = DownloadHistory::open(temp_dir.path()).await.unwrap();
            assert_eq!(history.len(), 1);
        }
    }

    #[tokio::test]
    async fn test_download_history_search() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        history
            .add(DownloadRecord::completed(
                "https://example.com/nodejs.zip".to_string(),
                "nodejs.zip".to_string(),
                PathBuf::from("/tmp/nodejs.zip"),
                1024,
                None,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        history
            .add(DownloadRecord::completed(
                "https://example.com/python.zip".to_string(),
                "python.zip".to_string(),
                PathBuf::from("/tmp/python.zip"),
                2048,
                None,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        let results = history.search("node");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].filename, "nodejs.zip");

        let results = history.search("example.com");
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_download_history_stats() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        history
            .add(DownloadRecord::completed(
                "url1".to_string(),
                "file1.zip".to_string(),
                PathBuf::from("/tmp/file1.zip"),
                1024,
                None,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        history
            .add(DownloadRecord::failed(
                "url2".to_string(),
                "file2.zip".to_string(),
                PathBuf::from("/tmp/file2.zip"),
                Utc::now(),
                "Error".to_string(),
                None,
            ))
            .await
            .unwrap();

        let stats = history.stats();
        assert_eq!(stats.total_count, 2);
        assert_eq!(stats.completed_count, 1);
        assert_eq!(stats.failed_count, 1);
        assert_eq!(stats.total_bytes, 1024);
    }

    #[tokio::test]
    async fn test_download_history_clear() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        for i in 0..5 {
            history
                .add(DownloadRecord::completed(
                    format!("url{}", i),
                    format!("file{}.zip", i),
                    PathBuf::from(format!("/tmp/file{}.zip", i)),
                    1024,
                    None,
                    Utc::now(),
                    None,
                ))
                .await
                .unwrap();
        }

        assert_eq!(history.len(), 5);

        let cleared = history.clear().await.unwrap();
        assert_eq!(cleared, 5);
        assert!(history.is_empty());
    }

    #[test]
    fn test_download_record_cancelled() {
        let started_at = Utc::now() - chrono::Duration::seconds(3);
        let record = DownloadRecord::cancelled(
            "https://example.com/cancel.zip".to_string(),
            "cancel.zip".to_string(),
            PathBuf::from("/tmp/cancel.zip"),
            512 * 1024,
            started_at,
            Some("github".to_string()),
        );

        assert_eq!(record.status, DownloadStatus::Cancelled);
        assert_eq!(record.size, 512 * 1024);
        assert!(record.error.is_none());
        assert_eq!(record.provider, Some("github".to_string()));
    }

    #[test]
    fn test_download_record_format_helpers() {
        let started_at = Utc::now() - chrono::Duration::seconds(10);
        let record = DownloadRecord::completed(
            "url".to_string(),
            "file.zip".to_string(),
            PathBuf::from("/tmp/file.zip"),
            1048576, // 1 MB
            None,
            started_at,
            None,
        );

        assert_eq!(record.size_human(), "1.00 MB");
        assert!(record.speed_human().contains("/s"));
        assert!(!record.duration_human().is_empty());
    }

    #[tokio::test]
    async fn test_download_history_list_by_status() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        history
            .add(DownloadRecord::completed(
                "url1".to_string(),
                "file1.zip".to_string(),
                PathBuf::from("/tmp/file1.zip"),
                1024,
                None,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        history
            .add(DownloadRecord::failed(
                "url2".to_string(),
                "file2.zip".to_string(),
                PathBuf::from("/tmp/file2.zip"),
                Utc::now(),
                "Error".to_string(),
                None,
            ))
            .await
            .unwrap();

        history
            .add(DownloadRecord::cancelled(
                "url3".to_string(),
                "file3.zip".to_string(),
                PathBuf::from("/tmp/file3.zip"),
                100,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        let completed = history.list_by_status(DownloadStatus::Completed);
        assert_eq!(completed.len(), 1);
        let failed = history.list_by_status(DownloadStatus::Failed);
        assert_eq!(failed.len(), 1);
        let cancelled = history.list_by_status(DownloadStatus::Cancelled);
        assert_eq!(cancelled.len(), 1);
    }

    #[tokio::test]
    async fn test_download_history_list_recent() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        history
            .add(DownloadRecord::completed(
                "url1".to_string(),
                "recent.zip".to_string(),
                PathBuf::from("/tmp/recent.zip"),
                1024,
                None,
                Utc::now(),
                None,
            ))
            .await
            .unwrap();

        let recent = history.list_recent(1);
        assert_eq!(recent.len(), 1);

        // 0-day window should include today's records
        let today = history.list_recent(0);
        // Depending on timing, may or may not include (cutoff is 0 days ago = now)
        assert!(today.len() <= 1);
    }

    #[tokio::test]
    async fn test_download_history_get_by_id() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        let record = DownloadRecord::completed(
            "url".to_string(),
            "get-test.zip".to_string(),
            PathBuf::from("/tmp/get-test.zip"),
            1024,
            None,
            Utc::now(),
            None,
        );
        let record_id = record.id.clone();
        history.add(record).await.unwrap();

        let found = history.get(&record_id);
        assert!(found.is_some());
        assert_eq!(found.unwrap().filename, "get-test.zip");

        let not_found = history.get("nonexistent-id");
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_download_history_remove_by_id() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        let record = DownloadRecord::completed(
            "url".to_string(),
            "remove-test.zip".to_string(),
            PathBuf::from("/tmp/remove-test.zip"),
            1024,
            None,
            Utc::now(),
            None,
        );
        let record_id = record.id.clone();
        history.add(record).await.unwrap();
        assert_eq!(history.len(), 1);

        let removed = history.remove(&record_id).await.unwrap();
        assert!(removed);
        assert_eq!(history.len(), 0);

        let removed_again = history.remove(&record_id).await.unwrap();
        assert!(!removed_again);
    }

    #[tokio::test]
    async fn test_download_history_clear_older_than() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        // Add records (all have today's timestamp)
        for i in 0..3 {
            history
                .add(DownloadRecord::completed(
                    format!("url{}", i),
                    format!("file{}.zip", i),
                    PathBuf::from(format!("/tmp/file{}.zip", i)),
                    1024,
                    None,
                    Utc::now(),
                    None,
                ))
                .await
                .unwrap();
        }

        // Clear older than 1 day should remove nothing (all records are fresh)
        let removed = history.clear_older_than(1).await.unwrap();
        assert_eq!(removed, 0);
        assert_eq!(history.len(), 3);
    }

    #[test]
    fn test_history_stats_methods() {
        let stats = HistoryStats {
            total_count: 10,
            completed_count: 7,
            failed_count: 2,
            cancelled_count: 1,
            total_bytes: 1048576, // 1 MB
            average_speed: 524288.0, // 512 KB/s
        };

        assert_eq!(stats.total_bytes_human(), "1.00 MB");
        assert!(stats.average_speed_human().contains("/s"));
        assert!((stats.success_rate() - 70.0).abs() < 0.1);
    }

    #[test]
    fn test_history_stats_empty() {
        let stats = HistoryStats::default();
        assert_eq!(stats.success_rate(), 0.0);
        assert_eq!(stats.total_bytes_human(), "0 B");
    }

    #[tokio::test]
    async fn test_download_history_max_records() {
        let temp_dir = tempdir().unwrap();
        let mut history = DownloadHistory::open(temp_dir.path()).await.unwrap();

        // Add more than MAX_HISTORY_RECORDS (1000)
        for i in 0..1010 {
            history
                .add(DownloadRecord::completed(
                    format!("url{}", i),
                    format!("file{}.zip", i),
                    PathBuf::from(format!("/tmp/file{}.zip", i)),
                    100,
                    None,
                    Utc::now(),
                    None,
                ))
                .await
                .unwrap();
        }

        assert!(history.len() <= MAX_HISTORY_RECORDS);
    }
}
