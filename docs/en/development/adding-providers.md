# Adding a New Provider

This guide explains how to add a new package manager Provider to CogniaLauncher.

---

## Overview

Adding a new Provider requires modifying the following files:

| File | Action |
|------|--------|
| `src-tauri/src/provider/<name>.rs` | Create Provider implementation |
| `src-tauri/src/provider/mod.rs` | Add module declaration |
| `src-tauri/src/provider/registry.rs` | Register Provider |
| `messages/en.json` | Add English text (if needed) |
| `messages/zh.json` | Add Chinese text (if needed) |

---

## Step 1: Implement the Provider

Create `src-tauri/src/provider/<name>.rs`:

```rust
use super::traits::*;
use crate::error::CogniaResult;

pub struct MyProvider {
    // Configuration fields
}

impl MyProvider {
    pub fn new() -> Self {
        Self { /* ... */ }
    }
}

#[async_trait::async_trait]
impl Provider for MyProvider {
    fn id(&self) -> &str { "my-provider" }
    fn display_name(&self) -> &str { "My Package Manager" }
    fn provider_type(&self) -> ProviderType { ProviderType::PackageManager }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability::Install,
            Capability::Uninstall,
            Capability::Search,
            Capability::List,
        ]
    }

    fn supported_platforms(&self) -> Vec<Platform> {
        vec![Platform::Windows, Platform::MacOS, Platform::Linux]
    }

    fn priority(&self) -> u32 { 50 }

    async fn is_available(&self) -> bool {
        // Check if the package manager is installed
        process::which("my-pm").is_some()
    }

    async fn search(&self, query: &str, opts: &SearchOptions)
        -> CogniaResult<Vec<SearchResult>>
    {
        // Implement search logic
        todo!()
    }

    async fn install(&self, req: &InstallRequest)
        -> CogniaResult<InstallReceipt>
    {
        // Implement install logic
        todo!()
    }

    // ... other methods
}
```

### Key Implementation Points

1. **`is_available()`** — Must verify the executable exists and is runnable
2. **Timeouts** — All external process calls must have timeouts (recommended 120s)
3. **Error Handling** — Use `CogniaResult<T>` unified error type
4. **Progress Reporting** — Long operations use `ProgressCallback`
5. **UTF-8 Handling** — Watch for BOM and encoding issues on Windows

---

## Step 2: Register the Module

Add to `src-tauri/src/provider/mod.rs`:

```rust
pub mod my_provider;
```

---

## Step 3: Register in the Registry

Add to `src-tauri/src/provider/registry.rs`:

```rust
use super::my_provider::MyProvider;

// In the register_providers() function
registry.register(Box::new(MyProvider::new()));
```

For platform-conditional registration:

```rust
#[cfg(target_os = "windows")]
registry.register(Box::new(MyProvider::new()));
```

---

## Step 4: Add Unit Tests

Add tests at the bottom of the Provider file:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_metadata() {
        let p = MyProvider::new();
        assert_eq!(p.id(), "my-provider");
        assert!(!p.capabilities().is_empty());
    }

    #[test]
    fn test_parse_output() {
        // Test output parsing logic
    }
}
```

---

## Step 5: Verify

```bash
# Rust compilation check
cargo check

# Run tests
cargo test my_provider

# Frontend lint (ensure no regressions)
pnpm lint
```

---

## Optional: Implement Extension Traits

### EnvironmentProvider

If it's a version manager (like nvm, pyenv), also implement `EnvironmentProvider`:

- `env_type()` — Environment type identifier
- `get_current_version()` — Get current version
- `set_global_version()` — Set global version
- `set_local_version()` — Set project-level version

### SystemPackageProvider

Provide system-level information:

- `get_version()` — Provider's own version
- `get_executable_path()` — Executable file path
- `get_install_instructions()` — Installation instructions

---

## Existing Provider References

| Complexity | Recommended Reference |
|------------|----------------------|
| Simple | `snap.rs`, `flatpak.rs` |
| Medium | `brew.rs`, `pip.rs` |
| Complex | `winget.rs`, `sdkman.rs` |
| Environment | `nvm.rs`, `pyenv.rs` |
