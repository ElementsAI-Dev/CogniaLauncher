# Error Handling

CogniaLauncher's error handling strategy covers all layers of the frontend and backend.

---

## Backend Error Handling

### Unified Error Type

```rust
// src-tauri/src/error.rs
pub type CogniaResult<T> = Result<T, CogniaError>;

pub enum CogniaError {
    Provider(String),
    Network(String),
    Io(std::io::Error),
    Config(String),
    Cache(String),
    Timeout(String),
    NotFound(String),
    PermissionDenied(String),
    // ...
}
```

### Tauri Command Errors

Tauri commands return `Result<T, String>`, with `CogniaError` automatically converted to `String`:

```rust
#[tauri::command]
pub async fn my_command() -> Result<Data, String> {
    let result = do_something().map_err(|e| e.to_string())?;
    Ok(result)
}
```

### Provider Error Handling

- A single Provider failure does not affect other Providers
- Timeout errors have dedicated handling (120s default, 600s for long operations)
- Network errors support retries (configurable retry count)

---

## Frontend Error Handling

### React Error Boundaries

```
app/
├── error.tsx         # Route-level error boundary
├── global-error.tsx  # Global error boundary
└── not-found.tsx     # 404 page
```

Each route page has an `error.tsx` to catch rendering errors.

### Tauri API Errors

The frontend handles Tauri call errors via try-catch:

```typescript
try {
  const result = await invoke("command_name", args);
} catch (error) {
  // Show user-friendly error message
  toast.error(String(error));
}
```

### isTauri Guard

All Tauri API calls check the runtime environment first:

```typescript
if (isTauri()) {
  // Desktop mode: call Tauri API
} else {
  // Web mode: use fallback or show prompt
}
```

---

## Error Categories

| Category | Handling | User Message |
|----------|----------|-------------|
| Network timeout | Auto retry | "Network connection timed out, retrying..." |
| Package not found | Return empty result | "No matching packages found" |
| Insufficient permissions | Prompt elevation | "Administrator privileges required" |
| Insufficient disk space | Block operation | "Insufficient disk space" |
| Provider unavailable | Skip Provider | "xx package manager not installed" |
| Version conflict | Show conflict details | "Version x.y.z conflicts with a.b.c" |
| Config error | Provide fix suggestion | "Configuration file format error" |

---

## Logging

All errors are recorded in the logging system:

- **Error level** — Operation failures, exceptions
- **Warn level** — Recoverable issues
- **Info level** — Normal operation logs
- **Debug level** — Debug information

Log format: `[TIMESTAMP][LEVEL][TARGET] MESSAGE`
