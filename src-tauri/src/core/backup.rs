use crate::cache::DownloadCache;
use crate::config::Settings;
use crate::core::custom_detection::CustomDetectionManager;
use crate::core::profiles::ProfileManager;
use crate::core::terminal::TerminalProfileManager;
use crate::error::{CogniaError, CogniaResult};
use crate::platform::{disk::format_size, fs};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupContentType {
    Config,
    TerminalProfiles,
    EnvironmentProfiles,
    CacheDatabase,
    DownloadHistory,
    CleanupHistory,
    CustomDetectionRules,
    EnvironmentSettings,
}

impl BackupContentType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "config" => Some(Self::Config),
            "terminal_profiles" => Some(Self::TerminalProfiles),
            "environment_profiles" => Some(Self::EnvironmentProfiles),
            "cache_database" => Some(Self::CacheDatabase),
            "download_history" => Some(Self::DownloadHistory),
            "cleanup_history" => Some(Self::CleanupHistory),
            "custom_detection_rules" => Some(Self::CustomDetectionRules),
            "environment_settings" => Some(Self::EnvironmentSettings),
            _ => None,
        }
    }

    pub fn filename(&self) -> &'static str {
        match self {
            Self::Config => "config.toml",
            Self::TerminalProfiles => "terminal-profiles.json",
            Self::EnvironmentProfiles => "env-profiles.json",
            Self::CacheDatabase => "cache.db",
            Self::DownloadHistory => "download-history.json",
            Self::CleanupHistory => "cleanup-history.json",
            Self::CustomDetectionRules => "custom-rules.json",
            Self::EnvironmentSettings => "env-settings",
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::Config,
            Self::TerminalProfiles,
            Self::EnvironmentProfiles,
            Self::CacheDatabase,
            Self::DownloadHistory,
            Self::CleanupHistory,
            Self::CustomDetectionRules,
            Self::EnvironmentSettings,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub format_version: u32,
    pub app_version: String,
    pub created_at: String,
    pub platform: String,
    pub hostname: String,
    pub contents: Vec<BackupContentType>,
    pub file_checksums: HashMap<String, String>,
    pub total_size: u64,
    pub note: Option<String>,
    #[serde(default)]
    pub auto_generated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub name: String,
    pub manifest: BackupManifest,
    pub size: u64,
    pub size_human: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub success: bool,
    pub path: String,
    pub manifest: BackupManifest,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub success: bool,
    pub restored: Vec<String>,
    pub skipped: Vec<RestoreSkipped>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreSkipped {
    pub content_type: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupValidationResult {
    pub valid: bool,
    pub manifest: Option<BackupManifest>,
    pub missing_files: Vec<String>,
    pub checksum_mismatches: Vec<String>,
    pub errors: Vec<String>,
}

// ============================================================================
// Backup Operations
// ============================================================================

/// Create a unified backup of selected application data.
///
/// Reuses existing per-subsystem export functions — never reimplements serialization.
pub async fn create_backup(
    settings: &Settings,
    contents: &[BackupContentType],
    note: Option<&str>,
    terminal_manager: &TerminalProfileManager,
    profile_manager: &ProfileManager,
    custom_detection_manager: &CustomDetectionManager,
) -> CogniaResult<BackupResult> {
    let start = std::time::Instant::now();

    let root_dir = settings.get_root_dir();
    let backup_base = root_dir.join("backups");
    fs::create_dir_all(&backup_base).await?;

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_name = format!("cognia-backup-{}", timestamp);
    let backup_dir = backup_base.join(&backup_name);
    fs::create_dir_all(&backup_dir).await?;

    let mut file_checksums: HashMap<String, String> = HashMap::new();
    let mut actual_contents: Vec<BackupContentType> = Vec::new();
    let mut total_size: u64 = 0;

    let cache_dir = settings.get_cache_dir();
    let state_dir = settings.get_state_dir();

    for content_type in contents {
        match backup_content(
            *content_type,
            &backup_dir,
            settings,
            &cache_dir,
            &state_dir,
            terminal_manager,
            profile_manager,
            custom_detection_manager,
        )
        .await
        {
            Ok(files) => {
                actual_contents.push(*content_type);
                for (filename, checksum, size) in files {
                    file_checksums.insert(filename, checksum);
                    total_size += size;
                }
            }
            Err(e) => {
                log::warn!(
                    "Backup of {:?} failed, skipping: {}",
                    content_type,
                    e
                );
            }
        }
    }

    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());

    let manifest = BackupManifest {
        format_version: 1,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: Utc::now().to_rfc3339(),
        platform: std::env::consts::OS.to_string(),
        hostname,
        contents: actual_contents,
        file_checksums,
        total_size,
        note: note.map(|s| s.to_string()),
        auto_generated: false,
    };

    // Write manifest
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| CogniaError::Internal(format!("Failed to serialize manifest: {}", e)))?;
    let manifest_path = backup_dir.join("manifest.json");
    fs::write_file_string(&manifest_path, &manifest_json).await?;

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(BackupResult {
        success: true,
        path: backup_dir.display().to_string(),
        manifest,
        duration_ms,
        error: None,
    })
}

/// Backup a single content type, returning list of (filename, sha256, size).
async fn backup_content(
    content_type: BackupContentType,
    backup_dir: &Path,
    settings: &Settings,
    cache_dir: &Path,
    state_dir: &Path,
    terminal_manager: &TerminalProfileManager,
    profile_manager: &ProfileManager,
    custom_detection_manager: &CustomDetectionManager,
) -> CogniaResult<Vec<(String, String, u64)>> {
    let mut files = Vec::new();

    match content_type {
        BackupContentType::Config => {
            let toml_str = toml::to_string_pretty(settings)
                .map_err(|e| CogniaError::Internal(format!("Config serialize failed: {}", e)))?;
            let dest = backup_dir.join("config.toml");
            fs::write_file_string(&dest, &toml_str).await?;
            let checksum = fs::calculate_sha256(&dest).await?;
            let size = fs::file_size(&dest).await?;
            files.push(("config.toml".to_string(), checksum, size));
        }

        BackupContentType::TerminalProfiles => {
            let json = terminal_manager.export_profiles()?;
            let dest = backup_dir.join("terminal-profiles.json");
            fs::write_file_string(&dest, &json).await?;
            let checksum = fs::calculate_sha256(&dest).await?;
            let size = fs::file_size(&dest).await?;
            files.push(("terminal-profiles.json".to_string(), checksum, size));
        }

        BackupContentType::EnvironmentProfiles => {
            let profiles = profile_manager.list();
            let json = serde_json::to_string_pretty(&profiles)
                .map_err(|e| CogniaError::Internal(format!("Profiles serialize failed: {}", e)))?;
            let dest = backup_dir.join("env-profiles.json");
            fs::write_file_string(&dest, &json).await?;
            let checksum = fs::calculate_sha256(&dest).await?;
            let size = fs::file_size(&dest).await?;
            files.push(("env-profiles.json".to_string(), checksum, size));
        }

        BackupContentType::CacheDatabase => {
            let download_cache = DownloadCache::open(cache_dir).await?;
            let dest = backup_dir.join("cache.db");
            let size = download_cache.backup_to_file(&dest).await?;
            let checksum = fs::calculate_sha256(&dest).await?;
            files.push(("cache.db".to_string(), checksum, size));
        }

        BackupContentType::DownloadHistory => {
            let src = cache_dir.join("download_history.json");
            if fs::exists(&src).await {
                let dest = backup_dir.join("download-history.json");
                fs::copy_file(&src, &dest).await?;
                let checksum = fs::calculate_sha256(&dest).await?;
                let size = fs::file_size(&dest).await?;
                files.push(("download-history.json".to_string(), checksum, size));
            }
        }

        BackupContentType::CleanupHistory => {
            let src = cache_dir.join("cleanup-history.json");
            if fs::exists(&src).await {
                let dest = backup_dir.join("cleanup-history.json");
                fs::copy_file(&src, &dest).await?;
                let checksum = fs::calculate_sha256(&dest).await?;
                let size = fs::file_size(&dest).await?;
                files.push(("cleanup-history.json".to_string(), checksum, size));
            }
        }

        BackupContentType::CustomDetectionRules => {
            let rules = custom_detection_manager.list_rules();
            let json = serde_json::to_string_pretty(rules)
                .map_err(|e| CogniaError::Internal(format!("Rules serialize failed: {}", e)))?;
            let dest = backup_dir.join("custom-rules.json");
            fs::write_file_string(&dest, &json).await?;
            let checksum = fs::calculate_sha256(&dest).await?;
            let size = fs::file_size(&dest).await?;
            files.push(("custom-rules.json".to_string(), checksum, size));
        }

        BackupContentType::EnvironmentSettings => {
            let env_settings_dir = state_dir.join("env-settings");
            if fs::exists(&env_settings_dir).await {
                let dest_dir = backup_dir.join("env-settings");
                fs::create_dir_all(&dest_dir).await?;

                let mut entries = tokio::fs::read_dir(&env_settings_dir)
                    .await
                    .map_err(CogniaError::Io)?;

                while let Some(entry) = entries.next_entry().await.map_err(CogniaError::Io)? {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            let dest = dest_dir.join(name);
                            fs::copy_file(&path, &dest).await?;
                            let checksum = fs::calculate_sha256(&dest).await?;
                            let size = fs::file_size(&dest).await?;
                            files.push((
                                format!("env-settings/{}", name),
                                checksum,
                                size,
                            ));
                        }
                    }
                }
            }
        }
    }

    Ok(files)
}

/// Restore selected content types from a backup directory.
///
/// Automatically creates a safety backup before restoring so the user can
/// roll back if something goes wrong.
pub async fn restore_backup(
    backup_path: &Path,
    contents: &[BackupContentType],
    settings: &mut Settings,
    terminal_manager: &mut TerminalProfileManager,
    profile_manager: &mut ProfileManager,
    custom_detection_manager: &mut CustomDetectionManager,
) -> CogniaResult<RestoreResult> {
    // Create a safety backup before restoring
    match create_auto_backup(
        settings,
        "pre-restore-auto-backup",
        terminal_manager,
        profile_manager,
        custom_detection_manager,
    )
    .await
    {
        Ok(result) => {
            log::info!(
                "Pre-restore safety backup created at: {}",
                result.path
            );
        }
        Err(e) => {
            log::warn!("Failed to create pre-restore safety backup: {}", e);
        }
    }

    // First validate the backup
    let validation = validate_backup(backup_path).await?;
    if !validation.valid {
        return Ok(RestoreResult {
            success: false,
            restored: vec![],
            skipped: vec![],
            error: Some(validation.errors.join("; ")),
        });
    }

    let cache_dir = settings.get_cache_dir();
    let state_dir = settings.get_state_dir();

    let mut restored = Vec::new();
    let mut skipped = Vec::new();

    for content_type in contents {
        match restore_content(
            *content_type,
            backup_path,
            settings,
            &cache_dir,
            &state_dir,
            terminal_manager,
            profile_manager,
            custom_detection_manager,
        )
        .await
        {
            Ok(()) => {
                restored.push(format!("{:?}", content_type).to_lowercase());
            }
            Err(e) => {
                skipped.push(RestoreSkipped {
                    content_type: format!("{:?}", content_type).to_lowercase(),
                    reason: e.to_string(),
                });
            }
        }
    }

    // Save settings after restore
    settings.save().await?;

    Ok(RestoreResult {
        success: skipped.is_empty(),
        restored,
        skipped,
        error: None,
    })
}

/// Restore a single content type from backup.
async fn restore_content(
    content_type: BackupContentType,
    backup_path: &Path,
    settings: &mut Settings,
    cache_dir: &Path,
    state_dir: &Path,
    terminal_manager: &mut TerminalProfileManager,
    _profile_manager: &mut ProfileManager,
    _custom_detection_manager: &mut CustomDetectionManager,
) -> CogniaResult<()> {
    match content_type {
        BackupContentType::Config => {
            let src = backup_path.join("config.toml");
            if !fs::exists(&src).await {
                return Err(CogniaError::Internal("config.toml not found in backup".into()));
            }
            let content = fs::read_file_string(&src).await?;
            let parsed: Settings = toml::from_str(&content)
                .map_err(|e| CogniaError::Parse(format!("Failed to parse backup config: {}", e)))?;
            *settings = parsed;
        }

        BackupContentType::TerminalProfiles => {
            let src = backup_path.join("terminal-profiles.json");
            if !fs::exists(&src).await {
                return Err(CogniaError::Internal(
                    "terminal-profiles.json not found in backup".into(),
                ));
            }
            let json = fs::read_file_string(&src).await?;
            terminal_manager.import_profiles(&json, false).await?;
        }

        BackupContentType::EnvironmentProfiles => {
            let src = backup_path.join("env-profiles.json");
            if !fs::exists(&src).await {
                return Err(CogniaError::Internal(
                    "env-profiles.json not found in backup".into(),
                ));
            }
            let json = fs::read_file_string(&src).await?;
            let profiles: Vec<crate::core::profiles::EnvironmentProfile> =
                serde_json::from_str(&json).map_err(|e| {
                    CogniaError::Parse(format!("Failed to parse backup profiles: {}", e))
                })?;
            for profile in profiles {
                let _ = _profile_manager.create(profile).await;
            }
        }

        BackupContentType::CacheDatabase => {
            let src = backup_path.join("cache.db");
            if !fs::exists(&src).await {
                return Err(CogniaError::Internal("cache.db not found in backup".into()));
            }
            let dest = cache_dir.join("cache.db");
            // Backup existing DB before overwriting
            if fs::exists(&dest).await {
                let backup = cache_dir.join("cache.db.pre-restore-bak");
                fs::copy_file(&dest, &backup).await?;
            }
            fs::copy_file(&src, &dest).await?;
        }

        BackupContentType::DownloadHistory => {
            let src = backup_path.join("download-history.json");
            if fs::exists(&src).await {
                let dest = cache_dir.join("download_history.json");
                fs::copy_file(&src, &dest).await?;
            } else {
                log::warn!("download-history.json not found in backup, skipping");
            }
        }

        BackupContentType::CleanupHistory => {
            let src = backup_path.join("cleanup-history.json");
            if fs::exists(&src).await {
                let dest = cache_dir.join("cleanup-history.json");
                fs::copy_file(&src, &dest).await?;
            } else {
                log::warn!("cleanup-history.json not found in backup, skipping");
            }
        }

        BackupContentType::CustomDetectionRules => {
            let src = backup_path.join("custom-rules.json");
            if !fs::exists(&src).await {
                return Err(CogniaError::Internal(
                    "custom-rules.json not found in backup".into(),
                ));
            }
            let json = fs::read_file_string(&src).await?;
            let rules: Vec<crate::core::custom_detection::CustomDetectionRule> =
                serde_json::from_str(&json).map_err(|e| {
                    CogniaError::Parse(format!("Failed to parse backup rules: {}", e))
                })?;
            for rule in rules {
                let _ = _custom_detection_manager.add_rule(rule);
            }
            _custom_detection_manager.save().await?;
        }

        BackupContentType::EnvironmentSettings => {
            let src_dir = backup_path.join("env-settings");
            if !fs::exists(&src_dir).await {
                log::warn!("env-settings directory not found in backup, skipping");
            } else {
                let dest_dir = state_dir.join("env-settings");
                fs::create_dir_all(&dest_dir).await?;

                let mut entries = tokio::fs::read_dir(&src_dir)
                    .await
                    .map_err(CogniaError::Io)?;

                while let Some(entry) = entries.next_entry().await.map_err(CogniaError::Io)? {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(name) = path.file_name() {
                            let dest = dest_dir.join(name);
                            fs::copy_file(&path, &dest).await?;
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// List all available backups in the backups directory.
pub async fn list_backups(settings: &Settings) -> CogniaResult<Vec<BackupInfo>> {
    let backup_base = settings.get_root_dir().join("backups");
    if !fs::exists(&backup_base).await {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    let mut entries = tokio::fs::read_dir(&backup_base)
        .await
        .map_err(CogniaError::Io)?;

    while let Some(entry) = entries.next_entry().await.map_err(CogniaError::Io)? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }

        match fs::read_file_string(&manifest_path).await {
            Ok(content) => {
                if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                    // Calculate total backup directory size
                    let size = dir_size_async(&path).await;
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    backups.push(BackupInfo {
                        path: path.display().to_string(),
                        name,
                        manifest,
                        size,
                        size_human: format_size(size),
                    });
                }
            }
            Err(_) => continue,
        }
    }

    // Sort by creation date, newest first
    backups.sort_by(|a, b| b.manifest.created_at.cmp(&a.manifest.created_at));

    Ok(backups)
}

/// Delete a backup directory.
pub async fn delete_backup(backup_path: &Path) -> CogniaResult<bool> {
    if !fs::exists(backup_path).await {
        return Ok(false);
    }

    // Verify it's a valid backup directory (has manifest.json)
    let manifest_path = backup_path.join("manifest.json");
    if !fs::exists(&manifest_path).await {
        return Err(CogniaError::Internal(
            "Not a valid backup directory (no manifest.json)".into(),
        ));
    }

    fs::remove_dir_all(backup_path).await?;
    Ok(true)
}

/// Validate a backup directory: check manifest, file existence, and checksums.
pub async fn validate_backup(backup_path: &Path) -> CogniaResult<BackupValidationResult> {
    let mut errors = Vec::new();
    let mut missing_files = Vec::new();
    let mut checksum_mismatches = Vec::new();

    // Check manifest exists
    let manifest_path = backup_path.join("manifest.json");
    if !fs::exists(&manifest_path).await {
        errors.push("manifest.json not found".to_string());
        return Ok(BackupValidationResult {
            valid: false,
            manifest: None,
            missing_files,
            checksum_mismatches,
            errors,
        });
    }

    // Parse manifest
    let manifest_content = fs::read_file_string(&manifest_path).await?;
    let manifest: BackupManifest = match serde_json::from_str(&manifest_content) {
        Ok(m) => m,
        Err(e) => {
            errors.push(format!("Invalid manifest.json: {}", e));
            return Ok(BackupValidationResult {
                valid: false,
                manifest: None,
                missing_files,
                checksum_mismatches,
                errors,
            });
        }
    };

    // Check format version
    if manifest.format_version != 1 {
        errors.push(format!(
            "Unsupported backup format version: {}",
            manifest.format_version
        ));
    }

    // Verify each file listed in checksums
    for (filename, expected_checksum) in &manifest.file_checksums {
        let file_path = backup_path.join(filename);
        if !fs::exists(&file_path).await {
            missing_files.push(filename.clone());
            continue;
        }

        match fs::calculate_sha256(&file_path).await {
            Ok(actual_checksum) => {
                if &actual_checksum != expected_checksum {
                    checksum_mismatches.push(filename.clone());
                }
            }
            Err(_) => {
                errors.push(format!("Failed to calculate checksum for {}", filename));
            }
        }
    }

    let valid = errors.is_empty() && missing_files.is_empty() && checksum_mismatches.is_empty();

    Ok(BackupValidationResult {
        valid,
        manifest: Some(manifest),
        missing_files,
        checksum_mismatches,
        errors,
    })
}

// ============================================================================
// Export / Import (ZIP)
// ============================================================================

/// Export a backup directory as a `.zip` archive.
pub async fn export_backup(backup_path: &Path, dest_path: &Path) -> CogniaResult<u64> {
    // Validate it's a real backup
    let manifest_path = backup_path.join("manifest.json");
    if !fs::exists(&manifest_path).await {
        return Err(CogniaError::Internal(
            "Not a valid backup directory (no manifest.json)".into(),
        ));
    }

    let backup_dir = backup_path.to_path_buf();
    let dest = dest_path.to_path_buf();

    let size = tokio::task::spawn_blocking(move || -> CogniaResult<u64> {
        use std::io::Write;

        let file = std::fs::File::create(&dest)
            .map_err(|e| CogniaError::Io(e))?;
        let mut zip_writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Use the backup directory name as a top-level prefix in the zip
        // so import can extract it as a named directory.
        let dir_name = backup_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup")
            .to_string();

        // Add top-level directory entry
        zip_writer.add_directory(format!("{}/", dir_name), options)
            .map_err(|e| CogniaError::Internal(format!("ZIP dir error: {}", e)))?;

        // Walk the backup directory
        for entry in walkdir::WalkDir::new(&backup_dir)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let relative = path
                .strip_prefix(&backup_dir)
                .unwrap_or(path);

            if path.is_file() {
                let name = format!("{}/{}", dir_name, relative.to_string_lossy().replace('\\', "/"));
                zip_writer.start_file(&name, options)
                    .map_err(|e| CogniaError::Internal(format!("ZIP write error: {}", e)))?;
                let data = std::fs::read(path).map_err(CogniaError::Io)?;
                zip_writer.write_all(&data)
                    .map_err(|e| CogniaError::Internal(format!("ZIP write error: {}", e)))?;
            } else if path.is_dir() && path != backup_dir.as_path() {
                let name = format!("{}/{}/", dir_name, relative.to_string_lossy().replace('\\', "/"));
                zip_writer.add_directory(&name, options)
                    .map_err(|e| CogniaError::Internal(format!("ZIP dir error: {}", e)))?;
            }
        }

        zip_writer.finish()
            .map_err(|e| CogniaError::Internal(format!("ZIP finish error: {}", e)))?;

        let meta = std::fs::metadata(&dest).map_err(CogniaError::Io)?;
        Ok(meta.len())
    })
    .await
    .map_err(|e| CogniaError::Internal(format!("Export task failed: {}", e)))??;

    Ok(size)
}

/// Import a `.zip` archive as a backup.
///
/// Extracts to the backups directory, validates the manifest, and returns the
/// resulting `BackupInfo`.
pub async fn import_backup(
    zip_path: &Path,
    settings: &Settings,
) -> CogniaResult<BackupInfo> {
    let backup_base = settings.get_root_dir().join("backups");
    fs::create_dir_all(&backup_base).await?;

    let src = zip_path.to_path_buf();
    let base = backup_base.clone();

    // Extract in blocking context
    let extracted_dir = tokio::task::spawn_blocking(move || -> CogniaResult<std::path::PathBuf> {
        use std::io::Read;

        let file = std::fs::File::open(&src).map_err(CogniaError::Io)?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| CogniaError::Internal(format!("Invalid ZIP: {}", e)))?;

        // Determine the backup directory name from the zip
        // If the zip has a top-level directory, use it; otherwise generate one
        let top_dir = {
            let first = archive.by_index(0)
                .map_err(|e| CogniaError::Internal(format!("ZIP read error: {}", e)))?;
            let name = first.name().to_string();
            if let Some(slash_pos) = name.find('/') {
                name[..slash_pos].to_string()
            } else {
                format!(
                    "cognia-backup-imported-{}",
                    chrono::Utc::now().format("%Y%m%d-%H%M%S")
                )
            }
        };

        let dest_dir = base.join(&top_dir);
        if dest_dir.exists() {
            return Err(CogniaError::Internal(format!(
                "Backup directory already exists: {}",
                top_dir
            )));
        }

        // Extract all files
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)
                .map_err(|e| CogniaError::Internal(format!("ZIP read error: {}", e)))?;

            let out_path = base.join(entry.name());

            // Prevent path traversal
            if !out_path.starts_with(&base) {
                continue;
            }

            if entry.is_dir() {
                std::fs::create_dir_all(&out_path).map_err(CogniaError::Io)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent).map_err(CogniaError::Io)?;
                }
                let mut outfile = std::fs::File::create(&out_path).map_err(CogniaError::Io)?;
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)
                    .map_err(|e| CogniaError::Internal(format!("ZIP read error: {}", e)))?;
                std::io::Write::write_all(&mut outfile, &buf)
                    .map_err(|e| CogniaError::Internal(format!("Write error: {}", e)))?;
            }
        }

        Ok(dest_dir)
    })
    .await
    .map_err(|e| CogniaError::Internal(format!("Import task failed: {}", e)))??;

    // Validate the extracted backup
    let validation = validate_backup(&extracted_dir).await?;
    if !validation.valid {
        // Clean up invalid import
        let _ = fs::remove_dir_all(&extracted_dir).await;
        return Err(CogniaError::Internal(format!(
            "Imported backup is invalid: {}",
            validation.errors.join("; ")
        )));
    }

    let manifest = validation.manifest.unwrap();
    let size = dir_size_async(&extracted_dir).await;
    let name = extracted_dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(BackupInfo {
        path: extracted_dir.display().to_string(),
        name,
        manifest,
        size,
        size_human: format_size(size),
    })
}

// ============================================================================
// Helpers
// ============================================================================

/// Create an automatic backup with the auto_generated flag set.
pub async fn create_auto_backup(
    settings: &Settings,
    note: &str,
    terminal_manager: &TerminalProfileManager,
    profile_manager: &ProfileManager,
    custom_detection_manager: &CustomDetectionManager,
) -> CogniaResult<BackupResult> {
    let mut result = create_backup(
        settings,
        &BackupContentType::all(),
        Some(note),
        terminal_manager,
        profile_manager,
        custom_detection_manager,
    )
    .await?;

    // Mark as auto-generated in the manifest
    result.manifest.auto_generated = true;

    // Re-write manifest with the auto_generated flag
    let manifest_json = serde_json::to_string_pretty(&result.manifest)
        .map_err(|e| CogniaError::Internal(format!("Failed to serialize manifest: {}", e)))?;
    let manifest_path = std::path::PathBuf::from(&result.path).join("manifest.json");
    fs::write_file_string(&manifest_path, &manifest_json).await?;

    Ok(result)
}

/// Remove old backups based on retention policy.
///
/// - `max_count`: Maximum number of backups to keep (0 = unlimited).
/// - `max_age_days`: Maximum age in days (0 = unlimited).
///
/// Auto-generated backups are counted separately and limited to `max_count / 2`
/// (minimum 3).
pub async fn cleanup_old_backups(
    settings: &Settings,
    max_count: u32,
    max_age_days: u32,
) -> CogniaResult<u32> {
    let mut backups = list_backups(settings).await?;
    if backups.is_empty() {
        return Ok(0);
    }

    let mut deleted = 0u32;
    let now = Utc::now();

    // Delete backups older than max_age_days
    if max_age_days > 0 {
        let cutoff = now - chrono::Duration::days(max_age_days as i64);
        let cutoff_str = cutoff.to_rfc3339();
        let mut to_remove = Vec::new();
        for backup in &backups {
            if backup.manifest.created_at < cutoff_str {
                to_remove.push(backup.path.clone());
            }
        }
        for path in to_remove {
            if delete_backup(&std::path::PathBuf::from(&path)).await.unwrap_or(false) {
                deleted += 1;
            }
        }
        // Re-fetch after deletions
        backups = list_backups(settings).await?;
    }

    // Enforce max_count
    if max_count > 0 {
        let auto_limit = (max_count / 2).max(3) as usize;

        // Split into manual and auto backups
        let (auto_backups, manual_backups): (Vec<_>, Vec<_>) = backups
            .iter()
            .partition(|b| b.manifest.auto_generated);

        // Trim manual backups (already sorted newest-first)
        if manual_backups.len() > max_count as usize {
            for backup in &manual_backups[max_count as usize..] {
                if delete_backup(&std::path::PathBuf::from(&backup.path)).await.unwrap_or(false) {
                    deleted += 1;
                }
            }
        }

        // Trim auto backups
        if auto_backups.len() > auto_limit {
            for backup in &auto_backups[auto_limit..] {
                if delete_backup(&std::path::PathBuf::from(&backup.path)).await.unwrap_or(false) {
                    deleted += 1;
                }
            }
        }
    }

    Ok(deleted)
}

async fn dir_size_async(path: &Path) -> u64 {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || dir_size_sync(&path))
        .await
        .unwrap_or(0)
}

fn dir_size_sync(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(meta) = std::fs::metadata(&p) {
                    total += meta.len();
                }
            } else if p.is_dir() {
                total += dir_size_sync(&p);
            }
        }
    }
    total
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_content_type_from_str() {
        assert_eq!(
            BackupContentType::from_str("config"),
            Some(BackupContentType::Config)
        );
        assert_eq!(
            BackupContentType::from_str("cache_database"),
            Some(BackupContentType::CacheDatabase)
        );
        assert_eq!(BackupContentType::from_str("invalid"), None);
    }

    #[test]
    fn test_backup_content_type_all() {
        let all = BackupContentType::all();
        assert_eq!(all.len(), 8);
    }

    #[test]
    fn test_backup_content_type_filename() {
        assert_eq!(BackupContentType::Config.filename(), "config.toml");
        assert_eq!(
            BackupContentType::TerminalProfiles.filename(),
            "terminal-profiles.json"
        );
        assert_eq!(BackupContentType::CacheDatabase.filename(), "cache.db");
    }

    #[tokio::test]
    async fn test_validate_nonexistent_backup() {
        let dir = tempfile::tempdir().unwrap();
        let nonexistent = dir.path().join("does_not_exist");
        let result = validate_backup(&nonexistent).await.unwrap();
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_backup() {
        let dir = tempfile::tempdir().unwrap();
        let nonexistent = dir.path().join("does_not_exist");
        let result = delete_backup(&nonexistent).await.unwrap();
        assert!(!result);
    }

    #[tokio::test]
    async fn test_validate_backup_with_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = BackupManifest {
            format_version: 1,
            app_version: "0.1.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test-host".to_string(),
            contents: vec![BackupContentType::Config],
            file_checksums: HashMap::new(),
            total_size: 0,
            note: None,
            auto_generated: false,
        };

        let manifest_json = serde_json::to_string_pretty(&manifest).unwrap();
        tokio::fs::write(dir.path().join("manifest.json"), &manifest_json)
            .await
            .unwrap();

        let result = validate_backup(dir.path()).await.unwrap();
        assert!(result.valid);
        assert!(result.manifest.is_some());
    }

    #[test]
    fn test_backup_content_type_from_str_all_variants() {
        let cases = vec![
            ("config", Some(BackupContentType::Config)),
            ("terminal_profiles", Some(BackupContentType::TerminalProfiles)),
            ("environment_profiles", Some(BackupContentType::EnvironmentProfiles)),
            ("cache_database", Some(BackupContentType::CacheDatabase)),
            ("download_history", Some(BackupContentType::DownloadHistory)),
            ("cleanup_history", Some(BackupContentType::CleanupHistory)),
            ("custom_detection_rules", Some(BackupContentType::CustomDetectionRules)),
            ("environment_settings", Some(BackupContentType::EnvironmentSettings)),
            ("unknown_type", None),
            ("", None),
        ];

        for (input, expected) in cases {
            assert_eq!(BackupContentType::from_str(input), expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn test_backup_content_type_filename_all_variants() {
        assert_eq!(BackupContentType::TerminalProfiles.filename(), "terminal-profiles.json");
        assert_eq!(BackupContentType::EnvironmentProfiles.filename(), "env-profiles.json");
        assert_eq!(BackupContentType::DownloadHistory.filename(), "download-history.json");
        assert_eq!(BackupContentType::CleanupHistory.filename(), "cleanup-history.json");
        assert_eq!(BackupContentType::CustomDetectionRules.filename(), "custom-rules.json");
        assert_eq!(BackupContentType::EnvironmentSettings.filename(), "env-settings");
    }

    #[test]
    fn test_backup_manifest_serde_roundtrip() {
        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.2.3".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            platform: "windows".to_string(),
            hostname: "my-pc".to_string(),
            contents: vec![BackupContentType::Config, BackupContentType::CacheDatabase],
            file_checksums: {
                let mut m = HashMap::new();
                m.insert("config.toml".to_string(), "sha256hash".to_string());
                m
            },
            total_size: 4096,
            note: Some("Test backup".to_string()),
            auto_generated: false,
        };

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains("\"formatVersion\":1"));
        assert!(json.contains("\"appVersion\":\"1.2.3\""));

        let deser: BackupManifest = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.format_version, 1);
        assert_eq!(deser.app_version, "1.2.3");
        assert_eq!(deser.contents.len(), 2);
        assert_eq!(deser.total_size, 4096);
        assert_eq!(deser.note, Some("Test backup".to_string()));
    }

    #[test]
    fn test_backup_info_serde_roundtrip() {
        let info = BackupInfo {
            path: "/tmp/backups/cognia-backup-20240101".to_string(),
            name: "cognia-backup-20240101".to_string(),
            manifest: BackupManifest {
                format_version: 1,
                app_version: "1.0.0".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                platform: "linux".to_string(),
                hostname: "host".to_string(),
                contents: vec![],
                file_checksums: HashMap::new(),
                total_size: 0,
                note: None,
                auto_generated: false,
            },
            size: 1024,
            size_human: "1.00 KB".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        let deser: BackupInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.name, "cognia-backup-20240101");
        assert_eq!(deser.size, 1024);
        assert_eq!(deser.size_human, "1.00 KB");
    }

    #[test]
    fn test_backup_result_serde_roundtrip() {
        let result = BackupResult {
            success: true,
            path: "/tmp/backup".to_string(),
            manifest: BackupManifest {
                format_version: 1,
                app_version: "1.0.0".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                platform: "test".to_string(),
                hostname: "test".to_string(),
                contents: vec![],
                file_checksums: HashMap::new(),
                total_size: 0,
                note: None,
                auto_generated: false,
            },
            duration_ms: 150,
            error: None,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deser: BackupResult = serde_json::from_str(&json).unwrap();
        assert!(deser.success);
        assert_eq!(deser.duration_ms, 150);
        assert!(deser.error.is_none());
    }

    #[test]
    fn test_restore_result_serde_roundtrip() {
        let result = RestoreResult {
            success: false,
            restored: vec!["config".to_string()],
            skipped: vec![RestoreSkipped {
                content_type: "cache_database".to_string(),
                reason: "file missing".to_string(),
            }],
            error: Some("partial restore".to_string()),
        };

        let json = serde_json::to_string(&result).unwrap();
        let deser: RestoreResult = serde_json::from_str(&json).unwrap();
        assert!(!deser.success);
        assert_eq!(deser.restored.len(), 1);
        assert_eq!(deser.skipped.len(), 1);
        assert_eq!(deser.skipped[0].content_type, "cache_database");
    }

    #[test]
    fn test_backup_validation_result_serde_roundtrip() {
        let result = BackupValidationResult {
            valid: false,
            manifest: None,
            missing_files: vec!["config.toml".to_string()],
            checksum_mismatches: vec!["cache.db".to_string()],
            errors: vec!["checksum mismatch".to_string()],
        };

        let json = serde_json::to_string(&result).unwrap();
        let deser: BackupValidationResult = serde_json::from_str(&json).unwrap();
        assert!(!deser.valid);
        assert!(deser.manifest.is_none());
        assert_eq!(deser.missing_files.len(), 1);
        assert_eq!(deser.checksum_mismatches.len(), 1);
    }

    #[test]
    fn test_dir_size_sync_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(dir_size_sync(dir.path()), 0);
    }

    #[test]
    fn test_dir_size_sync_with_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "hello").unwrap();
        std::fs::write(dir.path().join("b.txt"), "world!").unwrap();

        let size = dir_size_sync(dir.path());
        assert!(size > 0);
        assert_eq!(size, 5 + 6); // "hello" + "world!"
    }

    #[test]
    fn test_dir_size_sync_nested() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("file.txt"), "abc").unwrap();

        let size = dir_size_sync(dir.path());
        assert_eq!(size, 3);
    }

    #[test]
    fn test_dir_size_sync_nonexistent() {
        let dir = tempfile::tempdir().unwrap();
        let nonexistent = dir.path().join("does_not_exist");
        let size = dir_size_sync(&nonexistent);
        assert_eq!(size, 0);
    }

    #[tokio::test]
    async fn test_validate_backup_invalid_manifest() {
        let dir = tempfile::tempdir().unwrap();
        tokio::fs::write(dir.path().join("manifest.json"), "not valid json")
            .await
            .unwrap();

        let result = validate_backup(dir.path()).await.unwrap();
        assert!(!result.valid);
        assert!(result.manifest.is_none());
    }

    #[tokio::test]
    async fn test_validate_backup_wrong_format_version() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = BackupManifest {
            format_version: 99,
            app_version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![],
            file_checksums: HashMap::new(),
            total_size: 0,
            note: None,
            auto_generated: false,
        };
        let json = serde_json::to_string(&manifest).unwrap();
        tokio::fs::write(dir.path().join("manifest.json"), &json)
            .await
            .unwrap();

        let result = validate_backup(dir.path()).await.unwrap();
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("Unsupported backup format")));
    }

    #[tokio::test]
    async fn test_delete_backup_no_manifest() {
        let dir = tempfile::tempdir().unwrap();
        // Create a directory without manifest.json
        let fake_backup = dir.path().join("fake-backup");
        tokio::fs::create_dir(&fake_backup).await.unwrap();

        let result = delete_backup(&fake_backup).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no manifest.json"));
    }

    // ===== auto_generated field tests =====

    #[test]
    fn test_manifest_auto_generated_default_false() {
        let json = r#"{
            "formatVersion": 1,
            "appVersion": "1.0.0",
            "createdAt": "2024-01-01T00:00:00Z",
            "platform": "test",
            "hostname": "test",
            "contents": [],
            "fileChecksums": {},
            "totalSize": 0,
            "note": null
        }"#;
        let manifest: BackupManifest = serde_json::from_str(json).unwrap();
        assert!(!manifest.auto_generated, "auto_generated should default to false");
    }

    #[test]
    fn test_manifest_auto_generated_roundtrip() {
        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.0.0".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![],
            file_checksums: HashMap::new(),
            total_size: 0,
            note: Some("auto".to_string()),
            auto_generated: true,
        };

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains("\"autoGenerated\":true"));

        let deser: BackupManifest = serde_json::from_str(&json).unwrap();
        assert!(deser.auto_generated);
    }

    // ===== export / import tests =====

    #[tokio::test]
    async fn test_export_backup_no_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let empty_dir = dir.path().join("empty");
        tokio::fs::create_dir(&empty_dir).await.unwrap();
        let dest = dir.path().join("out.zip");

        let result = export_backup(&empty_dir, &dest).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("no manifest.json"));
    }

    #[tokio::test]
    async fn test_export_import_roundtrip() {
        let dir = tempfile::tempdir().unwrap();

        // Create a fake backup directory
        let backup_dir = dir.path().join("cognia-backup-test");
        tokio::fs::create_dir(&backup_dir).await.unwrap();

        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![BackupContentType::Config],
            file_checksums: HashMap::new(),
            total_size: 42,
            note: Some("roundtrip test".to_string()),
            auto_generated: false,
        };
        let manifest_json = serde_json::to_string_pretty(&manifest).unwrap();
        tokio::fs::write(backup_dir.join("manifest.json"), &manifest_json)
            .await
            .unwrap();
        tokio::fs::write(backup_dir.join("config.toml"), "# test config")
            .await
            .unwrap();

        // Export to zip
        let zip_path = dir.path().join("export.zip");
        let zip_size = export_backup(&backup_dir, &zip_path).await.unwrap();
        assert!(zip_size > 0);
        assert!(zip_path.exists());

        // Import into a fresh "backups" directory via Settings
        let import_root = dir.path().join("import-root");
        tokio::fs::create_dir(&import_root).await.unwrap();

        let mut settings = Settings::default();
        settings.paths.root = Some(import_root.clone());

        let info = import_backup(&zip_path, &settings).await.unwrap();
        assert_eq!(info.manifest.format_version, 1);
        assert_eq!(info.manifest.note, Some("roundtrip test".to_string()));
        assert!(info.size > 0);

        // Verify files exist
        let imported_dir = std::path::PathBuf::from(&info.path);
        assert!(imported_dir.join("manifest.json").exists());
        assert!(imported_dir.join("config.toml").exists());
    }

    #[tokio::test]
    async fn test_import_duplicate_fails() {
        let dir = tempfile::tempdir().unwrap();

        // Create a backup directory
        let backup_dir = dir.path().join("cognia-backup-dup");
        tokio::fs::create_dir(&backup_dir).await.unwrap();

        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![],
            file_checksums: HashMap::new(),
            total_size: 0,
            note: None,
            auto_generated: false,
        };
        tokio::fs::write(
            backup_dir.join("manifest.json"),
            serde_json::to_string(&manifest).unwrap(),
        )
        .await
        .unwrap();

        // Export
        let zip_path = dir.path().join("dup.zip");
        export_backup(&backup_dir, &zip_path).await.unwrap();

        // Import once
        let import_root = dir.path().join("import-root2");
        tokio::fs::create_dir(&import_root).await.unwrap();
        let mut settings = Settings::default();
        settings.paths.root = Some(import_root.clone());

        import_backup(&zip_path, &settings).await.unwrap();

        // Import again — should fail (directory exists)
        let result = import_backup(&zip_path, &settings).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already exists"));
    }

    // ===== cleanup tests =====

    #[tokio::test]
    async fn test_cleanup_empty_backups() {
        let dir = tempfile::tempdir().unwrap();
        let mut settings = Settings::default();
        settings.paths.root = Some(dir.path().to_path_buf());

        let deleted = cleanup_old_backups(&settings, 5, 30).await.unwrap();
        assert_eq!(deleted, 0);
    }

    #[tokio::test]
    async fn test_cleanup_max_count() {
        let dir = tempfile::tempdir().unwrap();
        let backups_dir = dir.path().join("backups");
        tokio::fs::create_dir(&backups_dir).await.unwrap();

        // Create 5 backup directories with manifests
        for i in 0..5 {
            let name = format!("cognia-backup-{:04}", i);
            let bdir = backups_dir.join(&name);
            tokio::fs::create_dir(&bdir).await.unwrap();

            let manifest = BackupManifest {
                format_version: 1,
                app_version: "1.0.0".to_string(),
                created_at: format!("2024-01-{:02}T00:00:00Z", i + 1),
                platform: "test".to_string(),
                hostname: "test".to_string(),
                contents: vec![],
                file_checksums: HashMap::new(),
                total_size: 0,
                note: None,
                auto_generated: false,
            };
            tokio::fs::write(
                bdir.join("manifest.json"),
                serde_json::to_string(&manifest).unwrap(),
            )
            .await
            .unwrap();
        }

        let mut settings = Settings::default();
        settings.paths.root = Some(dir.path().to_path_buf());

        // Keep max 2 — should delete 3
        let deleted = cleanup_old_backups(&settings, 2, 0).await.unwrap();
        assert_eq!(deleted, 3);

        let remaining = list_backups(&settings).await.unwrap();
        assert_eq!(remaining.len(), 2);
    }

    // ===== validate with checksum mismatch =====

    #[tokio::test]
    async fn test_validate_backup_checksum_mismatch() {
        let dir = tempfile::tempdir().unwrap();

        // Write a file and record wrong checksum
        tokio::fs::write(dir.path().join("config.toml"), "data")
            .await
            .unwrap();

        let mut checksums = HashMap::new();
        checksums.insert("config.toml".to_string(), "wrong_checksum".to_string());

        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![BackupContentType::Config],
            file_checksums: checksums,
            total_size: 4,
            note: None,
            auto_generated: false,
        };
        tokio::fs::write(
            dir.path().join("manifest.json"),
            serde_json::to_string(&manifest).unwrap(),
        )
        .await
        .unwrap();

        let result = validate_backup(dir.path()).await.unwrap();
        assert!(!result.valid);
        assert_eq!(result.checksum_mismatches.len(), 1);
        assert_eq!(result.checksum_mismatches[0], "config.toml");
    }

    #[tokio::test]
    async fn test_validate_backup_missing_file() {
        let dir = tempfile::tempdir().unwrap();

        let mut checksums = HashMap::new();
        checksums.insert("missing.txt".to_string(), "abc".to_string());

        let manifest = BackupManifest {
            format_version: 1,
            app_version: "1.0.0".to_string(),
            created_at: Utc::now().to_rfc3339(),
            platform: "test".to_string(),
            hostname: "test".to_string(),
            contents: vec![],
            file_checksums: checksums,
            total_size: 0,
            note: None,
            auto_generated: false,
        };
        tokio::fs::write(
            dir.path().join("manifest.json"),
            serde_json::to_string(&manifest).unwrap(),
        )
        .await
        .unwrap();

        let result = validate_backup(dir.path()).await.unwrap();
        assert!(!result.valid);
        assert_eq!(result.missing_files.len(), 1);
        assert_eq!(result.missing_files[0], "missing.txt");
    }
}
