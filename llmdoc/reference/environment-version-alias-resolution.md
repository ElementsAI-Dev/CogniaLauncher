# Environment Version Alias Resolution

## 1. Core Summary

The environment management system supports version aliases like `lts`, `latest`, and `stable` which are automatically resolved to actual version numbers. This allows users to install environments using semantic aliases instead of specific version numbers.

## 2. Source of Truth

- **Primary Code:** `src-tauri/src/commands/environment.rs:254-321` (env_resolve_alias) - Implements alias resolution logic for Node.js LTS detection and partial version matching.
- **TypeScript Bindings:** `lib/tauri.ts:34-36` (envResolveAlias) - Frontend command invocation wrapper.
- **Frontend Usage:** Components can call `envResolveAlias(envType, alias)` to convert aliases before installation.

## 3. Supported Aliases

| Alias | Description | Example Resolution |
|-------|-------------|-------------------|
| `latest` / `newest` / `current` | Most recent version | `"20.10.0"` |
| `lts` | Long-term support version | `"20.10.0"` (Node.js: even major ≥4) |
| `stable` | Latest non-deprecated version | `"20.10.0"` |
| Partial version | Prefix matching | `"20"` → `"20.10.0"` |

## 4. LTS Detection Logic

For Node.js, LTS versions are identified as:
- Even major versions ≥ 4
- Example: v18.x, v20.x are LTS; v19.x, v21.x are not

For other environments, returns the latest non-deprecated, non-yanked version.
