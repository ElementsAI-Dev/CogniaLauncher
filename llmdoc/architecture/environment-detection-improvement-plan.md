# Environment Detection System Improvement Plan

## Current Issues Analysis

### Issue 1: Version Manager Dependency
**Problem**: The current system only detects environments if version managers (goenv, fnm, pyenv, etc.) are installed.

**Example**: User has Go installed via official installer or winget, but:
- `goenv` is not installed → Go not detected
- `GoenvProvider::is_available()` returns `false` → Provider not registered

**Affected Code**:
```rust
// src-tauri/src/provider/registry.rs:77-80
let goenv_provider = Arc::new(goenv::GoenvProvider::new());
if goenv_provider.is_available().await {
    registry.register_environment_provider(goenv_provider);
}
```

### Issue 2: Unused System Detection Module
**Problem**: The `system_detection` module in `traits.rs` (lines 181-272) defines `GO_DETECTOR`, `NODE_DETECTOR`, `PYTHON_DETECTOR`, etc., but they are **never used** in the detection flow.

**Existing unused code**:
```rust
pub const GO_DETECTOR: VersionDetector = VersionDetector {
    cmd: "go",
    args: &["version"],
    pattern: Some(r"go(\d+\.\d+(?:\.\d+)?)"),
};
```

### Issue 3: Platform Compatibility
**Problem**: Some providers only support macOS/Linux:
- `goenv` - macOS/Linux only (Windows users have no Go detection)
- `pyenv` - Limited Windows support
- `rbenv` - macOS/Linux only

### Issue 4: No Fallback Detection
**Problem**: When version managers aren't available, there's no fallback to detect system-installed versions.

### Issue 5: Environment Type Mapping
**Problem**: Provider IDs (`fnm`, `nvm`, `goenv`) don't map to environment types (`node`, `go`) consistently in the UI.

---

## Proposed Solution Architecture

### Solution 1: Create SystemEnvironmentProvider

Create a new provider that detects system-installed versions directly from PATH executables.

**New file**: `src-tauri/src/provider/system.rs`

```rust
pub struct SystemEnvironmentProvider {
    env_type: EnvironmentType,
}

pub enum EnvironmentType {
    Node,
    Python,
    Go,
    Rust,
    Ruby,
    Java,
    Dotnet,
    Php,
}

impl SystemEnvironmentProvider {
    pub fn new(env_type: EnvironmentType) -> Self { ... }
    
    async fn detect_system_version(&self) -> Option<String> {
        // Use existing system_detection::VersionDetector
    }
}
```

### Solution 2: Hierarchical Provider Registration

Modify `ProviderRegistry::with_settings()` to:
1. Always register SystemEnvironmentProvider for all environment types
2. Prefer version managers when available
3. Fall back to system detection otherwise

**Priority order**:
1. Version manager (fnm/nvm, pyenv, goenv) - Priority 100
2. System executable detection - Priority 50

### Solution 3: Unified Environment Detection Flow

```
detect_version(env_type, path)
  │
  ├─► Check version manager provider
  │     └─► If available: return managed version
  │
  └─► Check system executable
        └─► If found: return system version
```

### Solution 4: Cross-Platform Installation Support

Add multiple installation methods per environment:

| Environment | Primary (Managed)      | Fallback (System)        |
|-------------|------------------------|--------------------------|
| Node        | fnm, nvm               | System node executable   |
| Python      | pyenv, uv              | System python executable |
| Go          | goenv (macOS/Linux)    | System go executable     |
| Rust        | rustup                 | System rustc executable  |
| Ruby        | rbenv                  | System ruby executable   |
| Java        | sdkman                 | System java executable   |

---

## Implementation Plan

### Phase 1: System Detection Provider (Priority: Critical)

1. **Create `SystemEnvironmentProvider`** in `src-tauri/src/provider/system.rs`
   - Implement for all environment types: Node, Python, Go, Rust, Ruby, Java, PHP, .NET
   - Use existing `system_detection::VersionDetector` patterns
   - Support Windows, macOS, Linux

2. **Enhance `system_detection` module**
   - Add Windows-specific detection paths
   - Add common installation path checks
   - Add `PYTHON_WINDOWS_DETECTOR` (python.exe, python3.exe)

### Phase 2: Registry Enhancement (Priority: High)

1. **Modify `ProviderRegistry::with_settings()`**
   - Always register system providers as fallback
   - Register both managed and system providers
   - Ensure correct priority ordering

2. **Add environment type mapping**
   - Map `fnm` → `node`
   - Map `nvm` → `node`
   - Map `goenv` → `go`
   - etc.

### Phase 3: Detection Flow Improvement (Priority: High)

1. **Enhance `EnvironmentManager::detect_all_versions()`**
   - Aggregate results from multiple providers
   - Prefer managed versions over system versions
   - Show source clearly (managed vs system)

2. **Add `detect_system_environments()` command**
   - New Tauri command to detect all system-installed environments
   - Return version, path, and installation source

### Phase 4: Installation Logic Enhancement (Priority: Medium)

1. **Add installation method selection**
   - Allow users to choose: version manager or official installer
   - Show available installation methods per platform

2. **Create installation providers**
   - Download from official sources (go.dev, python.org, nodejs.org)
   - Use GitHub releases API
   - Support checksum verification

### Phase 5: Frontend Updates (Priority: Medium)

1. **Update environment list UI**
   - Show both managed and system versions
   - Indicate version source (e.g., "via goenv", "system", "via winget")
   - Allow installation even when version manager not available

2. **Add "Install Version Manager" option**
   - Guide users to install fnm, pyenv, goenv if desired

---

## File Changes Summary

### New Files
- `src-tauri/src/provider/system.rs` - SystemEnvironmentProvider

### Modified Files
- `src-tauri/src/provider/mod.rs` - Export system module
- `src-tauri/src/provider/registry.rs` - Register system providers
- `src-tauri/src/provider/traits.rs` - Enhance system_detection module
- `src-tauri/src/core/environment.rs` - Improve detection flow
- `src-tauri/src/commands/environment.rs` - Add new detection commands

### Frontend Files
- `lib/tauri.ts` - Add new command wrappers
- `types/tauri.ts` - Add new types
- `components/environments/*` - Update UI components

---

## Testing Strategy

1. **Unit Tests**
   - Test system detection for each environment type
   - Test version regex patterns
   - Test Windows/macOS/Linux path handling

2. **Integration Tests**
   - Test detection with Go installed (no goenv)
   - Test detection with fnm + system node
   - Test priority ordering

3. **Manual Testing**
   - Test on Windows with Go/Python/Node installed via official installers
   - Test on macOS with Homebrew-installed tools
   - Test on Linux with apt-installed tools

---

## Success Criteria

- [ ] Go detected when installed via official installer (no goenv)
- [ ] Python detected when installed via python.org or system package manager
- [ ] Node detected when installed via nodejs.org (no fnm/nvm)
- [ ] All environments detected on Windows
- [ ] Version source clearly indicated in UI
- [ ] Installation works without requiring version manager
