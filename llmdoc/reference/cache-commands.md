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
