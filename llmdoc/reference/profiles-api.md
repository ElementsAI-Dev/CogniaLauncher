# Profiles API Reference

## 1. Core Summary

Profile management commands for creating, applying, and sharing environment configurations.

## 2. Source of Truth

- **Core Logic:** `src-tauri/src/core/profiles.rs` - Profile data structures and storage
- **Commands:** `src-tauri/src/commands/profiles.rs` - 9 Tauri commands
- **Frontend Hook:** `hooks/use-profiles.ts` - React operations wrapper
- **TypeScript Types:** `lib/tauri.ts:850-920` - Profile type definitions

## 3. Commands

| Command | Purpose | Parameters |
|---------|---------|------------|
| `profile_list` | List all profiles | None |
| `profile_get` | Get profile details | `name: string` |
| `profile_create` | Create new profile | `profile: Profile` |
| `profile_update` | Update existing profile | `name: string, profile: Profile` |
| `profile_delete` | Delete profile | `name: string` |
| `profile_apply` | Apply profile to system | `name: string` |
| `profile_export` | Export profile to file | `name: string, path: string` |
| `profile_import` | Import profile from file | `path: string, overwrite?: boolean` |
| `profile_create_from_current` | Create profile from current state | `name: string, description?: string` |

## 4. Profile Structure

```typescript
interface Profile {
  name: string
  description?: string
  created_at: string
  updated_at: string
  entries: ProfileEntry[]
}

interface ProfileEntry {
  environment: string  // e.g., "node", "python", "rust"
  global_version?: string
  local_versions?: Record<string, string>  // path -> version
  provider_settings?: Record<string, any>
}
```
