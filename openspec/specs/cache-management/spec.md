# cache-management Specification

## Purpose

The Cache Management system provides efficient storage and retrieval of downloaded artifacts and package metadata to minimize redundant network requests and improve application performance. It implements content-addressed storage for downloads, TTL-based caching for metadata, and automatic cleanup policies to manage disk usage.

### Key Goals

- **Performance**: O(1) cache lookups using HashMap indexing
- **Reliability**: Atomic writes with integrity verification and repair capabilities  
- **Efficiency**: LRU eviction, batch I/O operations, and configurable size limits
- **Observability**: Hit rate statistics and cache health monitoring

## Requirements

### Requirement: Download Cache

The system SHALL cache downloaded artifacts using content-addressed storage to avoid redundant downloads.

#### Scenario: Cache artifact by checksum

- **WHEN** downloading an artifact with a known checksum
- **THEN** the system stores it at `~/.CogniaLauncher/cache/downloads/{checksum}`

#### Scenario: Cache lookup

- **WHEN** requesting an artifact with a known checksum
- **THEN** the system checks the cache first and returns the cached file if it exists and is valid

#### Scenario: Cache invalidation

- **WHEN** a cached file's checksum no longer matches
- **THEN** the system removes it and re-downloads

### Requirement: Metadata Cache

The system SHALL cache package metadata with configurable TTL to reduce API requests.

#### Scenario: Cache metadata with TTL

- **WHEN** fetching package metadata
- **THEN** the system caches the response with a TTL (default: 1 hour)

#### Scenario: Return stale on error

- **WHEN** metadata fetch fails and stale cache exists
- **THEN** the system returns the stale cached data with a warning

### Requirement: Cache Database

The system SHALL maintain a SQLite database indexing cached items for efficient lookup and management.

#### Scenario: Index cache entry

- **WHEN** adding an item to cache
- **THEN** the system records key, path, size, checksum, created_at, and expires_at

#### Scenario: Query cache stats

- **WHEN** requesting cache information
- **THEN** the system returns total size, entry count, and age distribution

### Requirement: Cache Cleanup

The system SHALL provide commands to clean the cache, either entirely or selectively.

#### Scenario: Clean all cache

- **WHEN** running cache clean command
- **THEN** the system removes all cached downloads and metadata
- **AND** updates the cache database

#### Scenario: Clean expired cache

- **WHEN** running cache clean with --expired flag
- **THEN** the system removes only entries past their TTL

#### Scenario: Clean by size limit

- **WHEN** cache exceeds configured maximum size
- **THEN** the system removes oldest/least-used entries until under limit

### Requirement: Cache Information

The system SHALL provide commands to view cache status and statistics.

#### Scenario: Show cache info

- **WHEN** running cache info command
- **THEN** the system displays total cache size, number of entries, and location

