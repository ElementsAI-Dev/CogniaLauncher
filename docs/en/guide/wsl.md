# WSL Management

CogniaLauncher provides comprehensive Windows Subsystem for Linux (WSL) management capabilities.

!!! note "Windows Only"
    This feature is only available on Windows.

---

## Overview

### Capability Detection & Auto-Degradation

- On opening the WSL page, the app reads `wsl --help` and `wsl --version` to auto-detect supported command capabilities.
- For newer commands (e.g., `--manage --move` / `--manage --resize` / `--set-default-user`), the UI automatically enables or grays out features with explanatory tooltips.
- Default user setting preferentially uses `wsl --manage <distro> --set-default-user`; if unsupported, it falls back to the legacy compatible path.
- Running distro detection preferentially uses `wsl --list --running --quiet` to avoid multilingual output misinterpretation.

### Version Requirements (Key Capabilities)

- `wsl --manage` series capabilities require **Microsoft Store WSL 2.5+** (`move`/`resize`/`set-default-user` commands depend on local `wsl --help` output).
- `--set-sparse` requires a newer Store version of WSL (Microsoft publicly released this capability in 2024).
- If the local command surface doesn't provide a parameter, CogniaLauncher will auto-degrade and show a tooltip.

### Distribution Management

- **List Installed** — View all WSL distributions and their status
- **Online Search** — Browse available distributions for installation
- **Install** — One-click install new distributions
- **Install to Custom Location** — Install a selected distro into a user-specified host directory
- **Uninstall** — Unregister and delete distributions
- **Set Default** — Set the default distribution

### Version Management

- **WSL Version Switching** — Switch between WSL 1 and WSL 2
- **Default Version Setting** — Set the default WSL version for new distributions

### Import & Export

- **Capability-gated Formats** — VHD export/import controls are only shown when runtime capability detection supports them
- **Export** — Deterministic export path handling (`.tar` or `.vhdx`) with actionable error feedback
- **Import** — Import a distribution from a tar/vhdx file (VHD mode follows runtime capability gating)
- **In-place Import** — Import using VHD format

### Runtime Management

- **Launch** — Launch a specific distribution
- **Terminate** — Terminate a specific distribution
- **Shutdown WSL** — Shut down all running distributions
- **View Running** — List currently running distributions
- **Runtime information snapshots** — Runtime overview now keeps status, capability, and version reads in a shared snapshot with refresh timestamps and degraded/stale hints
- **Richer component versions** — Runtime overview surfaces WSL, kernel, WSLg, and Windows component version readouts from the same refresh path
- **Open in Explorer** — Open distribution filesystem in Windows Explorer
- **Open in Terminal** — Open distribution directly in Windows Terminal (or fallback shell)
- **Inline lifecycle feedback** — Long-running, batch, and high-risk operations remain visible in-page with running, success, failure, and retry guidance
- **Workflow continuation** — Distro detail links preserve a return path back to the originating overview, sidebar, or widget workflow
- **Tray quick actions** — The desktop tray now mirrors WSL runtime state and can launch the default distro, shut down all running distros, or jump straight into the WSL manager
- **Command palette actions** — When WSL is available on Windows, the command palette exposes quick actions for launching the default distro, shutting down all distros, and opening the default distro terminal
- **CLI management** — `cognia wsl list|status|launch|terminate|shutdown|exec` provides headless WSL control with both table and JSON output paths

### Disk Management

- **Mount Disk** — Mount a physical disk to WSL
- **Unmount Disk** — Unmount a disk from WSL
- **Disk Usage** — View distribution disk usage
- **Total Disk Usage** — View aggregated usage across all installed distributions
- **Migrate Distribution** — Use `wsl --manage <distro> --move <location>`
- **Resize Virtual Disk** — Use `wsl --manage <distro> --resize <size>`
- **Sparse Mode** — Enable/disable VHD auto-reclaim
- **Clone Distribution** — Duplicate an existing distro via export/import flow
- **Batch launch / terminate** — Execute multi-distro runtime actions with per-distro outcome summaries and stale-selection normalization

### Network & Users

- **Get IP** — View distribution IP address
- **Change Default User** — Modify default login user for a distribution
- **Health Check** — Run distro health diagnostics and inspect structured issues/timestamp in detail workflow
- **Port Forwarding** — Add/remove `netsh portproxy` rules with explicit confirmation and risk guidance
- **Network Mode Switching** — Switch global WSL networking mode (`NAT`, `mirrored`, `virtioproxy`) from the distro network tab with restart confirmation and automatic `wsl --shutdown` follow-through

### Assistance Facilities

- **Runtime Assistance Region** — Main WSL workflow exposes guided actions grouped as check / repair / maintenance.
- **Distro Assistance Region** — Distro detail workflow exposes context-aware actions with selected distro prefilled.
- **Preflight Checks** — Runtime and distro preflight produce structured check items and actionable recommendations.
- **Contextual Recovery Suggestions** — Error surfaces can suggest relevant assistance actions inline and launch them in-context.
- **Structured Diagnostics Summary** — Assistance actions return status, timestamp, findings, recommendations, and retry support.
- **Post-Action Reconciliation** — Assistance-triggered mutations refresh affected runtime/distro slices to avoid stale UI state.
- **Return-path preservation** — Assistance and distro workflows keep a clear path back to the originating WSL entry surface

### Distribution Configuration

Manage per-distribution configuration via `/etc/wsl.conf`:

- **systemd** — Enable/disable systemd
- **Auto Mount** — Windows drive auto-mounting
- **Interop** — Windows/Linux program interoperability
- **Custom Key-Value** — Edit arbitrary configuration entries

### WSL Updates

- Check for WSL component updates
- Execute WSL updates

### Profiles, Health, And Backup Automation

- **Profile snapshots** — Environment profiles can now capture and restore WSL state, including `.wslconfig`, distro inventory, and default distro metadata
- **WSL health in unified checks** — The global Health Check workspace now surfaces WSL runtime issues separately from envvar and generic system issues
- **Scheduled backups** — Distro detail includes backup schedules with persisted cadence, startup missed-run detection, and retention cleanup after successful scheduled backups

### Information Readouts & Refresh

- Runtime and distro detail reads now use shared information snapshots instead of isolated one-off fetches.
- Distro overview sections can explicitly report `unavailable`, `stale`, and refresh-retry guidance instead of silently clearing data.
- If a refresh fails after a successful read, CogniaLauncher keeps the last successful data visible and marks it as stale so you can retry without losing context.

### High-Risk Operation Protection

The following operations show a confirmation dialog in the UI with admin privilege/risk warnings:

- Unregister distribution (`unregister`)
- Migration and resize (`move` / `resize`)
- Mount and unmount disk (`mount` / `unmount`)
- Shutdown all instances (`shutdown`)
- Port-forward mutations (`add/remove portproxy rule`)

---

## Related Commands

| Command | Description |
|---------|-------------|
| `wsl_list_distros` | List installed distributions |
| `wsl_list_online` | List available distributions |
| `wsl_status` | WSL status information |
| `wsl_terminate` | Terminate a distribution |
| `wsl_shutdown` | Shut down WSL |
| `wsl_set_default` | Set default distribution |
| `wsl_set_version` | Set distribution WSL version |
| `wsl_export` | Export distribution |
| `wsl_import` | Import distribution |
| `wsl_import_in_place` | In-place import |
| `wsl_install_with_location` | Install distro at custom location |
| `wsl_update` | Update WSL |
| `wsl_launch` | Launch distribution |
| `wsl_open_in_explorer` | Open distro filesystem in Explorer |
| `wsl_open_in_terminal` | Open distro in terminal |
| `wsl_clone_distro` | Clone a distribution |
| `wsl_mount` | Mount disk |
| `wsl_unmount` | Unmount disk |
| `wsl_get_ip` | Get IP address |
| `wsl_change_default_user` | Change default user |
| `wsl_get_distro_config` | Read distribution configuration |
| `wsl_set_distro_config` | Write distribution configuration |
| `wsl_set_networking_mode` | Change global WSL networking mode |
| `wsl_get_capabilities` | Get runtime command capabilities |
| `wsl_get_version_info` | Get detailed WSL component versions |
| `wsl_total_disk_usage` | Get total disk usage across distributions |
| `wsl_move_distro` | Migrate distribution disk location |
| `wsl_resize_distro` | Resize distribution virtual disk |
| `profile_capture_wsl_snapshot` | Capture WSL state for environment profiles |
| `profile_apply_wsl_snapshot` | Apply a captured WSL profile snapshot |
| `tray_set_wsl_state` | Sync WSL runtime state into the desktop tray |
