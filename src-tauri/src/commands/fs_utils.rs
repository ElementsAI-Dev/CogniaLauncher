use crate::platform::disk;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathValidationResult {
    /// The normalized absolute path
    pub normalized_path: String,
    /// Whether the path is valid syntactically
    pub is_valid: bool,
    /// Whether the path exists on disk
    pub exists: bool,
    /// Whether it is a directory
    pub is_directory: bool,
    /// Whether it is a file
    pub is_file: bool,
    /// Whether the path is writable
    pub writable: bool,
    /// Whether the path is readable
    pub readable: bool,
    /// Whether it is an absolute path
    pub is_absolute: bool,
    /// Whether the parent directory exists (useful for paths that don't exist yet)
    pub parent_exists: bool,
    /// Whether the parent directory is writable (can create the target)
    pub parent_writable: bool,
    /// Whether path traversal was detected (e.g. `../../../`)
    pub has_traversal: bool,
    /// Whether the path contains suspicious characters
    pub has_suspicious_chars: bool,
    /// Disk available space in bytes (0 if unknown)
    pub disk_available: u64,
    /// Human-readable disk available space
    pub disk_available_human: String,
    /// List of validation warnings
    pub warnings: Vec<String>,
    /// List of validation errors
    pub errors: Vec<String>,
}

/// Check if a path string contains directory traversal patterns
fn has_path_traversal(path_str: &str) -> bool {
    let normalized = path_str.replace('\\', "/");
    for segment in normalized.split('/') {
        if segment == ".." {
            return true;
        }
    }
    false
}

/// Check for suspicious characters in path
fn has_suspicious_characters(path_str: &str) -> bool {
    if path_str.contains('\0') {
        return true;
    }
    for ch in path_str.chars() {
        if ch.is_control() && ch != '\t' && ch != '\n' && ch != '\r' {
            return true;
        }
    }
    let dangerous_patterns = ["$(", "`", "${", "&&", "||", ";", "|", ">", "<"];
    for pattern in &dangerous_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    false
}

/// Check if path is writable by attempting to access metadata or create a temp marker
fn check_writable(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }
    if path.is_dir() {
        let test_path = path.join(".cognia_write_test");
        match std::fs::File::create(&test_path) {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_path);
                true
            }
            Err(_) => false,
        }
    } else {
        match std::fs::metadata(path) {
            Ok(meta) => !meta.permissions().readonly(),
            Err(_) => false,
        }
    }
}

/// Check if path is readable
fn check_readable(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }
    if path.is_dir() {
        std::fs::read_dir(path).is_ok()
    } else {
        std::fs::File::open(path).is_ok()
    }
}

/// Normalize a path string: resolve `.`, handle separators, canonicalize if possible
fn normalize_path(path_str: &str) -> PathBuf {
    let path = PathBuf::from(path_str);
    if let Ok(canonical) = std::fs::canonicalize(&path) {
        return canonical;
    }
    let mut existing = path.clone();
    let mut remaining = Vec::new();
    while !existing.exists() {
        if let Some(file_name) = existing.file_name() {
            remaining.push(file_name.to_owned());
        }
        if let Some(parent) = existing.parent() {
            existing = parent.to_path_buf();
        } else {
            break;
        }
    }
    if let Ok(canonical_base) = std::fs::canonicalize(&existing) {
        let mut result = canonical_base;
        for segment in remaining.into_iter().rev() {
            result.push(segment);
        }
        return result;
    }
    path
}

const MAX_PATH_LENGTH: usize = 4096;

#[tauri::command]
pub async fn validate_path(
    path: String,
    expect_directory: bool,
) -> Result<PathValidationResult, String> {
    let trimmed = path.trim();

    // Empty path is valid — means "use default"
    if trimmed.is_empty() {
        return Ok(PathValidationResult {
            normalized_path: String::new(),
            is_valid: true,
            exists: false,
            is_directory: false,
            is_file: false,
            writable: false,
            readable: false,
            is_absolute: false,
            parent_exists: false,
            parent_writable: false,
            has_traversal: false,
            has_suspicious_chars: false,
            disk_available: 0,
            disk_available_human: String::new(),
            warnings: vec![],
            errors: vec![],
        });
    }

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Length check
    if trimmed.len() > MAX_PATH_LENGTH {
        errors.push(format!(
            "Path exceeds maximum length of {} characters",
            MAX_PATH_LENGTH
        ));
    }

    // Suspicious characters
    let suspicious = has_suspicious_characters(trimmed);
    if suspicious {
        errors.push("Path contains potentially dangerous characters".to_string());
    }

    // Path traversal
    let traversal = has_path_traversal(trimmed);
    if traversal {
        warnings.push("Path contains '..' traversal segments".to_string());
    }

    // Parse path
    let raw_path = PathBuf::from(trimmed);
    let is_absolute = raw_path.is_absolute();
    if !is_absolute {
        errors.push("Path must be an absolute path".to_string());
    }

    // Normalize
    let normalized = normalize_path(trimmed);
    let normalized_str = normalized.to_string_lossy().to_string();

    // Existence and type checks
    let exists = normalized.exists();
    let is_directory = normalized.is_dir();
    let is_file = normalized.is_file();

    if exists && expect_directory && !is_directory {
        errors.push("Path exists but is not a directory".to_string());
    }
    if exists && !expect_directory && !is_file {
        warnings.push("Path exists but is a directory, not a file".to_string());
    }

    // Permission checks
    let writable = check_writable(&normalized);
    let readable = check_readable(&normalized);

    // Parent directory checks
    let parent = normalized.parent().map(|p| p.to_path_buf());
    let parent_exists = parent.as_ref().is_some_and(|p| p.exists());
    let parent_writable = parent.as_ref().is_some_and(|p| check_writable(p));

    if !exists && !parent_exists {
        warnings.push(
            "Neither the path nor its parent directory exists. It will need to be created."
                .to_string(),
        );
    } else if !exists && parent_exists && !parent_writable {
        errors.push("Parent directory exists but is not writable".to_string());
    }

    if exists && !writable {
        warnings.push("Path exists but is not writable".to_string());
    }

    // Disk space — reuse platform::disk utility, find nearest existing ancestor
    let mut disk_check_path = normalized.clone();
    while !disk_check_path.exists() {
        if let Some(p) = disk_check_path.parent() {
            disk_check_path = p.to_path_buf();
        } else {
            break;
        }
    }
    let (disk_available, disk_available_human) = if disk_check_path.exists() {
        match disk::get_disk_space(&disk_check_path).await {
            Ok(space) => (space.available, space.available_human()),
            Err(_) => (0, "unknown".to_string()),
        }
    } else {
        (0, "unknown".to_string())
    };

    let is_valid = errors.is_empty();

    Ok(PathValidationResult {
        normalized_path: normalized_str,
        is_valid,
        exists,
        is_directory,
        is_file,
        writable,
        readable,
        is_absolute,
        parent_exists,
        parent_writable,
        has_traversal: traversal,
        has_suspicious_chars: suspicious,
        disk_available,
        disk_available_human,
        warnings,
        errors,
    })
}
