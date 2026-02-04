# CLAUDE.md - Tauri Backend Module

[Root](../CLAUDE.md) > **src-tauri**

> Last Updated: 2026-02-04
> Tauri 2.9 + Rust backend for CogniaLauncher

---

## Module Responsibility

This module contains the **Rust backend** for CogniaLauncher, running as a native desktop application via Tauri. It provides:

- **IPC Commands**: Exposed to frontend via Tauri's invoke system (120+ commands)
- **Core Logic**: Environment and package management operations
- **Provider System**: Extensible provider registry for package sources (32+ providers)
- **Cache Management**: Download and metadata caching with SQLite
- **Platform Abstraction**: Cross-platform file system, process, and network operations
- **Dependency Resolution**: Version constraint resolution using PubGrub
- **Custom Detection**: User-configurable version detection rules
- **System Tray**: Multi-language tray with notifications and autostart

---

## Entry & Startup

### Main Entry Points

| File | Purpose |
|------|---------|
| `src/main.rs` | Application entry point (minimal) |
| `src/lib.rs` | Library setup, Tauri builder, command registration |

### Initialization Flow

```rust
// src/main.rs
fn main() {
    app_lib::run();
}

// src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .setup(|app| { /* logging setup */ })
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())))
        .manage(Arc::new(RwLock::new(Settings::default())))
        .invoke_handler(tauri::generate_handler![ /* commands */ ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Global State

- **ProviderRegistry**: `Arc<RwLock<ProviderRegistry>>` - Available package providers
- **Settings**: `Arc<RwLock<Settings>>` - Application configuration
- **CancellationTokens**: `Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>` - Installation cancellation tokens
- **SharedTrayState**: `Arc<RwLock<TrayState>>` - System tray state (icon, language, downloads, autostart)
- **SharedCustomDetectionManager**: `Arc<RwLock<CustomDetectionManager>>` - Custom version detection rules

---

## Tauri Commands (IPC Interface)

All commands are registered in `src/lib.rs` and organized by module.

### Environment Commands (`commands::environment`)

| Command | Purpose |
|---------|---------|
| `env_list` | List all environment types |
| `env_get` | Get details for an environment |
| `env_install` | Install a runtime version with progress events |
| `env_uninstall` | Uninstall a runtime version |
| `env_use_global` | Set global version |
| `env_use_local` | Set local (project) version |
| `env_detect` | Detect installed versions |
| `env_detect_all` | Detect all environments |
| `env_available_versions` | Get available versions for an environment |
| `env_list_providers` | List environment providers |
| `env_resolve_alias` | Resolve version alias (lts, latest, stable) to actual version |
| `env_install_cancel` | Cancel an ongoing environment installation |

**Progress Events:**
- `env-install-progress`: Emitted during installation with steps (fetching, downloading, extracting, configuring, done, error)

### Package Commands (`commands::package`)

| Command | Purpose |
|---------|---------|
| `package_search` | Search for packages |
| `package_info` | Get package details |
| `package_install` | Install a package |
| `package_uninstall` | Uninstall a package |
| `package_list` | List installed packages |
| `provider_list` | List available providers |
| `provider_check` | Check if provider is available |
| `provider_system_list` | List system package managers |
| `provider_status_all` | Status of all providers |
| `package_check_installed` | Check if package is installed |
| `package_versions` | Get available versions |

### Config Commands (`commands::config`)

| Command | Purpose |
|---------|---------|
| `config_get` | Get configuration value |
| `config_set` | Set configuration value |
| `config_list` | List all configuration |
| `config_reset` | Reset configuration to default |
| `get_cognia_dir` | Get Cognia data directory |
| `get_platform_info` | Get platform information |

### Cache Commands (`commands::cache`)

| Command | Purpose |
|---------|---------|
| `cache_info` | Get cache statistics |
| `cache_clean` | Clean cache |
| `cache_verify` | Verify cache integrity |
| `cache_repair` | Repair cache |
| `get_cache_settings` | Get cache settings |
| `set_cache_settings` | Update cache settings |

### Batch Commands (`commands::batch`)

| Command | Purpose |
|---------|---------|
| `batch_install` | Install multiple packages |
| `batch_uninstall` | Uninstall multiple packages |
| `batch_update` | Update multiple packages |
| `resolve_dependencies` | Resolve package dependencies |
| `check_updates` | Check for package updates |
| `package_pin` | Pin package version |
| `package_unpin` | Unpin package version |
| `get_pinned_packages` | List pinned packages |
| `package_rollback` | Rollback package version |
| `get_install_history` | Get installation history |

### Download Commands (`commands::download`)

| Command | Purpose |
|---------|---------|
| `download_add` | Add new download task |
| `download_list` | List active downloads |
| `download_get` | Get specific download details |
| `download_pause` | Pause a download |
| `download_resume` | Resume paused download |
| `download_cancel` | Cancel a download |
| `download_remove` | Remove download from list |
| `download_pause_all` | Pause all downloads |
| `download_resume_all` | Resume all downloads |
| `download_cancel_all` | Cancel all downloads |
| `download_retry_failed` | Retry failed downloads |
| `download_clear_finished` | Clear completed downloads |
| `download_stats` | Get download statistics |
| `download_set_speed_limit` | Set speed limit (KB/s) |
| `download_get_speed_limit` | Get current speed limit |
| `download_set_max_concurrent` | Set max concurrent downloads |
| `download_history_list` | List download history |
| `download_history_search` | Search download history |
| `download_history_remove` | Remove entry from history |
| `download_history_clear` | Clear download history |
| `download_history_stats` | Get download history statistics |
| `disk_space_check` | Check available disk space |
| `disk_space_get` | Get disk space information |

### Search Commands (`commands::search`)

| Command | Purpose |
|---------|---------|
| `advanced_search` | Advanced package search with filters |
| `search_suggestions` | Get search suggestions |
| `compare_packages` | Compare multiple packages |

### Updater Commands (`commands::updater`)

| Command | Purpose |
|---------|---------|
| `self_check_update` | Check for application updates |
| `self_update` | Install available update |

### Custom Detection Commands (`commands::custom_detection`)

| Command | Purpose |
|---------|---------|
| `custom_rule_list` | List all custom detection rules |
| `custom_rule_get` | Get specific rule by ID |
| `custom_rule_add` | Add new detection rule |
| `custom_rule_update` | Update existing rule |
| `custom_rule_delete` | Delete a rule |
| `custom_rule_toggle` | Enable/disable rule |
| `custom_rule_presets` | Get built-in preset rules |
| `custom_rule_import_presets` | Import preset rules |
| `custom_rule_detect` | Detect version using custom rules |
| `custom_rule_detect_all` | Detect all versions in directory |
| `custom_rule_test` | Test rule against file |
| `custom_rule_validate_regex` | Validate regex pattern |
| `custom_rule_export` | Export rules to JSON |
| `custom_rule_import` | Import rules from JSON |
| `custom_rule_list_by_env` | Get rules for environment type |
| `custom_rule_extraction_types` | Get supported extraction strategies |

### System Tray Commands (`tray.rs`)

| Command | Purpose |
|---------|---------|
| `tray_set_icon_state` | Set tray icon state (normal, downloading, update, error) |
| `tray_update_tooltip` | Update tray tooltip text |
| `tray_set_active_downloads` | Set active download count |
| `tray_set_has_update` | Set update availability flag |
| `tray_set_language` | Set tray menu language (en/zh) |
| `tray_set_click_behavior` | Set left-click behavior |
| `tray_get_state` | Get current tray state |
| `tray_is_autostart_enabled` | Check if autostart is enabled |
| `tray_enable_autostart` | Enable application autostart |
| `tray_disable_autostart` | Disable application autostart |
| `tray_send_notification` | Send system notification |
| `tray_rebuild` | Rebuild tray menu |

### Log Commands (`commands::log`)

| Command | Purpose |
|---------|---------|
| `log_list_files` | List all log files |
| `log_query` | Query log entries with filters |
| `log_export` | Export logs to file |
| `log_clear` | Clear log files |
| `log_get_dir` | Get log directory path |

---

## Core Modules

### commands/ - Tauri Command Handlers

**Purpose:** Implement Tauri commands exposed to frontend

**Structure:**
- Each file in `commands/` exports multiple commands
- Commands use `#[tauri::command]` attribute
- Return `Result<T, E>` where E implements `serde::Serialize`

**Example:**

```rust
// commands/package.rs
#[tauri::command]
pub async fn package_search(
    query: String,
    provider: Option<String>,
    state: State<'_, Arc<RwLock<ProviderRegistry>>>,
) -> Result<Vec<PackageSummary>, String> {
    // Implementation
}
```

### core/ - Core Business Logic

**Purpose:** Core environment and package management logic

**Modules:**
- `environment.rs` - Environment version management
- `installer.rs` - Package installation logic
- `orchestrator.rs` - Operation orchestration
- `batch.rs` - Batch operations
- `shim.rs` - Shim creation for executables
- `custom_detection.rs` - Custom version detection rules (17 commands)

### provider/ - Package Providers

**Purpose:** Implementations of package and environment providers

**Available Providers:**

| Provider | Type | Platform | Description |
|----------|------|----------|-------------|
| `nvm` | Environment | Cross | Node.js version management |
| `fnm` | Environment | Cross | Fast Node.js manager |
| `pyenv` | Environment | Cross | Python version management |
| `rustup` | Environment | Cross | Rust toolchain management |
| `rbenv` | Environment | Cross | Ruby version management |
| `sdkman` | Environment | Cross | SDKMAN for JVM |
| `goenv` | Environment | Cross | Go version management |
| `npm` | Package | Cross | Node.js packages |
| `pnpm` | Package | Cross | Fast Node.js package manager |
| `yarn` | Package | Cross | Node.js package manager |
| `pip` | Package | Cross | Python packages |
| `uv` | Package | Cross | Fast Python package installer |
| `cargo` | Package | Cross | Rust packages |
| `brew` | Package | macOS | macOS package manager |
| `apt` | Package | Linux | Debian/Ubuntu packages |
| `dnf` | Package | Linux | Fedora packages |
| `pacman` | Package | Linux | Arch packages |
| `zypper` | Package | Linux | openSUSE packages |
| `snap` | Package | Linux | Universal Linux packages |
| `flatpak` | Package | Linux | Desktop application framework |
| `winget` | Package | Windows | Windows package manager |
| `chocolatey` | Package | Windows | Windows package manager |
| `scoop` | Package | Windows | Windows package manager |
| `vcpkg` | Package | Cross | C++ package manager |
| `docker` | Package | Cross | Container images |
| `github` | Package | Cross | GitHub Releases |
| `registry` | Package | Cross | Language package registries |
| `psgallery` | Package | Windows | PowerShell Gallery |

**Provider Traits:**

```rust
// provider/traits.rs
#[async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn capabilities(&self) -> ProviderCapabilities;
    async fn is_available(&self) -> bool;
    async fn search(&self, query: &str) -> Result<Vec<PackageSummary>>;
    async fn install(&self, package: &PackageInstall) -> Result<InstallResult>;
    async fn uninstall(&self, package: &PackageRef) -> Result<()>;
    async fn list_installed(&self) -> Result<Vec<InstalledPackage>>;
}

#[async_trait]
pub trait EnvironmentProvider: Provider {
    async fn list_versions(&self) -> Result<Vec<Version>>;
    async fn current_version(&self) -> Result<Option<Version>>;
    async fn set_global_version(&self, version: &Version) -> Result<()>;
    async fn set_local_version(&self, version: &Version, path: &Path) -> Result<()>;
    async fn get_env_modifications(&self, version: &Version) -> Result<EnvModifications>;
}
```

### cache/ - Cache Management

**Purpose:** Download and metadata caching with SQLite backend

**Modules:**
- `mod.rs` - Cache manager
- `download.rs` - Download caching
- `metadata.rs` - Metadata caching
- `db.rs` - SQLite database operations
- `enhanced.rs` - Enhanced cache features

### config/ - Configuration

**Purpose:** Application configuration and settings

**Modules:**
- `mod.rs` - Configuration types
- `settings.rs` - Settings management
- `manifest.rs` - Project manifests
- `lockfile.rs` - Dependency lockfiles

### platform/ - Platform Abstraction

**Purpose:** Cross-platform OS abstraction

**Modules:**
- `mod.rs` - Platform types
- `fs.rs` - File system operations
- `process.rs` - Process execution
- `network.rs` - Network operations
- `env.rs` - Environment variables

### resolver/ - Dependency Resolution

**Purpose:** Version constraint resolution

**Modules:**
- `mod.rs` - Resolution orchestrator
- `pubgrub.rs` - PubGrub algorithm implementation
- `constraint.rs` - Version constraints
- `version.rs` - Version parsing and comparison

---

## Key Dependencies

### Cargo.toml Dependencies

```toml
[dependencies]
# Tauri
tauri = "2.9"
tauri-plugin-log = "2"
tauri-plugin-updater = "2"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde_yaml = "0.9"
toml = "0.8"

# Async runtime
tokio = { version = "1.45", features = ["full"] }

# HTTP client
reqwest = { version = "0.12", features = ["json", "stream"] }

# Database
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }

# Version parsing
semver = { version = "1.0", features = ["serde"] }

# Error handling
thiserror = "2.0"
anyhow = "1.0"

# Crypto/checksums
sha2 = "0.10"
hex = "0.4"

# Cross-platform paths
directories = "6.0"

# Utilities
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.0", features = ["v4", "serde"] }
```

---

## Error Handling

Uses `thiserror` for structured errors:

```rust
// error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CogniaError {
    #[error("Provider not available: {0}")]
    ProviderUnavailable(String),

    #[error("Package not found: {0}")]
    PackageNotFound(String),

    #[error("Installation failed: {0}")]
    InstallationFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
}
```

---

## Configuration

### Tauri Configuration

**File:** `tauri.conf.json`

```json
{
  "productName": "CogniaLauncher",
  "version": "0.1.0",
  "identifier": "com.cognia.launcher",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "plugins": {
    "updater": {
      "pubkey": "",
      "endpoints": []
    }
  }
}
```

The `plugins.updater` section enables the Tauri updater plugin. Currently configured with empty `pubkey` and `endpoints` for manual update server setup.

**File:** `capabilities/default.json`

Defines permissions including `updater:default` for self-update functionality.

### Build Configuration

**File:** `build.rs` - Tauri build script (standard)

---

## Testing

### Current Status

No Rust unit tests are currently configured.

### Recommendation

Add test infrastructure:

```rust
// Example test structure
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provider_search() {
        // Test implementation
    }
}
```

### Quality Tools

- **rustfmt**: Code formatting
- **clippy**: Linting (recommended)

---

## Build & Development

### Development Commands

```bash
# Tauri dev mode
pnpm tauri dev

# Check Rust code
cargo check

# Format code
cargo fmt

# Run linter
cargo clippy

# Run tests
cargo test
```

### Build Output

- **Debug**: `src-tauri/target/debug/`
- **Release**: `src-tauri/target/release/`
- **Bundles**: `src-tauri/target/release/bundle/`

---

## Common Patterns

### Adding a New Command

1. Create handler in `src/commands/{module}.rs`:

```rust
#[tauri::command]
pub async fn my_command(
    param: String,
    state: State<'_, Arc<RwLock<ProviderRegistry>>>,
) -> Result<Response, String> {
    // Implementation
}
```

2. Export from `src/commands/mod.rs`:

```rust
pub use my_module::my_command;
```

3. Register in `src/lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_command,
])
```

4. Add TypeScript types in frontend `lib/tauri.ts`

### Adding a New Provider

1. Implement traits in `src/provider/{name}.rs`:

```rust
pub struct MyProvider;

#[async_trait]
impl Provider for MyProvider {
    fn id(&self) -> &'static str { "my-provider" }
    // ... implement required methods
}
```

2. Register in `src/provider/mod.rs` and `src/lib.rs`

---

## File Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri builder, command registration
│   ├── error.rs             # Error types
│   ├── commands/            # Tauri command handlers
│   │   ├── mod.rs
│   │   ├── environment.rs
│   │   ├── package.rs
│   │   ├── config.rs
│   │   ├── cache.rs
│   │   ├── batch.rs
│   │   ├── search.rs
│   │   ├── updater.rs
│   │   ├── custom_detection.rs
│   │   ├── download.rs
│   │   ├── log.rs
│   │   ├── launch.rs
│   │   ├── manifest.rs
│   │   └── shim.rs
│   ├── core/                # Core business logic
│   │   ├── mod.rs
│   │   ├── environment.rs
│   │   ├── installer.rs
│   │   ├── orchestrator.rs
│   │   ├── batch.rs
│   │   ├── shim.rs
│   │   └── custom_detection.rs
│   ├── provider/            # Provider implementations
│   │   ├── mod.rs
│   │   ├── traits.rs
│   │   ├── api.rs
│   │   ├── registry.rs
│   │   ├── npm.rs
│   │   ├── brew.rs
│   │   └── ... (35+ providers)
│   ├── cache/               # Cache management
│   │   ├── mod.rs
│   │   ├── download.rs
│   │   ├── metadata.rs
│   │   ├── db.rs
│   │   └── enhanced.rs
│   ├── config/              # Configuration
│   │   ├── mod.rs
│   │   ├── settings.rs
│   │   ├── manifest.rs
│   │   └── lockfile.rs
│   ├── download/            # Download management
│   │   ├── mod.rs
│   │   ├── manager.rs
│   │   ├── queue.rs
│   │   ├── task.rs
│   │   ├── throttle.rs
│   │   └── state.rs
│   ├── platform/            # Platform abstraction
│   │   ├── mod.rs
│   │   ├── fs.rs
│   │   ├── process.rs
│   │   ├── network.rs
│   │   └── env.rs
│   ├── resolver/            # Dependency resolution
│   │   ├── mod.rs
│   │   ├── pubgrub.rs
│   │   ├── constraint.rs
│   │   └── version.rs
│   └── tray.rs              # System tray implementation
├── Cargo.toml               # Rust dependencies
├── Cargo.lock               # Lock file
├── build.rs                 # Build script
├── tauri.conf.json          # Tauri configuration
└── icons/                   # App icons
```

---

## Related Documentation

- [Provider System Spec](../openspec/specs/provider-system/spec.md)
- [Platform Abstraction Spec](../openspec/specs/platform-abstraction/spec.md)
- [Package Installation Spec](../openspec/specs/package-installation/spec.md)
- [Dependency Resolution Spec](../openspec/specs/dependency-resolution/spec.md)
