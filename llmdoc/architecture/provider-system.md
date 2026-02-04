# Provider System Architecture

## 1. Identity

- **What it is:** Extensible provider registry for package and environment management.
- **Purpose:** Unified interface for 35+ package sources and version managers across multiple platforms.

## 2. Core Components

- `src-tauri/src/provider/traits.rs` (Provider, EnvironmentProvider, SystemPackageProvider, VersionDetector, system_detection): Core trait definitions and executable-based version detection.
- `src-tauri/src/provider/registry.rs` (ProviderRegistry): Provider registration, discovery, and filtering by platform.
- `src-tauri/src/provider/nvm.rs` (NvmProvider): Node.js version management via nvm.
- `src-tauri/src/provider/fnm.rs` (FnmProvider): Fast Node.js version manager.
- `src-tauri/src/provider/pyenv.rs` (PyenvProvider): Python version management.
- `src-tauri/src/provider/rustup.rs` (RustupProvider): Rust toolchain management.
- `src-tauri/src/provider/goenv.rs` (GoenvProvider): Go version management.
- `src-tauri/src/provider/rbenv.rs` (RbenvProvider): Ruby version management.
- `src-tauri/src/provider/sdkman.rs` (SdkmanProvider): Java SDK management.
- `src-tauri/src/provider/npm.rs` (NpmProvider): Node.js package registry.
- `src-tauri/src/provider/cargo.rs` (CargoProvider): Rust package registry.
- `src-tauri/src/provider/pip.rs` (PipProvider): Python package registry.
- `src-tauri/src/provider/brew.rs` (BrewProvider): macOS package manager.
- `src-tauri/src/provider/apt.rs` (AptProvider): Debian/Ubuntu packages.
- `src-tauri/src/provider/dnf.rs` (DnfProvider): Fedora packages.
- `src-tauri/src/provider/pacman.rs` (PacmanProvider): Arch packages.
- `src-tauri/src/provider/winget.rs` (WingetProvider): Windows package manager.
- `src-tauri/src/provider/chocolatey.rs` (ChocolateyProvider): Windows package manager.
- `src-tauri/src/provider/scoop.rs` (ScoopProvider): Windows package manager.
- `src-tauri/src/provider/github.rs` (GitHubProvider): GitHub releases.
- `src-tauri/src/provider/registry.rs` (RegistryProvider): Language package registries.

## 3. Execution Flow (LLM Retrieval Map)

### Provider Registration
- **1. Initialization:** `src-tauri/src/lib.rs:43-48` creates ProviderRegistry global state.
- **2. Auto-discovery:** `src-tauri/src/provider/registry.rs:29-91` registers available providers based on platform.
- **3. Frontend query:** `lib/constants/environments.ts:4-41` defines supported environment types.

### Version Detection Flow
- **1. System executable detection:** `src-tauri/src/provider/traits.rs:182-221` provides `detect_from_executable()` for direct version extraction.
- **2. Predefined detectors:** `src-tauri/src/provider/traits.rs:224-265` defines NODE_DETECTOR, PYTHON_DETECTOR, GO_DETECTOR, RUST_DETECTOR, RUBY_DETECTOR, JAVA_DETECTOR.
- **3. Environment-specific detection:** Each provider's `detect_version()` method checks local files, manifests, then falls back to system executable.
- **4. Custom detection:** `src-tauri/src/core/custom_detection.rs:7-100` defines user-configurable detection rules with multiple extraction strategies.

### Package Operations
- **1. Search request:** Frontend calls `package_search` via `lib/tauri.ts`.
- **2. Provider selection:** `src-tauri/src/commands/package.rs` routes to appropriate provider.
- **3. Execution:** Provider implements search, install, uninstall, list operations.
- **4. Result:** Returns structured data to frontend.

## 4. Design Rationale

**Trait-based architecture:** Enables polymorphic provider handling through `Provider`, `EnvironmentProvider`, and `SystemPackageProvider` traits.

**System detection enhancement:** New `system_detection` module allows providers to detect versions from system executables without requiring the version manager to be installed, adding `VersionSource::SystemExecutable` variant.

**Custom detection rules:** Users can define custom version detection patterns for non-standard project configurations, supporting regex, JSONPath, TOML, YAML, XML, and command-based extraction.
