# Download Management

CogniaLauncher provides a complete download management system with queue, speed limiting, concurrency control, and history.

---

## Features

### Download Queue

- **Add Downloads** — Add download tasks via URL
- **Queue Management** — Automatic queuing, executed by priority
- **Concurrency Control** — Limit concurrent download tasks (default 4)
- **Provider Parity** — Manual add, batch import, GitHub, and GitLab flows all use the same canonical `download_add` contract

### Advanced Request Controls

- Auto-extract archives after completion
- Custom extraction destination
- Auto-rename to avoid filename collisions
- Delete archive after extraction
- Segment count (parallel connections)
- Post-download action (`none`, `open_file`, `reveal_in_folder`)
- Tag metadata (comma-separated in UI)

### Task Control

| Action | Description |
|--------|-------------|
| Pause | Pause single/all downloads |
| Resume | Resume paused downloads |
| Cancel | Cancel single/all downloads |
| Retry | Retry failed downloads (exponential backoff) |
| Remove | Remove task from list |
| Per-task Speed Limit | Set speed limit for an individual task from detail dialog |

### Batch Operations

- `download_batch_pause` — Batch pause selected tasks
- `download_batch_resume` — Batch resume selected tasks
- `download_batch_cancel` — Batch cancel selected tasks
- `download_batch_remove` — Batch remove selected tasks

### Speed Limiting

- Set global download speed limit (KB/s)
- Real-time adjustment, takes effect immediately

### Cache Hit

If the file to download already exists in cache (checksum match), the system copies directly from cache, skipping the network download.

### Download History

- Records all completed, failed, and cancelled downloads
- Search history records
- View statistics
- Clear all history
- Clear history older than N days (retention window)

### Failure and Progress UX

- Failed/cancelled tasks are mapped to normalized classes:
  `selection_error`, `network_error`, `integrity_error`, `cache_error`, `cancelled`, `timeout`
- Detail view shows retry guidance based on recoverability
- Queue and detail views stay synchronized to live runtime task/progress updates

### File Operations

- **Open File** — Open with system default program
- **Reveal File** — Locate in file manager
- **Verify File** — SHA256 checksum verification

### Disk Space

- Check available disk space before download
- Display disk usage information

---

## Progress Events

Download progress is pushed via the Tauri event system:

- `download-task-added` — New task added
- `download-task-started` — Download started
- `download-task-completed` — Download completed
- `download-task-failed` — Download failed
- `download-task-paused` — Paused
- `download-task-resumed` — Resumed
- `download-task-cancelled` — Cancelled
- `download-task-extracting` — Archive extraction started
- `download-task-extracted` — Archive extraction completed

---

## Graceful Shutdown

On application close, the following is automatically executed:

- Cancel all active downloads
- Clean up stale partial download files (older than 7 days)
- Save download state

---

## Related Commands

| Command | Description |
|---------|-------------|
| `download_add` | Add download task |
| `download_list` | List active downloads |
| `download_pause` / `resume` / `cancel` | Control single task |
| `download_pause_all` / `resume_all` / `cancel_all` | Control all tasks |
| `download_set_speed_limit` | Set speed limit |
| `download_set_task_speed_limit` | Set speed limit for a specific task |
| `download_set_max_concurrent` | Set max concurrency |
| `download_verify_file` | Verify file checksum |
| `download_open_file` | Open file |
| `download_reveal_file` | Reveal in file manager |
| `download_history_list` | Download history list |
| `download_history_search` | Search history |
| `download_history_clear` | Clear full history or records older than N days |
| `download_history_stats` | History statistics |
| `download_shutdown` | Graceful shutdown |
| `disk_space_check` | Check disk space |
