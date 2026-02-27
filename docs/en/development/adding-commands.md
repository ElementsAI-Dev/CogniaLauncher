# Adding Tauri Commands

This guide explains how to add new Tauri IPC commands.

---

## Overview

Tauri commands are the bridge between frontend and backend. Adding a new command requires modifying the following files:

### Backend

| File | Action |
|------|--------|
| `src-tauri/src/commands/<module>.rs` | Implement command function |
| `src-tauri/src/commands/mod.rs` | Export command |
| `src-tauri/src/lib.rs` | Register in invoke_handler |

### Frontend

| File | Action |
|------|--------|
| `lib/tauri.ts` | Add TypeScript wrapper |
| `types/tauri.ts` | Add type definitions (if needed) |
| `hooks/use-*.ts` | Add to relevant Hook (if needed) |

---

## Step 1: Implement the Backend Command

In `src-tauri/src/commands/<module>.rs`:

```rust
use tauri::State;
use std::sync::{Arc, RwLock};
use crate::provider::registry::ProviderRegistry;
use crate::error::CogniaResult;

#[tauri::command]
pub async fn my_new_command(
    registry: State<'_, Arc<RwLock<ProviderRegistry>>>,
    param1: String,
    param2: Option<u32>,
) -> Result<MyResponse, String> {
    let registry = registry.read().map_err(|e| e.to_string())?;
    // Business logic
    Ok(MyResponse { /* ... */ })
}
```

### Naming Conventions

- Use `snake_case`
- Group by module prefix: `env_*`, `package_*`, `download_*`, `cache_*`
- Return `Result<T, String>` (Tauri requires error type to be String)

---

## Step 2: Export and Register

Export in `src-tauri/src/commands/mod.rs`:

```rust
pub use my_module::my_new_command;
```

Register in `src-tauri/src/lib.rs` `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::my_module::my_new_command,
])
```

---

## Step 3: Frontend Wrapper

Add a TypeScript wrapper in `lib/tauri.ts`:

```typescript
export async function myNewCommand(
  param1: string,
  param2?: number
): Promise<MyResponse> {
  return invoke("my_new_command", { param1, param2 });
}
```

If there are new data types, define them in `types/tauri.ts`:

```typescript
export interface MyResponse {
  field1: string;
  field2: number;
}
```

---

## Step 4: Integrate into a Hook

Expose to components in the relevant Hook file:

```typescript
// hooks/use-my-feature.ts
import { myNewCommand } from "@/lib/tauri";

export function useMyFeature() {
  const doSomething = useCallback(async (param: string) => {
    if (!isTauri()) return;
    const result = await myNewCommand(param);
    // Handle result
  }, []);

  return { doSomething };
}
```

---

## Step 5: Verify

```bash
# Backend compilation check
cargo check

# Frontend lint
pnpm lint

# Confirm command count matches
# Commands in invoke_handler = functions marked with #[tauri::command]
```

!!! tip "Command Count"
    The project currently has 217+ commands. The registration count in `invoke_handler` must exactly match the number of functions marked with `#[tauri::command]`.
