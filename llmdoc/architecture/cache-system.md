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

## 4. Design Rationale

**SQLite Backend:** Replaced JSON index for better performance (indexed queries), ACID compliance (atomic writes), and concurrent access. Migration path preserved via `migrate_from_json()` in `src-tauri/src/cache/sqlite_db.rs:81-102`.

**Dual Backend:** Maintains backward compatibility with JSON-based CacheDb while SqliteCacheDb provides enhanced features.
