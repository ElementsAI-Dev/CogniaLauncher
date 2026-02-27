# Package Management

CogniaLauncher integrates 51+ Providers, offering a unified package search, installation, and management experience.

---

## Core Features

### Package Search

- **Keyword Search** — Search across all available Providers
- **Advanced Search** — Filter by Provider, platform, category
- **Search Suggestions** — Auto-complete while typing
- **Package Comparison** — Compare multiple packages side by side

### Package Installation

1. Search for the target package
2. View package details (version, dependencies, license, description)
3. Select a version (optional)
4. Click **Install**

Supported installation options:

- Specify version number
- Global/project-level installation
- Force reinstall

### Package Management

- **List Installed** — View all installed packages
- **Check Updates** — Detect available updates
- **Batch Operations** — Batch install/uninstall/update
- **Version Pinning** — Lock package version to prevent accidental updates
- **Version Rollback** — Roll back to a previous version

### Dependency Resolution

CogniaLauncher uses the PubGrub algorithm for dependency resolution:

- Automatically resolve package dependencies
- Detect version conflicts
- Generate installation plans

---

## Batch Operations

Batch operations support executing actions on multiple packages simultaneously:

```
Batch Install → Dependency Resolution → Parallel Download → Sequential Install → Result Report
```

Features:

- **Progress Tracking** — Independent progress bar for each package
- **Error Handling** — Single package failure doesn't affect others
- **Install History** — Records all install/uninstall operations

---

## Related Commands

| Command | Description |
|---------|-------------|
| `package_search` | Search packages |
| `package_info` | Get package details |
| `package_install` | Install a package |
| `package_uninstall` | Uninstall a package |
| `package_list` | List installed packages |
| `package_versions` | Get available versions |
| `package_check_installed` | Check if installed |
| `batch_install` | Batch install |
| `batch_uninstall` | Batch uninstall |
| `batch_update` | Batch update |
| `resolve_dependencies` | Resolve dependencies |
| `check_updates` | Check for updates |
| `package_pin` | Pin version |
| `package_rollback` | Rollback version |
| `advanced_search` | Advanced search |
| `compare_packages` | Compare packages |
