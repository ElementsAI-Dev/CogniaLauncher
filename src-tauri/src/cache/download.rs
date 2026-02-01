use super::db::{CacheDb, CacheEntry, CacheEntryType};
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{
    fs,
    network::{DownloadProgress, HttpClient},
};
use std::path::{Path, PathBuf};

pub struct DownloadCache {
    cache_dir: PathBuf,
    db: CacheDb,
}

impl DownloadCache {
    pub async fn open(cache_dir: &Path) -> CogniaResult<Self> {
        let downloads_dir = cache_dir.join("downloads");
        fs::create_dir_all(&downloads_dir).await?;

        let db = CacheDb::open(cache_dir).await?;

        Ok(Self {
            cache_dir: downloads_dir,
            db,
        })
    }

    pub fn get_by_checksum(&self, checksum: &str) -> Option<PathBuf> {
        self.db
            .get_by_checksum(checksum)
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone())
    }

    pub fn get(&self, key: &str) -> Option<PathBuf> {
        self.db
            .get(key)
            .filter(|entry| !entry.is_expired())
            .map(|entry| entry.file_path.clone())
    }

    pub async fn download<F>(
        &mut self,
        url: &str,
        expected_checksum: Option<&str>,
        on_progress: Option<F>,
    ) -> CogniaResult<PathBuf>
    where
        F: FnMut(DownloadProgress),
    {
        if let Some(checksum) = expected_checksum {
            if let Some(cached_path) = self.get_by_checksum(checksum) {
                if fs::exists(&cached_path).await {
                    self.db.touch(&format!("checksum:{}", checksum)).await?;
                    return Ok(cached_path);
                }
            }
        }

        let temp_path = self
            .cache_dir
            .join(format!(".download-{}.tmp", uuid::Uuid::new_v4()));

        let client = HttpClient::new();
        let downloaded_size = client.download(url, &temp_path, on_progress).await?;

        let actual_checksum = fs::calculate_sha256(&temp_path).await?;

        if let Some(expected) = expected_checksum {
            if actual_checksum != expected {
                fs::remove_file(&temp_path).await?;
                return Err(CogniaError::ChecksumMismatch {
                    expected: expected.to_string(),
                    actual: actual_checksum,
                });
            }
        }

        let final_path = self.cache_dir.join(&actual_checksum);
        fs::move_file(&temp_path, &final_path).await?;

        let entry = CacheEntry::new(
            format!("checksum:{}", actual_checksum),
            &final_path,
            downloaded_size,
            &actual_checksum,
            CacheEntryType::Download,
        );

        self.db.insert(entry).await?;

        Ok(final_path)
    }

    pub async fn add_file(&mut self, source: &Path, checksum: &str) -> CogniaResult<PathBuf> {
        let target_path = self.cache_dir.join(checksum);

        if fs::exists(&target_path).await {
            return Ok(target_path);
        }

        fs::copy_file(source, &target_path).await?;
        let size = fs::file_size(&target_path).await?;

        let entry = CacheEntry::new(
            format!("checksum:{}", checksum),
            &target_path,
            size,
            checksum,
            CacheEntryType::Download,
        );

        self.db.insert(entry).await?;

        Ok(target_path)
    }

    pub async fn verify(&self, checksum: &str) -> CogniaResult<bool> {
        if let Some(path) = self.get_by_checksum(checksum) {
            if fs::exists(&path).await {
                let actual = fs::calculate_sha256(&path).await?;
                return Ok(actual == checksum);
            }
        }
        Ok(false)
    }

    pub async fn remove(&mut self, checksum: &str) -> CogniaResult<bool> {
        let key = format!("checksum:{}", checksum);

        if let Some(entry) = self.db.get(&key) {
            let path = entry.file_path.clone();
            if fs::exists(&path).await {
                fs::remove_file(&path).await?;
            }
        }

        self.db.remove(&key).await
    }

    pub async fn clean(&mut self) -> CogniaResult<u64> {
        let mut total_freed = 0u64;

        let entries: Vec<_> = self
            .db
            .list()
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .cloned()
            .collect();

        for entry in entries {
            if fs::exists(&entry.file_path).await {
                total_freed += entry.size;
                fs::remove_file(&entry.file_path).await?;
            }
            self.db.remove(&entry.key).await?;
        }

        Ok(total_freed)
    }

    pub async fn stats(&self) -> DownloadCacheStats {
        let entries: Vec<_> = self
            .db
            .list()
            .iter()
            .filter(|e| e.entry_type == CacheEntryType::Download)
            .collect();

        let total_size = entries.iter().map(|e| e.size).sum();
        let entry_count = entries.len();

        DownloadCacheStats {
            total_size,
            entry_count,
            location: self.cache_dir.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DownloadCacheStats {
    pub total_size: u64,
    pub entry_count: usize,
    pub location: PathBuf,
}

impl DownloadCacheStats {
    pub fn size_human(&self) -> String {
        const KB: u64 = 1024;
        const MB: u64 = KB * 1024;
        const GB: u64 = MB * 1024;

        if self.total_size >= GB {
            format!("{:.2} GB", self.total_size as f64 / GB as f64)
        } else if self.total_size >= MB {
            format!("{:.2} MB", self.total_size as f64 / MB as f64)
        } else if self.total_size >= KB {
            format!("{:.2} KB", self.total_size as f64 / KB as f64)
        } else {
            format!("{} B", self.total_size)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_add_and_get_file() {
        let dir = tempdir().unwrap();
        let mut cache = DownloadCache::open(dir.path()).await.unwrap();

        let test_file = dir.path().join("test.txt");
        fs::write_file_string(&test_file, "test content")
            .await
            .unwrap();

        let checksum = fs::calculate_sha256(&test_file).await.unwrap();

        let cached_path = cache.add_file(&test_file, &checksum).await.unwrap();
        assert!(fs::exists(&cached_path).await);

        let retrieved = cache.get_by_checksum(&checksum);
        assert!(retrieved.is_some());
    }

    #[test]
    fn test_size_human() {
        let stats = DownloadCacheStats {
            total_size: 1536,
            entry_count: 1,
            location: PathBuf::new(),
        };
        assert_eq!(stats.size_human(), "1.50 KB");

        let stats = DownloadCacheStats {
            total_size: 1572864,
            entry_count: 1,
            location: PathBuf::new(),
        };
        assert_eq!(stats.size_human(), "1.50 MB");
    }
}
