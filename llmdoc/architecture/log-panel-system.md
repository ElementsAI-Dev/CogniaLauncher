# Log Panel System Architecture

## Overview

The log panel system provides real-time application logging with a modern UI for viewing, filtering, and exporting logs. It integrates with Tauri's logging plugin for backend log forwarding and supports command output streaming.

## Components

### Backend (Rust)

#### Log Plugin Configuration
**File**: `src-tauri/src/lib.rs`

The `tauri-plugin-log` is configured with:
- **Stdout**: Console output for development
- **Webview**: Forward logs to frontend via JavaScript API
- **LogDir**: Persistent log files with rotation (5 files, 10MB each)

Module-level filters reduce noise from `hyper`, `reqwest`, `tao`, and `wry`.

#### Log Commands
**File**: `src-tauri/src/commands/log.rs`

| Command | Description |
|---------|-------------|
| `log_list_files` | List available log files in the app log directory |
| `log_query` | Query log entries with filtering and pagination |
| `log_clear` | Clear log files (specific or all except current) |
| `log_get_dir` | Get the log directory path |

#### Command Streaming
**File**: `src-tauri/src/commands/launch.rs`

The `launch_with_streaming` command emits `command-output` events in real-time using the `CommandOutputEvent` structure.

### Frontend (TypeScript/React)

#### Log Store
**File**: `lib/stores/log.ts`

Zustand store managing:
- Real-time log entries (max 1000 by default)
- Filter state (levels, search, target)
- UI state (auto-scroll, paused, drawer open)
- Log file list

Persists user preferences to localStorage.

#### Log Components
**Directory**: `components/log/`

| Component | Purpose |
|-----------|---------|
| `LogEntry` | Renders a single log entry with level badge and copy button |
| `LogToolbar` | Search, filter, pause, export, and clear controls |
| `LogPanel` | Main log viewer with auto-scroll and empty states |
| `LogDrawer` | Global slide-out drawer accessible via header button |

#### Log Page
**File**: `app/logs/page.tsx`

Full-page log viewer with tabs for:
- **Real-time**: Live log stream from the running application
- **Files**: List of saved log files with metadata

#### Tauri Bindings
**File**: `lib/tauri.ts`

Exports functions for:
- Log file operations (`logListFiles`, `logQuery`, `logClear`, `logGetDir`)
- Command output listening (`listenCommandOutput`)

#### Hook
**File**: `lib/hooks/use-logs.ts`

Convenience hook wrapping store and Tauri operations with:
- Automatic command output subscription
- File operation wrappers
- Export functionality (TXT/JSON)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Rust Backend                            │
├─────────────────────────────────────────────────────────────────┤
│  log::info!()  ──►  tauri-plugin-log  ──►  Webview Target      │
│                           │                     │               │
│                           ▼                     ▼               │
│                      LogDir (files)      JavaScript API         │
└─────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  @tauri-apps/plugin-log  ──►  attachConsole()  ──►  useLogStore │
│                                                        │        │
│  command-output event  ──────────────────────────────► │        │
│                                                        ▼        │
│                                                   LogPanel      │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Real-time Logging
- Backend logs automatically forwarded to frontend
- Console interception for webview-side logs
- Command output streaming via events

### Filtering
- Level filter (trace, debug, info, warn, error)
- Text search across message and target
- Pause/resume log collection

### Persistence
- Automatic log rotation (5 files × 10MB)
- Log file browser in UI
- Export to TXT or JSON

### UX
- Global drawer accessible from header (`Ctrl+Shift+L`)
- Auto-scroll with manual override
- Error indicator badge
- Copy individual log entries
- Color-coded log levels

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Toggle log drawer |

## Configuration

### Backend Log Level
Set in `src-tauri/src/lib.rs`:
- Debug mode: `log::LevelFilter::Debug`
- Release mode: `log::LevelFilter::Info`

### Frontend Max Logs
Set in `lib/stores/log.ts`:
- Default: 1000 entries
- Configurable via `setMaxLogs()`

## Dependencies

### Rust
- `tauri-plugin-log = "2"` (already included)
- `chrono` (timestamps)
- `uuid` (command IDs)

### Frontend
- `@tauri-apps/plugin-log` (log API)
- `zustand` (state management)
