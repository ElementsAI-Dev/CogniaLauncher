# Dart/Flutter Ecosystem Overview

## 1. Identity

- **What it is:** Dart/Flutter SDK version management and package management integrated into CogniaLauncher.
- **Purpose:** Manage Flutter SDK versions via FVM (Flutter Version Manager) and Dart packages via pub.dev API.

## 2. Key Features

- **FVM Version Management**: Install, switch, and pin Flutter SDK versions per-project
- **pub.dev Package Search**: Search, install, and manage Dart packages via the pub.dev API
- **Version Detection**: Detect pinned Flutter/Dart versions from `.fvmrc`, `pubspec.yaml`, `.dart-version`, `.tool-versions`, `mise.toml`
- **Project-level Pinning**: `.fvmrc` JSON format (`{"flutter": "3.19.0"}`) for per-project SDK pinning

## 3. Components

### Backend Providers

- `src-tauri/src/provider/fvm.rs` — FVM (Flutter Version Manager)
  - ID: `fvm`, Priority: 90
  - Capabilities: Install, Uninstall, List, Search
  - Parses `.fvmrc` JSON format and legacy `fvm_config.json`
  - Exports `parse_fvmrc()` for use by `project_env_detect.rs`
  - FVM commands: `fvm install`, `fvm use`, `fvm remove`, `fvm list`, `fvm releases`

- `src-tauri/src/provider/pub_dev.rs` — Dart Pub packages
  - ID: `pub_dev`, Priority: 70
  - Capabilities: Install, Uninstall, Search, List
  - Uses pub.dev REST API for search and package info
  - Package operations via `dart pub add/remove/get`

### Frontend

- Detection constants in `lib/constants/environments.ts`:
  - `dart` language entry with FVM as primary provider
  - Detection files: `pubspec.yaml (environment.sdk)`, `.fvmrc`, `.dart-version`, `.tool-versions`, `mise.toml`

### Version Detection (`project_env_detect.rs`)

| Source | Format | Parser |
|--------|--------|--------|
| `.fvmrc` | `{"flutter": "3.19.0"}` (JSON) | `fvm::parse_fvmrc()` |
| `pubspec.yaml` | `environment:\n  sdk: ">=3.0.0 <4.0.0"` (YAML) | `read_pubspec_sdk()` |
| `.dart-version` | Plain text version | `read_version_file()` |
| `.tool-versions` | `dart 3.3.0` or `flutter 3.19.0` | `read_tool_versions()` |
| `mise.toml` | `[tools]\ndart = "3.3.0"` | `read_mise_toml()` |

## 4. Related Documentation

- [Provider System Architecture](../architecture/provider-system.md)
- [Auto Version Detection](../reference/auto-version-detection.md)
