# Cache Management

CogniaLauncher uses a SQLite + JSON dual-backend cache system to manage download cache and metadata cache.

---

## Overview

### Cache Types

| Type | Storage | Purpose |
|------|---------|---------|
| Download Cache | File System | Downloaded packages and binaries |
| Metadata Cache | SQLite | Package info, version lists, search results |
| Version Cache | JSON | Frontend version detection result cache |

### Cache Statistics

On the **Cache** page you can view:

- Total cache size
- Number of entries
- Hit rate
- Last cleanup time

---

## Cache Operations

### Clean Cache

Clean by cache type:

- **Clean All** — Delete all cache
- **Clean by Type** — Only clean download cache or metadata cache
- **Clean by Provider** — Clean cache for a specific Provider
- **Clean by Age** — Clean cache older than a specified number of days

### Verify Cache

Check cache integrity:

- Verify file hashes
- Detect corrupted entries
- Report inconsistencies

### Repair Cache

Automatically fix discovered issues:

- Remove corrupted entries
- Rebuild indexes
- Clean orphaned files

---

## Cache Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Max Cache Size | Cache size limit | Unlimited |
| Max Cache Age | Cache expiration (days) | Unlimited |
| Auto Clean | Auto-clean when threshold exceeded | Off |
| Clean Threshold | Usage percentage to trigger auto-clean | 80% |
| Monitor Interval | Cache status check interval (seconds) | 300 |
| External Cache Monitor | Monitor external package manager caches | Off |

---

## Cache Migration

Supports migrating cache data between different storage backends (SQLite ↔ JSON).

Use the **Migrate** button on the Cache page.

---

## Related Commands

| Command | Description |
|---------|-------------|
| `cache_info` | Get cache statistics |
| `cache_clean` | Clean cache |
| `cache_verify` | Verify cache integrity |
| `cache_repair` | Repair cache |
| `get_cache_settings` | Get cache settings |
| `set_cache_settings` | Update cache settings |
