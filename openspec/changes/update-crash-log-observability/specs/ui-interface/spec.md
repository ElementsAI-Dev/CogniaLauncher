# Spec Delta: Frontend crash capture and recovery UX

## ADDED Requirements

### Requirement: Automatic Frontend Crash Capture

The system SHALL automatically capture diagnostic artifacts for uncaught frontend runtime failures in desktop mode.

#### Scenario: Capture uncaught script error

- **WHEN** an uncaught `window.error` event occurs in desktop mode
- **THEN** the frontend submits error context to backend crash capture
- **AND** backend generates a crash diagnostic ZIP with logs and sanitized config by default

#### Scenario: Capture unhandled promise rejection

- **WHEN** an uncaught `window.unhandledrejection` event occurs in desktop mode
- **THEN** the frontend submits rejection context to backend crash capture
- **AND** backend generates a crash diagnostic ZIP with logs and sanitized config by default

### Requirement: Session-Level Crash Capture Deduplication

The system SHALL avoid repeated automatic crash captures within a single frontend session.

#### Scenario: Duplicate runtime failures in one session

- **WHEN** multiple uncaught runtime failures occur during one app session
- **THEN** automatic crash capture runs at most once for that session
- **AND** subsequent failures still log errors without generating additional ZIPs

### Requirement: Recovery Notification Continuity

The system SHALL preserve next-launch crash recovery flow for automatically captured frontend crashes.

#### Scenario: Frontend crash captured automatically

- **WHEN** automatic capture succeeds
- **THEN** a lightweight in-session notification is shown
- **AND** a crash marker is written so next launch can show recovery dialog with report location
