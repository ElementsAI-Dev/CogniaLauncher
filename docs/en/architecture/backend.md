# Backend Architecture

CogniaLauncher's backend is built with **Tauri 2.9** + **Rust**, providing native desktop capabilities and high-performance package management logic.

---

## Entry Point & Startup

### Startup Flow

```rust
// src/main.rs → src/lib.rs
fn main() {
    app_lib::run();
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| { /* Log initialization */ })
        .manage(Arc::new(RwLock::new(ProviderRegistry::new())))
        .manage(Arc::new(RwLock::new(Settings::default())))
        .invoke_handler(tauri::generate_handler![ /* 217+ commands */ ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
}
```

### Global State

| State | Type | Purpose |
|-------|------|---------|
| ProviderRegistry | `Arc<RwLock<ProviderRegistry>>` | Provider registry |
| Settings | `Arc<RwLock<Settings>>` | Application configuration |
| CancellationTokens | `Arc<RwLock<HashMap<...>>>` | Installation cancellation tokens |
| SharedTrayState | `Arc<RwLock<TrayState>>` | System tray state |
| CustomDetectionManager | `Arc<RwLock<...>>` | Custom detection rules |
| DownloadManager | `Arc<RwLock<...>>` | Download task management |

---

## Module Structure

```
src-tauri/src/
├── main.rs              # Entry point
├── lib.rs               # Tauri builder and command registration
├── error.rs             # Unified error type
├── commands/            # Tauri command layer (20 modules)
│   ├── mod.rs           # Module exports
│   ├── environment.rs   # Environment management commands
│   ├── package.rs       # Package management commands
│   ├── config.rs        # Configuration commands
│   ├── cache.rs         # Cache commands
│   ├── batch.rs         # Batch operation commands
│   ├── download.rs      # Download management commands
│   ├── search.rs        # Advanced search commands
│   ├── custom_detection.rs # Custom detection commands
│   ├── health_check.rs  # Health check commands
│   ├── profiles.rs      # Config snapshot commands
│   ├── launch.rs        # Program launch commands
│   ├── shim.rs          # Shim management commands
│   ├── log.rs           # Log commands
│   ├── wsl.rs           # WSL commands
│   ├── github.rs        # GitHub integration commands
│   ├── gitlab.rs        # GitLab integration commands
│   ├── manifest.rs      # Manifest file commands
│   ├── updater.rs       # Self-update commands
│   └── fs_utils.rs      # File system utility commands
├── provider/            # Provider implementations (54 files)
│   ├── mod.rs           # Provider trait definitions
│   ├── traits.rs        # Interface definitions (Provider/EnvironmentProvider/SystemPackageProvider)
│   ├── registry.rs      # Provider registration and discovery
│   ├── api.rs           # Package API client (npm/PyPI/crates.io)
│   ├── node_base.rs     # Node.js Provider shared utilities
│   ├── system.rs        # System environment detection (10 runtime types)
│   └── [45+ provider].rs # Concrete Provider implementations
├── core/                # Core business logic
│   ├── batch.rs         # Batch operation engine
│   ├── orchestrator.rs  # Installation orchestrator
│   ├── installer.rs     # Installer
│   ├── environment.rs   # Environment management
│   ├── custom_detection.rs # Custom version detection
│   ├── health_check.rs  # Health check engine
│   ├── profiles.rs      # Config snapshot management
│   ├── history.rs       # Installation history
│   └── shim.rs          # Shim management
├── cache/               # Cache system
├── config/              # Configuration management
├── platform/            # Platform abstraction
│   ├── disk.rs          # Disk operations and utility functions
│   ├── fs.rs            # File system operations
│   └── ...
├── resolver/            # Dependency resolution (PubGrub)
└── download/            # Download engine
    ├── manager.rs       # Download manager
    ├── task.rs          # Download task
    └── state.rs         # Download state
```

---

## Command Module Statistics

| Module | Commands | Main Functions |
|--------|----------|----------------|
| environment | 12 | Environment install/uninstall/version switching |
| package | 11 | Package search/install/management |
| batch | 10 | Batch operations/dependency resolution/version locking |
| download | 22 | Download queue/history/speed limiting |
| cache | 6 | Cache statistics/cleanup/repair |
| config | 6 | Configuration read/write |
| custom_detection | 10 | Custom detection rule management |
| search | 3 | Advanced search/suggestions/comparison |
| wsl | 21 | WSL management |
| Other | ~116 | Logs/GitHub/GitLab/updates, etc. |
| **Total** | **217+** | |

---

## Plugin System

Tauri plugin integrations:

- **tauri-plugin-log** — Logging (Stdout + WebView + file)
- **tauri-plugin-updater** — Application self-update
- **tauri-plugin-dialog** — Native dialogs
- **tauri-plugin-opener** — Open files with system programs
- **tauri-plugin-window-state** — Window state persistence
- **tauri-plugin-notification** — System notifications
- **tauri-plugin-autostart** — Auto-start on boot

---

## Error Handling

Uses a unified `CogniaResult<T>` type:

```rust
pub type CogniaResult<T> = Result<T, CogniaError>;
```

Errors are automatically serialized via Tauri IPC into a format the frontend can handle.
