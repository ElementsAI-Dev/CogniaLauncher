# Design: CogniaLauncher Core System

## Context

CogniaLauncher is a unified environment and package manager designed to solve the fragmentation problem in developer tooling. Currently, developers must manage multiple tools (nvm, pyenv, rustup, apt, brew, winget) separately. This system provides a single interface to manage all of them.

### Stakeholders
- **Developers**: Daily users managing development environments
- **DevOps Engineers**: CI/CD integration
- **Plugin Developers**: Extending system with new providers

### Constraints
- Must work in user-space (no admin privileges required for most operations)
- Must support offline mode with local caching
- Memory footprint < 100MB
- Must not break existing tool configurations

## Goals / Non-Goals

### Goals
- Provide unified CLI/GUI for environment and package management
- Support cross-platform operation (Windows, macOS, Linux)
- Enable project-level environment pinning
- Reliable installation with rollback support
- Extensible provider architecture

### Non-Goals
- Replace underlying tools (nvm, pyenv, etc.) - we delegate to them
- Full package registry (we use existing registries)
- Container/VM-based isolation

## Decisions

### Decision 1: Layered Architecture with Plugin System

**What**: Adopt layered architecture (Presentation → Application → Domain → Infrastructure → Platform) with provider plugins.

**Why**: 
- Clear separation of concerns
- Providers can be developed independently
- Easy to add new package managers

**Alternatives considered**:
- Monolithic architecture: Simpler but harder to extend
- Microservices: Overkill for desktop application

### Decision 2: Rust Backend with Tauri

**What**: All system interactions through Rust via Tauri commands.

**Why**:
- Performance: Native speed for file/network operations
- Safety: Memory safety guarantees
- Cross-platform: Single codebase for all platforms
- Tauri: Lightweight, secure desktop framework

**Alternatives considered**:
- Electron: Heavier, less secure
- Pure Node.js: Performance concerns for file operations

### Decision 3: PubGrub for Dependency Resolution

**What**: Use PubGrub algorithm (from Dart/Cargo) for dependency resolution.

**Why**:
- Proven in production (Dart pub, Cargo)
- Good conflict explanation
- Efficient backtracking

**Alternatives considered**:
- SAT solver (minisat): Lower-level, harder to explain conflicts
- Simple greedy: Can't handle complex constraints

### Decision 4: Shim-based Version Switching

**What**: Install shims in `~/.CogniaLauncher/bin/` that detect and delegate to correct version.

**Why**:
- Transparent to users and scripts
- No shell hook required for basic operation
- Works with any shell

**Alternatives considered**:
- PATH manipulation: Complex shell integration
- Symbolic links: Requires shell hooks for project-local versions

### Decision 5: SQLite for State Management

**What**: Use SQLite for installed packages database and cache index.

**Why**:
- ACID transactions for reliable state
- No external database required
- Fast queries for installed package lookups

**Alternatives considered**:
- JSON files: No transactions, corruption risk
- LevelDB: More complex, overkill for our needs

### Decision 6: Zustand for React State Management

**What**: Use Zustand for global state in React frontend.

**Why**:
- Lightweight, minimal boilerplate
- Good TypeScript support
- Already in project tech stack

**Alternatives considered**:
- Redux: Too much boilerplate
- Jotai: Similar but Zustand preferred for project conventions

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Tauri)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Dashboard│ │ Search  │ │ Environ │ │ Config  │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       └──────────┬┴──────────┬┴──────────┬┘                │
│                  │   Zustand Store        │                 │
│                  │   @tanstack/query      │                 │
└──────────────────┼───────────────────────┼─────────────────┘
                   │  Tauri Commands (IPC)  │
┌──────────────────┼───────────────────────┼─────────────────┐
│                  ▼    Rust Backend        ▼                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │                   Command Handlers                  │    │
│  └────────────────────────┬───────────────────────────┘    │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────┐    │
│  │                    Core Engine                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │Orchestrator│ │ Resolver │ │ Installer│           │    │
│  │  └──────────┘ └──────────┘ └──────────┘           │    │
│  └────────────────────────┬───────────────────────────┘    │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────┐    │
│  │              Provider Registry                      │    │
│  │  ┌─────┐ ┌─────┐ ┌──────┐ ┌─────┐ ┌──────┐        │    │
│  │  │ nvm │ │pyenv│ │rustup│ │ apt │ │github│ ...    │    │
│  │  └─────┘ └─────┘ └──────┘ └─────┘ └──────┘        │    │
│  └────────────────────────┬───────────────────────────┘    │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────┐    │
│  │             Platform Abstraction Layer              │    │
│  │  ┌────┐ ┌───────┐ ┌───────┐ ┌─────┐ ┌──────┐      │    │
│  │  │ FS │ │Process│ │Network│ │Cache│ │Config│      │    │
│  │  └────┘ └───────┘ └───────┘ └─────┘ └──────┘      │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

## Module Structure (Rust)

```
src-tauri/src/
├── lib.rs                 # Library entry, Tauri plugin registration
├── main.rs                # Application entry
├── commands/              # Tauri command handlers
│   ├── mod.rs
│   ├── environment.rs     # env list, use, current
│   ├── package.rs         # install, uninstall, search
│   ├── config.rs          # config get/set
│   └── cache.rs           # cache clean, info
├── core/                  # Core business logic
│   ├── mod.rs
│   ├── orchestrator.rs    # Installation workflow coordination
│   ├── resolver.rs        # Dependency resolution
│   └── installer.rs       # Package installation execution
├── provider/              # Provider system
│   ├── mod.rs
│   ├── traits.rs          # Provider, EnvironmentProvider traits
│   ├── registry.rs        # Provider registry
│   ├── nvm.rs             # Node.js version manager
│   ├── pyenv.rs           # Python version manager
│   ├── rustup.rs          # Rust toolchain manager
│   ├── apt.rs             # Debian/Ubuntu packages
│   ├── brew.rs            # macOS Homebrew
│   ├── winget.rs          # Windows Package Manager
│   └── github.rs          # GitHub releases
├── platform/              # Platform abstraction
│   ├── mod.rs
│   ├── fs.rs              # File system operations
│   ├── process.rs         # Process execution
│   ├── network.rs         # HTTP client with retry
│   └── env.rs             # Environment variables
├── config/                # Configuration management
│   ├── mod.rs
│   ├── settings.rs        # Main config (TOML)
│   ├── manifest.rs        # Project manifest (YAML)
│   └── lockfile.rs        # Lock file management
├── cache/                 # Cache system
│   ├── mod.rs
│   ├── download.rs        # Download cache
│   ├── metadata.rs        # Metadata cache
│   └── db.rs              # SQLite cache index
├── resolver/              # Dependency resolution
│   ├── mod.rs
│   ├── version.rs         # Version parsing
│   ├── constraint.rs      # Version constraints
│   └── pubgrub.rs         # PubGrub solver
└── error.rs               # Error types

```

## React Component Structure

```
app/
├── page.tsx               # Dashboard (main page)
├── layout.tsx             # Root layout with providers
├── environments/
│   └── page.tsx           # Environment management
├── packages/
│   └── page.tsx           # Package search & install
├── settings/
│   └── page.tsx           # Configuration UI
└── globals.css            # Global styles

components/
├── ui/                    # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── toast.tsx
│   └── ...
├── layout/
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── header.tsx         # App header
│   └── shell.tsx          # App shell wrapper
├── environments/
│   ├── env-card.tsx       # Environment card
│   ├── version-select.tsx # Version selector
│   └── env-list.tsx       # Environment list
├── packages/
│   ├── package-card.tsx   # Package display card
│   ├── search-input.tsx   # Package search
│   └── install-dialog.tsx # Installation dialog
└── common/
    ├── loading.tsx        # Loading states
    ├── error-boundary.tsx # Error handling
    └── progress.tsx       # Progress indicator

lib/
├── utils.ts               # Utility functions (cn, etc.)
├── tauri.ts               # Tauri command wrappers
├── stores/
│   ├── environment.ts     # Environment state (Zustand)
│   ├── packages.ts        # Package state
│   └── settings.ts        # Settings state
└── hooks/
    ├── use-environments.ts # Environment queries
    ├── use-packages.ts     # Package queries
    └── use-settings.ts     # Settings queries
```

## Data Flow

### Installation Flow
1. User clicks "Install" in UI
2. React calls Tauri command `install_package`
3. Rust orchestrator:
   - Resolves dependencies (pubgrub)
   - Downloads artifacts (with cache check)
   - Verifies checksums
   - Executes installation via provider
   - Updates SQLite state
   - Emits progress events
4. React receives events, updates UI

### Environment Switch Flow
1. User selects version in UI
2. React calls Tauri command `use_environment`
3. Rust:
   - Validates version is installed
   - Updates version file (`.node-version`, etc.)
   - Updates shim symlinks if needed
   - Emits environment change event
4. React updates state

## Risks / Trade-offs

### Risk: Provider Command Output Parsing
Different versions of tools may change output format.

**Mitigation**: 
- Prefer JSON output where available (`brew info --json`)
- Version-specific parsers with fallbacks
- Integration tests with real tools

### Risk: Cross-platform Path Handling
Windows uses different path separators and conventions.

**Mitigation**:
- Use `std::path::PathBuf` consistently
- Platform-specific code isolated in `platform/` module
- CI testing on all platforms

### Risk: Network Reliability
Downloads may fail, APIs may be rate-limited.

**Mitigation**:
- Exponential backoff retry
- Resume support for downloads
- Aggressive caching
- GitHub token support for higher rate limits

## Migration Plan

Not applicable - this is a greenfield implementation.

## Open Questions

1. **Plugin System**: Should we support external provider plugins in v1.0, or defer to later?
   - **Recommendation**: Defer to v1.1, focus on built-in providers first

2. **CLI Interface**: Should we also implement a CLI alongside the GUI?
   - **Recommendation**: Yes, as a separate future change. GUI-first for v1.0

3. **Offline Mode**: How much offline functionality should we support?
   - **Recommendation**: Full offline for cached packages, graceful degradation for search
