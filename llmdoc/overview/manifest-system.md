# Project Manifest System Overview

## 1. Identity

- **What it is:** Project manifest reading and initialization for CogniaLauncher.
- **Purpose:** Read project metadata from standard manifest files (package.json, Cargo.toml, pyproject.toml, etc.) and initialize `cognia.toml` project-specific configuration.

## 2. Key Features

- **Manifest Reading**: Parse project metadata from standard manifest files across all supported languages
- **cognia.toml Initialization**: Create a new `cognia.toml` file for project-specific Cognia configuration
- **Multi-format Support**: JSON (package.json), TOML (Cargo.toml, pyproject.toml), YAML (pubspec.yaml), XML (pom.xml), and more

## 3. Components

### Backend

- `src-tauri/src/config/manifest.rs` — Manifest parsing and initialization logic
- `src-tauri/src/commands/manifest.rs` — 2 Tauri commands

### Commands

| Command | Purpose |
|---------|---------|
| `manifest_read` | Read project manifest from standard files (package.json, Cargo.toml, etc.) |
| `manifest_init` | Initialize a new `cognia.toml` manifest file in a project directory |

### Supported Manifest Files

| File | Language/Ecosystem | Fields Extracted |
|------|-------------------|-----------------|
| `package.json` | Node.js | name, version, description, dependencies |
| `Cargo.toml` | Rust | name, version, edition, rust-version |
| `pyproject.toml` | Python | name, version, requires-python |
| `go.mod` | Go | module, go version, toolchain |
| `pubspec.yaml` | Dart/Flutter | name, version, environment.sdk |
| `pom.xml` | Java/Maven | groupId, artifactId, version |
| `build.gradle` | Java/Kotlin/Gradle | plugins, dependencies |
| `Gemfile` | Ruby | ruby version, dependencies |
| `composer.json` | PHP | name, require.php |
| `global.json` | .NET | sdk.version |

## 4. cognia.toml Format

```toml
[project]
name = "my-project"
version = "1.0.0"

[environments]
node = "20.11.0"
python = "3.12.0"

[providers]
node = "fnm"
python = "pyenv"
```

## 5. Related Documentation

- [Project Environment Detection](../architecture/project-env-detect.md)
- [Settings System](../architecture/settings-system.md)
