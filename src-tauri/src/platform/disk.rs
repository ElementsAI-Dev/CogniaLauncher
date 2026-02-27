//! Disk space utilities

use crate::error::{CogniaError, CogniaResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Disk space information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpace {
    /// Total disk space in bytes
    pub total: u64,
    /// Available disk space in bytes
    pub available: u64,
    /// Used disk space in bytes
    pub used: u64,
    /// Usage percentage (0-100)
    pub usage_percent: f32,
}

impl DiskSpace {
    /// Format total size as human-readable string
    pub fn total_human(&self) -> String {
        format_size(self.total)
    }

    /// Format available size as human-readable string
    pub fn available_human(&self) -> String {
        format_size(self.available)
    }

    /// Format used size as human-readable string
    pub fn used_human(&self) -> String {
        format_size(self.used)
    }
}

/// Get disk space information for the given path
#[cfg(target_os = "windows")]
pub async fn get_disk_space(path: &Path) -> CogniaResult<DiskSpace> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    // Get the root path
    let path_str = path
        .to_str()
        .ok_or_else(|| CogniaError::Internal("Invalid path".to_string()))?;

    // Extract drive letter or use the path as-is
    let root = if path_str.len() >= 2 && path_str.chars().nth(1) == Some(':') {
        format!("{}:\\", path_str.chars().next().unwrap())
    } else {
        path_str.to_string()
    };

    // Convert to wide string
    let wide_path: Vec<u16> = OsStr::new(&root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    let result = unsafe {
        GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes_available,
            &mut total_bytes,
            &mut total_free_bytes,
        )
    };

    if result == 0 {
        return Err(CogniaError::Internal(format!(
            "Failed to get disk space for {}",
            root
        )));
    }

    let used = total_bytes.saturating_sub(total_free_bytes);
    let usage_percent = if total_bytes > 0 {
        (used as f64 / total_bytes as f64 * 100.0) as f32
    } else {
        0.0
    };

    Ok(DiskSpace {
        total: total_bytes,
        available: free_bytes_available,
        used,
        usage_percent,
    })
}

/// Get disk space information for the given path (Unix)
#[cfg(not(target_os = "windows"))]
pub async fn get_disk_space(path: &Path) -> CogniaResult<DiskSpace> {
    use std::ffi::CString;

    let path_str = path
        .to_str()
        .ok_or_else(|| CogniaError::Internal("Invalid path".to_string()))?;

    let c_path =
        CString::new(path_str).map_err(|_| CogniaError::Internal("Invalid path".to_string()))?;

    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };

    let result = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };

    if result != 0 {
        return Err(CogniaError::Internal(format!(
            "Failed to get disk space for {}",
            path_str
        )));
    }

    let total = stat.f_blocks as u64 * stat.f_frsize as u64;
    let available = stat.f_bavail as u64 * stat.f_frsize as u64;
    let free = stat.f_bfree as u64 * stat.f_frsize as u64;
    let used = total.saturating_sub(free);

    let usage_percent = if total > 0 {
        (used as f64 / total as f64 * 100.0) as f32
    } else {
        0.0
    };

    Ok(DiskSpace {
        total,
        available,
        used,
        usage_percent,
    })
}

/// Check if there is enough disk space for a download
pub async fn check_available_space(path: &Path, required: u64) -> CogniaResult<bool> {
    let space = get_disk_space(path).await?;
    Ok(space.available >= required)
}

/// Ensure there is enough disk space, returning an error if not
pub async fn ensure_space(path: &Path, required: u64) -> CogniaResult<()> {
    let space = get_disk_space(path).await?;
    if space.available < required {
        return Err(CogniaError::Internal(format!(
            "Insufficient disk space: {} required, {} available",
            format_size(required),
            format_size(space.available)
        )));
    }
    Ok(())
}

/// Format bytes as human-readable string
pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format duration in seconds as human-readable string
pub fn format_duration(secs: u64) -> String {
    if secs >= 3600 {
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        format!("{}h {}m", hours, mins)
    } else if secs >= 60 {
        let mins = secs / 60;
        let secs = secs % 60;
        format!("{}m {}s", mins, secs)
    } else {
        format!("{}s", secs)
    }
}

/// Parse a human-readable size string to bytes
pub fn parse_size(s: &str) -> Option<u64> {
    let s = s.trim().to_uppercase();
    let (num_str, unit) = if s.ends_with("TB") {
        (&s[..s.len() - 2], 1024u64 * 1024 * 1024 * 1024)
    } else if s.ends_with("GB") {
        (&s[..s.len() - 2], 1024u64 * 1024 * 1024)
    } else if s.ends_with("MB") {
        (&s[..s.len() - 2], 1024u64 * 1024)
    } else if s.ends_with("KB") {
        (&s[..s.len() - 2], 1024u64)
    } else if s.ends_with('B') {
        (&s[..s.len() - 1], 1u64)
    } else {
        (s.as_str(), 1u64)
    };

    num_str
        .trim()
        .parse::<f64>()
        .ok()
        .map(|n| (n * unit as f64) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1536), "1.50 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
        assert_eq!(format_size(1024 * 1024 * 1024), "1.00 GB");
        assert_eq!(format_size(1024u64 * 1024 * 1024 * 1024), "1.00 TB");
    }

    #[test]
    fn test_parse_size() {
        assert_eq!(parse_size("1024"), Some(1024));
        assert_eq!(parse_size("1KB"), Some(1024));
        assert_eq!(parse_size("1 KB"), Some(1024));
        assert_eq!(parse_size("1.5 MB"), Some(1572864));
        assert_eq!(parse_size("1GB"), Some(1073741824));
        assert_eq!(parse_size("1 TB"), Some(1099511627776));
        assert_eq!(parse_size("invalid"), None);
    }

    #[tokio::test]
    async fn test_get_disk_space() {
        // Test with current directory
        let space = get_disk_space(Path::new(".")).await;
        assert!(space.is_ok());
        let space = space.unwrap();
        assert!(space.total > 0);
        assert!(space.available > 0);
        assert!(space.usage_percent >= 0.0 && space.usage_percent <= 100.0);
    }

    #[tokio::test]
    async fn test_check_available_space() {
        // Should have at least 1 byte available
        let result = check_available_space(Path::new("."), 1).await;
        assert!(result.is_ok());
        assert!(result.unwrap());

        // Should not have exabytes available
        let result = check_available_space(Path::new("."), u64::MAX).await;
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_format_duration_seconds() {
        assert_eq!(format_duration(0), "0s");
        assert_eq!(format_duration(1), "1s");
        assert_eq!(format_duration(59), "59s");
    }

    #[test]
    fn test_format_duration_minutes() {
        assert_eq!(format_duration(60), "1m 0s");
        assert_eq!(format_duration(90), "1m 30s");
        assert_eq!(format_duration(3599), "59m 59s");
    }

    #[test]
    fn test_format_duration_hours() {
        assert_eq!(format_duration(3600), "1h 0m");
        assert_eq!(format_duration(3661), "1h 1m");
        assert_eq!(format_duration(7200), "2h 0m");
        assert_eq!(format_duration(86400), "24h 0m");
    }

    #[test]
    fn test_disk_space_human_methods() {
        let space = DiskSpace {
            total: 1024 * 1024 * 1024,        // 1 GB
            available: 512 * 1024 * 1024,      // 512 MB
            used: 512 * 1024 * 1024,           // 512 MB
            usage_percent: 50.0,
        };
        assert_eq!(space.total_human(), "1.00 GB");
        assert_eq!(space.available_human(), "512.00 MB");
        assert_eq!(space.used_human(), "512.00 MB");
    }

    #[tokio::test]
    async fn test_ensure_space_success() {
        // 1 byte should always be available
        let result = ensure_space(Path::new("."), 1).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_ensure_space_failure() {
        let result = ensure_space(Path::new("."), u64::MAX).await;
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("Insufficient disk space"));
    }

    #[test]
    fn test_parse_size_zero() {
        assert_eq!(parse_size("0"), Some(0));
        assert_eq!(parse_size("0B"), Some(0));
        assert_eq!(parse_size("0 KB"), Some(0));
    }

    #[test]
    fn test_parse_size_bytes_suffix() {
        assert_eq!(parse_size("100B"), Some(100));
        assert_eq!(parse_size("1B"), Some(1));
    }

    #[test]
    fn test_format_size_boundary_values() {
        assert_eq!(format_size(1023), "1023 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1024 * 1024 - 1), "1024.00 KB");
        assert_eq!(format_size(1024 * 1024), "1.00 MB");
    }
}
