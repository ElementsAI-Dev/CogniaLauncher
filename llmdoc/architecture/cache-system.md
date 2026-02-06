# Architecture: Cache Management System

## 1. Identity

- **What it is:** A dual-backend cache system with SQLite and JSON index support.
- **Purpose:** Efficient storage and retrieval of downloaded artifacts and package metadata.

## 2. Core Components

- `src-tauri/src/cache/sqlite_db.rs` (SqliteCacheDb): SQLite-based cache database with ACID compliance and connection pooling.
- `src-tauri/src/cache/db.rs` (CacheDb, CacheEntry, CacheStats): Legacy JSON-based cache index and shared types.
- `src-tauri/src/cache/download.rs` (DownloadCache): Content-addressed download caching with verification.
- `src-tauri/src/cache/metadata.rs` (MetadataCache): TTL-based metadata caching.
- `src-tauri/src/cache/enhanced.rs` (EnhancedCache, PartialDownload): Download resumption and repair capabilities.
- `src-tauri/src/cache/mod.rs`: Module exports and type re-exports.
- `src-tauri/src/commands/cache.rs` (cache_info, cache_clean, cache_verify): Tauri IPC commands.

## 3. Execution Flow (LLM Retrieval Map)

### Cache Entry Storage

- **1. Write:** Download initiated by `src-tauri/src/cache/download.rs:45-80` via DownloadCache.
- **2. Index:** Entry recorded in SQLite via `src-tauri/src/cache/sqlite_db.rs:131-153` (insert) or JSON via `src-tauri/src/cache/db.rs` (legacy).
- **3. Verify:** Checksum validation by `src-tauri/src/cache/download.rs:90-120`.

### Cache Entry Retrieval

- **1. Query:** Cache lookup via `src-tauri/src/cache/sqlite_db.rs:105-115` (get) or by checksum via `src-tauri/src/cache/sqlite_db.rs:118-128`.
- **2. Touch:** Update access time via `src-tauri/src/cache/sqlite_db.rs:167-179`.
- **3. Return:** Cache entry returned with hit count incremented.

### Cache Cleanup

- **1. Trigger:** Cleanup command received at `src-tauri/src/commands/cache.rs:72-100`.
- **2. Delegate:** Cache clean operations dispatched to `src-tauri/src/cache/sqlite_db.rs:237-248` (remove_expired) or `src-tauri/src/cache/sqlite_db.rs:264-286` (evict_to_size).
- **3. Verify:** File system cleanup by `src-tauri/src/platform/fs.rs`.

### Cache Size Monitoring

- **1. Query:** `src-tauri/src/commands/cache.rs` (cache_size_monitor) collects internal + external sizes.
- **2. Threshold:** Compares usage against `cache_auto_clean_threshold` from settings.
- **3. Disk:** Reports disk space via `src-tauri/src/platform/disk.rs`.

### Cache Migration

- **1. Validate:** `src-tauri/src/cache/migration.rs` (validate_migration) checks source/dest validity, space, writability.
- **2. Copy:** Recursive copy via `copy_dir_recursive` with size tracking.
- **3. Verify:** Size comparison between source and destination.
- **4. Mode A (Move):** Remove source, update config path.
- **5. Mode B (MoveAndLink):** Remove source, create symlink at original location via `src-tauri/src/platform/fs.rs` (create_symlink).

### Cache Path Management

- **1. Query:** `get_cache_path_info` returns current path, symlink status, writability, disk space.
- **2. Change:** `set_cache_path` validates and updates `paths.cache` in config.
- **3. Reset:** `reset_cache_path` clears custom path, reverts to default.

### Force Clean

- **1. Internal:** `cache_force_clean` removes all downloads, metadata, and partials regardless of age/size limits.
- **2. External:** `cache_force_clean_external` supports both command-based and direct deletion modes per provider.

### Auto-Cleanup with Threshold

- **1. Background:** `lib.rs` (cache_cleanup_task) runs every hour when `auto_clean_cache` is enabled.
- **2. Threshold Check:** If usage > threshold%, evicts to 90% of threshold level to avoid frequent triggers.
- **3. Hard Limit:** If usage > max_size, evicts to max_size.

## 4. Design Rationale

**SQLite Backend:** Replaced JSON index for better performance (indexed queries), ACID compliance (atomic writes), and concurrent access. Migration path preserved via `migrate_from_json()` in `src-tauri/src/cache/sqlite_db.rs:81-102`.

**Dual Backend:** Maintains backward compatibility with JSON-based CacheDb while SqliteCacheDb provides enhanced features.

**Migration Module:** Supports two modes—direct move (updates config) and move-with-symlink (original path still works). Uses recursive copy + verify + cleanup pattern for safety.

**Threshold-Based Cleanup:** Percentage-based threshold provides proactive cleanup before hitting hard limits. Evicts to 90% of threshold to create hysteresis and avoid cleanup loops.
