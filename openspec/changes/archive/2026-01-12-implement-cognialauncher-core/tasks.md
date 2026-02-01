# Tasks: Implement CogniaLauncher Core System

## 1. Platform Abstraction Layer (Rust)

- [ ] 1.1 Create `src-tauri/src/platform/mod.rs` with module exports
- [ ] 1.2 Implement `platform/fs.rs` - file system operations (read, write, copy, symlink, atomic rename)
- [ ] 1.3 Implement `platform/process.rs` - process spawning and output capture
- [ ] 1.4 Implement `platform/network.rs` - HTTP client with retry, progress, resume support
- [ ] 1.5 Implement `platform/env.rs` - environment variable management
- [ ] 1.6 Add unit tests for platform module

## 2. Configuration System (Rust)

- [ ] 2.1 Create `src-tauri/src/config/mod.rs` with module exports
- [ ] 2.2 Implement `config/settings.rs` - TOML config parsing for `~/.CogniaLauncher/config/config.toml`
- [ ] 2.3 Implement `config/manifest.rs` - YAML manifest parsing for `CogniaLauncher.yaml`
- [ ] 2.4 Implement `config/lockfile.rs` - lockfile read/write for `CogniaLauncher-lock.yaml`
- [ ] 2.5 Add Tauri commands: `get_config`, `set_config`, `list_config`
- [ ] 2.6 Add unit tests for config module

## 3. Cache System (Rust)

- [ ] 3.1 Create `src-tauri/src/cache/mod.rs` with module exports
- [ ] 3.2 Implement `cache/db.rs` - SQLite database schema and operations
- [ ] 3.3 Implement `cache/download.rs` - content-addressed download cache
- [ ] 3.4 Implement `cache/metadata.rs` - metadata cache with TTL
- [ ] 3.5 Add Tauri commands: `cache_clean`, `cache_info`
- [ ] 3.6 Add unit tests for cache module

## 4. Provider System (Rust)

- [ ] 4.1 Create `src-tauri/src/provider/mod.rs` with module exports
- [ ] 4.2 Define `provider/traits.rs` - Provider, EnvironmentProvider, SystemPackageProvider traits
- [ ] 4.3 Implement `provider/registry.rs` - provider registration and lookup
- [ ] 4.4 Implement `provider/nvm.rs` - Node.js version manager provider
- [ ] 4.5 Implement `provider/pyenv.rs` - Python version manager provider
- [ ] 4.6 Implement `provider/rustup.rs` - Rust toolchain provider
- [ ] 4.7 Implement `provider/github.rs` - GitHub releases provider
- [ ] 4.8 Implement `provider/apt.rs` - apt package manager (Linux)
- [ ] 4.9 Implement `provider/brew.rs` - Homebrew package manager (macOS)
- [ ] 4.10 Implement `provider/winget.rs` - winget package manager (Windows)
- [ ] 4.11 Add integration tests for providers

## 5. Dependency Resolution (Rust)

- [ ] 5.1 Create `src-tauri/src/resolver/mod.rs` with module exports
- [ ] 5.2 Implement `resolver/version.rs` - semver parsing and comparison
- [ ] 5.3 Implement `resolver/constraint.rs` - version constraint types (exact, range, caret, tilde)
- [ ] 5.4 Implement `resolver/pubgrub.rs` - PubGrub dependency resolution algorithm
- [ ] 5.5 Add unit tests for resolver module

## 6. Core Engine (Rust)

- [ ] 6.1 Create `src-tauri/src/core/mod.rs` with module exports
- [ ] 6.2 Implement `core/orchestrator.rs` - installation workflow coordination
- [ ] 6.3 Implement `core/installer.rs` - package installation execution with rollback
- [ ] 6.4 Implement `core/environment.rs` - environment version management
- [ ] 6.5 Create `src-tauri/src/error.rs` - error types hierarchy
- [ ] 6.6 Add integration tests for core module

## 7. Tauri Commands (Rust)

- [ ] 7.1 Create `src-tauri/src/commands/mod.rs` with command exports
- [ ] 7.2 Implement `commands/environment.rs` - env_list, env_use, env_current, env_install
- [ ] 7.3 Implement `commands/package.rs` - package_search, package_install, package_uninstall, package_list
- [ ] 7.4 Implement `commands/config.rs` - config commands
- [ ] 7.5 Implement `commands/cache.rs` - cache commands
- [ ] 7.6 Register all commands in `lib.rs`
- [ ] 7.7 Add Tauri event emissions for progress updates

## 8. React State Management

- [ ] 8.1 Create `lib/stores/environment.ts` - Zustand store for environment state
- [ ] 8.2 Create `lib/stores/packages.ts` - Zustand store for package state
- [ ] 8.3 Create `lib/stores/settings.ts` - Zustand store for settings
- [ ] 8.4 Create `lib/tauri.ts` - Tauri command wrapper functions with types
- [ ] 8.5 Create `lib/hooks/use-environments.ts` - React Query hooks for environments
- [ ] 8.6 Create `lib/hooks/use-packages.ts` - React Query hooks for packages

## 9. UI Components (React)

- [ ] 9.1 Add shadcn/ui components: card, input, select, dialog, toast, tabs, progress
- [ ] 9.2 Create `components/layout/sidebar.tsx` - navigation sidebar
- [ ] 9.3 Create `components/layout/header.tsx` - app header with search
- [ ] 9.4 Create `components/layout/shell.tsx` - app shell wrapper
- [ ] 9.5 Create `components/environments/env-card.tsx` - environment display card
- [ ] 9.6 Create `components/environments/version-select.tsx` - version dropdown
- [ ] 9.7 Create `components/packages/package-card.tsx` - package display card
- [ ] 9.8 Create `components/packages/search-input.tsx` - package search
- [ ] 9.9 Create `components/packages/install-dialog.tsx` - installation dialog
- [ ] 9.10 Create `components/common/progress.tsx` - progress indicator

## 10. Application Pages (React)

- [ ] 10.1 Update `app/layout.tsx` - add Zustand providers, React Query provider
- [ ] 10.2 Implement `app/page.tsx` - Dashboard with environment overview
- [ ] 10.3 Create `app/environments/page.tsx` - environment management page
- [ ] 10.4 Create `app/packages/page.tsx` - package search and installation page
- [ ] 10.5 Create `app/settings/page.tsx` - configuration management page

## 11. Integration & Testing

- [ ] 11.1 Add Rust dependencies to `src-tauri/Cargo.toml` (tokio, serde, reqwest, sqlx, semver)
- [ ] 11.2 Add React dependencies to `package.json` (@tanstack/react-query, zustand extras)
- [ ] 11.3 Create end-to-end test for environment installation flow
- [ ] 11.4 Create end-to-end test for package search and install
- [ ] 11.5 Update CI workflow for Rust tests
- [ ] 11.6 Manual testing on Windows, macOS, Linux

## 12. Documentation & Polish

- [ ] 12.1 Update README.md with usage instructions
- [ ] 12.2 Add inline documentation for public APIs
- [ ] 12.3 Create sample `CogniaLauncher.yaml` manifest file
- [ ] 12.4 Final UI polish and error handling review
