# Spec Delta: Logging and crash diagnostics observability

## ADDED Requirements

### Requirement: Structured Log Compatibility

The system SHALL parse and filter both current and legacy structured backend log formats without losing level or timestamp semantics.

#### Scenario: Parse current structured log format

- **WHEN** a log line follows `[YYYY-MM-DD HH:MM:SS(.ms)][LEVEL][TARGET] MESSAGE`
- **THEN** the parsed entry uses the original timestamp string
- **AND** the parsed `level`, `target`, and `message` fields map correctly

#### Scenario: Parse legacy structured log format

- **WHEN** a log line follows `[YYYY-MM-DD][HH:MM:SS][TARGET][LEVEL] MESSAGE`
- **THEN** the parsed entry normalizes timestamp to `YYYY-MM-DD HH:MM:SS`
- **AND** the parsed `level`, `target`, and `message` fields map correctly
- **AND** time-range filtering uses the normalized timestamp

### Requirement: Crash Report Log Path Resolution

The system SHALL discover panic-time log files using Tauri v2 platform conventions and retain compatibility fallbacks.

#### Scenario: Resolve canonical Tauri v2 log directory

- **WHEN** generating a crash report without AppHandle path resolver access
- **THEN** the system first checks the canonical app log directory location for the active platform
- **AND** includes logs from that directory when available

#### Scenario: Fallback to legacy log paths

- **WHEN** canonical paths do not exist but legacy paths are present
- **THEN** the system may use the legacy path as best-effort fallback

### Requirement: Crash Report Retention

The system SHALL bound crash-report storage growth by automatic retention cleanup.

#### Scenario: Keep latest crash reports only

- **WHEN** crash reports exceed retention count
- **THEN** only the newest 20 crash ZIP files are kept
- **AND** older ZIP files are removed
