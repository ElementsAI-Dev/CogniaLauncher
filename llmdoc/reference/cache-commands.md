# Reference: Cache Commands

## 1. Core Summary

Tauri IPC commands for cache management including info retrieval, cleanup, verification, repair, and settings management. Commands support both download and metadata caches with granular control over cache types. Enhanced with trash/recycle bin support, cleanup preview, and cleanup history tracking.

## 2. Source of Truth

- **Primary Commands:** `src-tauri/src/commands/cache.rs` - Cache command handlers
  - Basic: `cache_info`, `cache_clean`, `cache_verify`, `cache_repair`
  - Enhanced: `cache_clean_preview`, `cache_clean_enhanced`
  - History: `get_cleanup_history`, `clear_cleanup_history`, `get_cleanup_summary`
  - Settings: `get_cache_settings`, `set_cache_settings`
- **Cache Types:** `src-tauri/src/cache/db.rs:8-28` - CacheEntry, CacheEntryType enums
- **Cleanup History:** `src-tauri/src/cache/history.rs` - CleanupHistory, CleanupRecord
- **SQLite Backend:** `src-tauri/src/cache/sqlite_db.rs` - SqliteCacheDb implementation
- **Download Cache:** `src-tauri/src/cache/download.rs` - DownloadCache operations
- **Metadata Cache:** `src-tauri/src/cache/metadata.rs` - MetadataCache operations
- **Trash Support:** `src-tauri/src/platform/fs.rs` - move_to_trash, remove_file_with_option
- **Related Architecture:** `/llmdoc/architecture/cache-system.md` - Complete cache system architecture
- **Specification:** `openspec/specs/cache-management/spec.md` - Cache management requirements

## 3. Enhanced Cleanup Commands

### cache_clean_preview

Preview files that will be cleaned without deleting them.

- **Input:** `clean_type: Option<String>` - "downloads", "metadata", "expired", or "all"
- **Output:** `CleanPreview` - files list, total_count, total_size, total_size_human

### cache_clean_enhanced

Clean cache with trash support and history recording.

- **Input:**
  - `clean_type: Option<String>` - "downloads", "metadata", "expired", or "all"
  - `use_trash: Option<bool>` - Move to trash (true) or permanent delete (false)
- **Output:** `EnhancedCleanResult` - freed_bytes, freed_human, deleted_count, use_trash, history_id

### get_cleanup_history

Get past cleanup records.

- **Input:** `limit: Option<usize>` - Max records to return
- **Output:** `Vec<CleanupRecord>` - List of cleanup records

### get_cleanup_summary

Get aggregate statistics across all cleanup history.

- **Output:** `CleanupHistorySummary` - total_cleanups, total_freed, trash vs permanent counts

## 4. Cache Size Monitoring

### cache_size_monitor

Monitor cache sizes with threshold detection and disk space info.

- **Input:** `include_external: Option<bool>` - Include external caches in monitoring
- **Output:** `CacheSizeMonitorResponse` - internal/external/total sizes, usage percent, threshold status, disk space, external cache breakdown

## 5. Cache Path Management

### get_cache_path_info

Get current cache path info including symlink detection and disk space.

- **Output:** `CachePathInfoResponse` - current/default paths, is_custom, is_symlink, writable, disk space

### set_cache_path

Change the cache storage location.

- **Input:** `new_path: String` - New directory path (must be writable)
- **Output:** `()` - Updates config and creates directory if needed

### reset_cache_path

Reset cache path to the default location.

- **Output:** `String` - The default path that was restored

## 6. Cache Migration

### cache_migration_validate

Validate a migration destination before executing.

- **Input:** `destination: String` - Target directory path
- **Output:** `MigrationValidation` - validity, sizes, space, errors/warnings

### cache_migrate

Execute cache migration with move or move-and-link mode.

- **Input:**
  - `destination: String` - Target directory path
  - `mode: String` - "move" or "move_and_link"
- **Output:** `MigrationResult` - success, bytes migrated, file count, symlink status
- **Source:** `src-tauri/src/cache/migration.rs`

## 7. Force Clean

### cache_force_clean

Force clean all internal caches regardless of age/size limits.

- **Input:** `use_trash: Option<bool>` - Move to trash or permanently delete
- **Output:** `EnhancedCleanResult` - freed bytes, deleted count

### cache_force_clean_external

Force clean a specific external cache provider.

- **Input:**
  - `provider: String` - Provider ID (npm, pip, cargo, etc.)
  - `use_command: Option<bool>` - Use provider's clean command vs direct deletion
  - `use_trash: Option<bool>` - Move to trash (only for direct deletion)
- **Output:** `ExternalCacheCleanResult` - provider, freed bytes, success status

## 8. External Cache Paths

### get_external_cache_paths

Get detailed path and status info for all external cache providers.

- **Output:** `Vec<ExternalCachePathInfo>` - provider, path, exists, size, availability, clean command, env vars

## 9. Enhanced Cache Settings

### get_enhanced_cache_settings / set_enhanced_cache_settings

Get/set cache settings including new threshold and monitoring fields.

- **Fields:** max_size, max_age_days, metadata_cache_ttl, auto_clean, auto_clean_threshold, monitor_interval, monitor_external
- **Source:** `src-tauri/src/config/settings.rs` (GeneralSettings)
