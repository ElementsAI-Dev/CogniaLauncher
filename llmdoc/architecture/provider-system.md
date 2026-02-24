# Provider System Architecture

## 1. Identity

- **What it is:** Extensible provider registry for package and environment management.
- **Purpose:** Unified interface for 55 package sources and version managers across multiple platforms.

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
- `src-tauri/src/provider/uv.rs` (UvProvider): Fast Python package installer.
- `src-tauri/src/provider/yarn.rs` (YarnProvider): Node.js package manager.
- `src-tauri/src/provider/bun.rs` (BunProvider): Bun runtime and package manager.
- `src-tauri/src/provider/deno.rs` (DenoProvider): Deno runtime and package management.
- `src-tauri/src/provider/phpbrew.rs` (PhpbrewProvider): PHP version management.
- `src-tauri/src/provider/bundler.rs` (BundlerProvider): Ruby dependency management with detailed version info (release dates, yanked status).
- `src-tauri/src/provider/composer.rs` (ComposerProvider): PHP dependency management with Packagist search result counts.
- `src-tauri/src/provider/dotnet.rs` (DotnetProvider): .NET SDK with NuGet search including per-version download counts.
- `src-tauri/src/provider/poetry.rs` (PoetryProvider): Python dependency management with Poetry home install path detection.
- `src-tauri/src/provider/brew.rs` (BrewProvider): macOS package manager.
- `src-tauri/src/provider/apt.rs` (AptProvider): Debian/Ubuntu packages.
- `src-tauri/src/provider/dnf.rs` (DnfProvider): Fedora packages.
- `src-tauri/src/provider/pacman.rs` (PacmanProvider): Arch packages.
- `src-tauri/src/provider/winget.rs` (WingetProvider): Windows package manager.
- `src-tauri/src/provider/chocolatey.rs` (ChocolateyProvider): Windows package manager.
- `src-tauri/src/provider/scoop.rs` (ScoopProvider): Windows package manager.
- `src-tauri/src/provider/github.rs` (GitHubProvider): GitHub releases.
- `src-tauri/src/provider/gitlab.rs` (GitLabProvider): GitLab releases.
- `src-tauri/src/provider/volta.rs` (VoltaProvider): JavaScript tool manager.
- `src-tauri/src/provider/asdf.rs` (AsdfProvider): Polyglot version manager.
- `src-tauri/src/provider/mise.rs` (MiseProvider): Polyglot version manager (successor to rtx/asdf).
- `src-tauri/src/provider/conda.rs` (CondaProvider): Conda/Mamba data science packages.
- `src-tauri/src/provider/pipx.rs` (PipxProvider): Isolated Python CLI tools.
- `src-tauri/src/provider/gem.rs` (GemProvider): RubyGems packages.
- `src-tauri/src/provider/nix.rs` (NixProvider): Nix package manager.
- `src-tauri/src/provider/conan.rs` (ConanProvider): Conan 2.x C/C++ package manager.
- `src-tauri/src/provider/xmake.rs` (XmakeProvider): Xmake/Xrepo C/C++ package manager.
- `src-tauri/src/provider/vcpkg.rs` (VcpkgProvider): Microsoft C++ package manager.
- `src-tauri/src/provider/macports.rs` (MacPortsProvider): macOS MacPorts package manager.
- `src-tauri/src/provider/pnpm.rs` (PnpmProvider): Fast Node.js package manager.
- `src-tauri/src/provider/podman.rs` (PodmanProvider): Podman container images.
- `src-tauri/src/provider/wsl.rs` (WslProvider): Windows Subsystem for Linux management.
- `src-tauri/src/provider/git.rs` (GitProvider): Git version management and repository inspection (branches, tags, log, blame, stash, contributors).
- `src-tauri/src/provider/fvm.rs` (FvmProvider): Flutter Version Manager for Dart/Flutter SDK version management.
- `src-tauri/src/provider/pub_dev.rs` (PubDevProvider): Dart Pub packages via pub.dev API.
- `src-tauri/src/provider/luarocks.rs` (LuaRocksProvider): LuaRocks Lua module manager.
- `src-tauri/src/provider/zig.rs` (ZigProvider): Zig version management via ziglang.org download index.
- `src-tauri/src/provider/msvc.rs` (MsvcProvider): Visual Studio Build Tools detection via vswhere.exe (Windows).
- `src-tauri/src/provider/msys2.rs` (Msys2Provider): MSYS2 pacman package manager (Windows).
- `src-tauri/src/provider/system.rs` (SystemEnvironmentProvider): System-installed runtime detection (28 types).
- `src-tauri/src/provider/node_base.rs`: Shared Node.js utilities + `split_name_version()`.

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

**Enhanced version metadata:** Providers now return detailed `VersionInfo` structures including release dates, yanked/deprecated status, and per-version download counts where available (RubyGems, NuGet).

**Search result pagination:** Package search APIs return total hit counts for proper pagination (Packagist `total`, NuGet `total_hits`).

**Install path detection:** Providers use home directory environment variables (`POETRY_HOME`, `COMPOSER_HOME`) for accurate install path determination.

**System detection enhancement:** New `system_detection` module allows providers to detect versions from system executables without requiring the version manager to be installed, adding `VersionSource::SystemExecutable` variant.

**Custom detection rules:** Users can define custom version detection patterns for non-standard project configurations, supporting regex, JSONPath, TOML, YAML, XML, and command-based extraction.
