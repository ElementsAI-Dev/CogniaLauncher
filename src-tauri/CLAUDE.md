# CLAUDE.md - Tauri Backend Module

[Root](../CLAUDE.md) > **src-tauri**

> Last Updated: 2026-02-23 | v1.4.0
> Tauri 2.9 + Rust backend for CogniaLauncher

---

## Module Responsibility

This module contains the **Rust backend** for CogniaLauncher, running as a native desktop application via Tauri. It provides:

- **IPC Commands**: Exposed to frontend via Tauri's invoke system (260+ commands across 20 modules)
- **Core Logic**: Environment and package management operations (12 modules including profiles, health_check, custom_detection, eol, history, project_env_detect)
- **Provider System**: Extensible provider registry for package sources (48 providers)
- **Cache Management**: Download and metadata caching with SQLite
- **Platform Abstraction**: Cross-platform file system, process, and network operations
- **Dependency Resolution**: Version constraint resolution using PubGrub
- **Custom Detection**: User-configurable version detection rules with 9 extraction strategies
- **System Tray**: Multi-language tray with notifications and autostart
- **Profiles**: Environment configuration snapshot management
- **Health Check**: System and environment diagnostics

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
| `log_get_total_size` | Get total size of all log files |

### WSL Commands (`commands::wsl`) — Windows only

| Command | Purpose |
|---------|---------|
| `wsl_list_distros` | List installed WSL distributions |
| `wsl_list_online` | List available distributions from Microsoft |
| `wsl_status` | Get WSL status and kernel version |
| `wsl_terminate` | Terminate a specific distribution |
| `wsl_shutdown` | Shutdown all WSL distributions |
| `wsl_set_default` | Set default distribution |
| `wsl_set_version` | Set WSL version for a distribution |
| `wsl_set_default_version` | Set default WSL version |
| `wsl_export` | Export distribution to file |
| `wsl_import` | Import distribution from file |
| `wsl_import_in_place` | Import distribution in-place |
| `wsl_update` | Update WSL |
| `wsl_launch` | Launch a distribution |
| `wsl_list_running` | List running distributions |
| `wsl_is_available` | Check if WSL is available |
| `wsl_mount` | Mount a disk in WSL |
| `wsl_unmount` | Unmount a disk from WSL |
| `wsl_get_ip` | Get IP address of a distribution |
| `wsl_change_default_user` | Change default user for a distribution |
| `wsl_get_distro_config` | Get per-distro wsl.conf configuration |
| `wsl_set_distro_config` | Set per-distro wsl.conf values |

### GitHub Commands (`commands::github`)

| Command | Purpose |
|---------|---------|
| `github_get_releases` | Get releases for a GitHub repo |
| `github_get_release_assets` | Get assets for a specific release |
| `github_download_asset` | Download a release asset |
| `github_get_latest_release` | Get latest release info |
| `github_search_repos` | Search GitHub repositories |
| + 7 more | Asset matching, version comparison, etc. |

### GitLab Commands (`commands::gitlab`)

| Command | Purpose |
|---------|---------|
| `gitlab_get_releases` | Get releases for a GitLab project |
| `gitlab_get_release_assets` | Get assets for a specific release |
| `gitlab_download_asset` | Download a release asset |
| `gitlab_get_latest_release` | Get latest release info |
| `gitlab_search_projects` | Search GitLab projects |
| + 10 more | Instance management, authentication, etc. |

### Health Check Commands (`commands::health_check`)

| Command | Purpose |
|---------|---------|
| `health_check_environment` | Run health check on a specific environment |
| `health_check_system` | Run system-wide health check |
| `health_check_all` | Run health checks on all environments |
| `health_check_fix` | Apply fix for detected issue |

### Profiles Commands (`commands::profiles`)

| Command | Purpose |
|---------|---------|
| `profile_list` | List all saved profiles |
| `profile_get` | Get a specific profile |
| `profile_create` | Create profile from current environment state |
| `profile_apply` | Apply a profile (switch versions) |
| `profile_delete` | Delete a profile |
| `profile_update` | Update an existing profile |
| `profile_export` | Export profile to file |
| `profile_import` | Import profile from file |
| `profile_duplicate` | Duplicate an existing profile |

### Launch Commands (`commands::launch`)

| Command | Purpose |
|---------|---------|
| `launch_with_env` | Launch program with environment modifications |
| `launch_with_streaming` | Launch with streaming output |
| `env_activate` | Get activation script for an environment |
| `env_get_info` | Get environment info (paths, versions) |
| `exec_shell_with_env` | Execute shell command with environment |
| `which_program` | Find program location in PATH |

### Shim/PATH Commands (`commands::shim`)

| Command | Purpose |
|---------|---------|
| `shim_create` | Create a shim for an executable |
| `shim_remove` | Remove a shim |
| `shim_list` | List all created shims |
| `shim_update` | Update a shim's target |
| `shim_regenerate_all` | Regenerate all shims |
| `path_status` | Get PATH configuration status |
| `path_setup` | Add paths to system PATH |
| `path_remove` | Remove paths from system PATH |
| `path_check` | Check if a path is in PATH |
| `path_get_add_command` | Get shell command to add path |

### Manifest Commands (`commands::manifest`)

| Command | Purpose |
|---------|---------|
| `manifest_read` | Read project manifest (package.json, Cargo.toml, etc.) |
| `manifest_detect` | Detect project type and manifest file |

### FS Utils Commands (`commands::fs_utils`)

| Command | Purpose |
|---------|---------|
| `fs_read_text_file` | Read a text file safely |

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
- `batch.rs` - Batch operations (with PackageSpec parsing)
- `shim.rs` - Shim creation for executables
- `custom_detection.rs` - Custom version detection rules
- `health_check.rs` - Environment and system health diagnostics
- `profiles.rs` - Environment configuration snapshot management
- `history.rs` - Installation history tracking
- `eol.rs` - End-of-life version tracking
- `project_env_detect.rs` - Project-level environment detection

### provider/ - Package Providers

**Purpose:** Implementations of package and environment providers

**Available Providers (48 total):**

**Environment Managers (version switching):**

| Provider | Platform | Description |
|----------|----------|-------------|
| `nvm` | Cross | Node.js version management |
| `fnm` | Cross | Fast Node.js manager (Rust) |
| `volta` | Cross | Hassle-free JavaScript tool manager |
| `pyenv` | Cross | Python version management |
| `rustup` | Cross | Rust toolchain management |
| `rbenv` | Cross | Ruby version management |
| `sdkman` | Cross | SDKMAN for Java/Kotlin/Gradle/Maven/Scala |
| `goenv` | Cross | Go version management (+ GoModProvider) |
| `phpbrew` | Cross | PHP version management |
| `deno` | Cross | Deno runtime management |
| `asdf` | Cross | Polyglot version manager |
| `mise` | Cross | Polyglot version manager (successor to rtx/asdf) |

**Language Package Managers:**

| Provider | Platform | Description |
|----------|----------|-------------|
| `npm` | Cross | Node.js packages |
| `pnpm` | Cross | Fast Node.js package manager |
| `yarn` | Cross | Node.js package manager |
| `bun` | Cross | Bun JavaScript runtime & package manager |
| `pip` | Cross | Python packages |
| `uv` | Cross | Fast Python package installer |
| `poetry` | Cross | Python dependency management |
| `pipx` | Cross | Isolated Python CLI tools |
| `conda` | Cross | Conda/Mamba data science packages |
| `cargo` | Cross | Rust packages |
| `gem` | Cross | RubyGems packages |
| `bundler` | Cross | Ruby dependency management |
| `composer` | Cross | PHP packages |
| `dotnet` | Cross | .NET packages (NuGet) |

**System Package Managers:**

| Provider | Platform | Description |
|----------|----------|-------------|
| `brew` | macOS | Homebrew package manager |
| `macports` | macOS | MacPorts package manager |
| `apt` | Linux | Debian/Ubuntu packages |
| `dnf` | Linux | Fedora packages |
| `pacman` | Linux | Arch packages |
| `zypper` | Linux | openSUSE packages |
| `apk` | Linux | Alpine packages |
| `snap` | Linux | Universal Linux packages |
| `flatpak` | Linux | Desktop application framework |
| `nix` | Linux/macOS | Nix package manager |
| `winget` | Windows | Windows package manager |
| `chocolatey` | Windows | Windows package manager |
| `scoop` | Windows | Windows package manager |

**C/C++ Package Managers:**

| Provider | Platform | Description |
|----------|----------|-------------|
| `vcpkg` | Cross | Microsoft C++ package manager |
| `conan` | Cross | Conan 2.x C/C++ package manager |
| `xmake` | Cross | Xmake/Xrepo C/C++ package manager |

**Other Providers:**

| Provider | Platform | Description |
|----------|----------|-------------|
| `docker` | Cross | Container images |
| `podman` | Cross | Podman container images |
| `github` | Cross | GitHub Releases |
| `gitlab` | Cross | GitLab Releases |
| `psgallery` | Windows | PowerShell Gallery |
| `wsl` | Windows | Windows Subsystem for Linux |
| `system` | Cross | System-installed runtime detection |

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

270+ Rust unit tests across provider files. Tests cover output parsing, version detection, and provider metadata.

```bash
cargo test              # Run all tests
cargo test winget       # Run tests for a specific provider
cargo test -- --nocapture  # Run with stdout output
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
│   ├── lib.rs               # Tauri builder, command registration (260+ commands)
│   ├── error.rs             # Error types (CogniaError)
│   ├── tray.rs              # System tray (multi-language, notifications, autostart)
│   ├── commands/            # Tauri command handlers (20 modules)
│   │   ├── mod.rs
│   │   ├── environment.rs   # 36 env commands (install, detect, alias, etc.)
│   │   ├── package.rs       # 13 package commands
│   │   ├── config.rs        # 9 config commands
│   │   ├── cache.rs         # 32 cache commands
│   │   ├── batch.rs         # 12 batch commands
│   │   ├── download.rs      # 32 download commands
│   │   ├── wsl.rs           # 26 WSL commands (Windows only)
│   │   ├── custom_detection.rs # 16 custom detection commands
│   │   ├── gitlab.rs        # 15 GitLab commands
│   │   ├── github.rs        # 12 GitHub commands
│   │   ├── shim.rs          # 10 shim/PATH commands
│   │   ├── profiles.rs      # 9 profile commands
│   │   ├── launch.rs        # 6 launch/exec commands
│   │   ├── log.rs           # 6 log commands
│   │   ├── health_check.rs  # 4 health check commands
│   │   ├── search.rs        # 3 search commands
│   │   ├── updater.rs       # 2 self-update commands
│   │   ├── manifest.rs      # 2 manifest commands
│   │   └── fs_utils.rs      # 1 fs utility command
│   ├── core/                # Core business logic (12 modules)
│   │   ├── mod.rs
│   │   ├── environment.rs   # Environment version management
│   │   ├── installer.rs     # Package installation logic
│   │   ├── orchestrator.rs  # Operation orchestration
│   │   ├── batch.rs         # Batch operations + PackageSpec parsing
│   │   ├── shim.rs          # Shim creation for executables
│   │   ├── custom_detection.rs # Custom version detection rules
│   │   ├── health_check.rs  # Environment and system diagnostics
│   │   ├── profiles.rs      # Configuration snapshot management
│   │   ├── history.rs       # Installation history tracking
│   │   ├── eol.rs           # End-of-life version tracking
│   │   └── project_env_detect.rs # Project-level environment detection
│   ├── provider/            # Provider implementations (48 + 6 infra)
│   │   ├── mod.rs           # Module exports
│   │   ├── traits.rs        # Provider/EnvironmentProvider/SystemPackageProvider traits
│   │   ├── api.rs           # PackageApiClient (PyPI/npm/crates.io mirrors)
│   │   ├── registry.rs      # Platform-aware provider registration
│   │   ├── node_base.rs     # Shared Node.js utilities + split_name_version
│   │   ├── system.rs        # System runtime detection (11 types)
│   │   └── ... (48 provider .rs files)
│   ├── cache/               # Cache management (10 modules)
│   │   ├── mod.rs
│   │   ├── db.rs            # Legacy database
│   │   ├── sqlite_db.rs     # SQLite database operations
│   │   ├── download.rs      # Download caching
│   │   ├── download_history.rs # Download history persistence
│   │   ├── metadata.rs      # Metadata caching
│   │   ├── enhanced.rs      # Enhanced cache features
│   │   ├── history.rs       # Cleanup history tracking
│   │   ├── external.rs      # External cache management
│   │   └── migration.rs     # Cache migration utilities
│   ├── config/              # Configuration
│   │   ├── mod.rs
│   │   ├── settings.rs      # Settings management
│   │   ├── manifest.rs      # Project manifests
│   │   └── lockfile.rs      # Dependency lockfiles
│   ├── download/            # Download management
│   │   ├── mod.rs
│   │   ├── manager.rs       # DownloadManager coordinator
│   │   ├── queue.rs         # Concurrency control
│   │   ├── task.rs          # State machine (queued→downloading→completed)
│   │   ├── throttle.rs      # Token bucket speed limiter
│   │   ├── state.rs         # Error types and state transitions
│   │   └── asset_picker.rs  # Platform-aware asset selection
│   ├── platform/            # Platform abstraction (7 modules)
│   │   ├── mod.rs
│   │   ├── fs.rs            # File system operations
│   │   ├── process.rs       # Process execution
│   │   ├── network.rs       # Network operations
│   │   ├── env.rs           # Environment variables
│   │   ├── disk.rs          # Disk space + format_size/format_duration
│   │   └── paths.rs         # Platform-specific paths
│   └── resolver/            # Dependency resolution
│       ├── mod.rs
│       ├── pubgrub.rs       # PubGrub algorithm
│       ├── constraint.rs    # Version constraints
│       └── version.rs       # Version parsing and comparison
├── Cargo.toml               # Rust dependencies
├── Cargo.lock               # Lock file
├── build.rs                 # Build script
├── tauri.conf.json          # Tauri configuration
├── CLAUDE.md                # This file
├── capabilities/            # Tauri capability permissions
│   └── default.json
└── icons/                   # App icons
```

---

## Related Documentation

- [Provider System Spec](../openspec/specs/provider-system/spec.md)
- [Platform Abstraction Spec](../openspec/specs/platform-abstraction/spec.md)
- [Package Installation Spec](../openspec/specs/package-installation/spec.md)
- [Dependency Resolution Spec](../openspec/specs/dependency-resolution/spec.md)
