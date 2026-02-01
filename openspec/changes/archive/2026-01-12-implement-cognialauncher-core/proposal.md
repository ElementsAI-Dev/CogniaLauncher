# Change: Implement CogniaLauncher Core System

## Why

The project currently has only a starter template structure. Based on the comprehensive software design document (`docs/index.md`), we need to implement the full CogniaLauncher system - a unified environment and package manager that provides:
- Unified CLI/GUI interface for managing multiple runtime environments (Node.js, Python, Rust)
- Cross-platform package management (apt, brew, winget, GitHub releases)
- Dependency resolution with conflict detection
- Environment isolation and version switching

## What Changes

### New Capabilities

1. **Platform Abstraction Layer** (Rust)
   - Cross-platform file system operations
   - Process management and execution
   - Network operations with retry logic
   - Environment variable management

2. **Provider System** (Rust)
   - Provider trait and registry
   - Environment providers: nvm, pyenv, rustup
   - System package providers: apt, brew, winget
   - Custom source provider: GitHub releases

3. **Environment Management** (Rust)
   - Version detection and switching
   - Shim mechanism for transparent version routing
   - Project-local and global version management

4. **Package Installation** (Rust)
   - Download with progress and resume support
   - Checksum verification
   - Atomic installation with rollback
   - Transaction-based state management

5. **Dependency Resolution** (Rust)
   - PubGrub-based SAT solver
   - Version constraint parsing (semver)
   - Conflict detection and explanation

6. **Configuration System** (Rust)
   - TOML config parsing (`~/.CogniaLauncher/config/`)
   - YAML manifest parsing (`CogniaLauncher.yaml`)
   - Lockfile management (`CogniaLauncher-lock.yaml`)

7. **UI Interface** (React + Tauri)
   - Dashboard with installed environments overview
   - Package search and installation UI
   - Environment version switcher
   - Configuration management UI

8. **Cache Management** (Rust)
   - Download cache with content-addressed storage
   - Metadata cache with TTL
   - SQLite index for cache entries

## Impact

- **Affected specs**: Creates 8 new capability specs
- **Affected code**:
  - `src-tauri/src/` - All Rust backend modules
  - `app/` - React frontend pages
  - `components/` - UI components
  - `lib/` - Shared utilities and Zustand stores
- **Breaking changes**: None (greenfield implementation)
- **Dependencies**: 
  - Rust: tokio, serde, reqwest, sqlx, semver, pubgrub
  - React: zustand, @tanstack/react-query, lucide-react
