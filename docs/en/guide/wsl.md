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
- **Uninstall** — Unregister and delete distributions
- **Set Default** — Set the default distribution

### Version Management

- **WSL Version Switching** — Switch between WSL 1 and WSL 2
- **Default Version Setting** — Set the default WSL version for new distributions

### Import & Export

- **Export** — Export a distribution as a tar file
- **Import** — Import a distribution from a tar file
- **In-place Import** — Import using VHD format

### Runtime Management

- **Launch** — Launch a specific distribution
- **Terminate** — Terminate a specific distribution
- **Shutdown WSL** — Shut down all running distributions
- **View Running** — List currently running distributions

### Disk Management

- **Mount Disk** — Mount a physical disk to WSL
- **Unmount Disk** — Unmount a disk from WSL
- **Disk Usage** — View distribution disk usage
- **Migrate Distribution** — Use `wsl --manage <distro> --move <location>`
- **Resize Virtual Disk** — Use `wsl --manage <distro> --resize <size>`
- **Sparse Mode** — Enable/disable VHD auto-reclaim

### Network & Users

- **Get IP** — View distribution IP address
- **Change Default User** — Modify default login user for a distribution

### Distribution Configuration

Manage per-distribution configuration via `/etc/wsl.conf`:

- **systemd** — Enable/disable systemd
- **Auto Mount** — Windows drive auto-mounting
- **Interop** — Windows/Linux program interoperability
- **Custom Key-Value** — Edit arbitrary configuration entries

### WSL Updates

- Check for WSL component updates
- Execute WSL updates

### High-Risk Operation Protection

The following operations show a confirmation dialog in the UI with admin privilege/risk warnings:

- Unregister distribution (`unregister`)
- Migration and resize (`move` / `resize`)
- Mount and unmount disk (`mount` / `unmount`)
- Shutdown all instances (`shutdown`)

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
| `wsl_update` | Update WSL |
| `wsl_launch` | Launch distribution |
| `wsl_mount` | Mount disk |
| `wsl_unmount` | Unmount disk |
| `wsl_get_ip` | Get IP address |
| `wsl_change_default_user` | Change default user |
| `wsl_get_distro_config` | Read distribution configuration |
| `wsl_set_distro_config` | Write distribution configuration |
| `wsl_get_capabilities` | Get runtime command capabilities |
| `wsl_move_distro` | Migrate distribution disk location |
| `wsl_resize_distro` | Resize distribution virtual disk |
