# Profiles System Architecture

## 1. Identity

- **What it is:** Profile management system for environment configuration snapshots.
- **Purpose:** Enable quick switching between different environment configurations.

## 2. Core Components

- `src-tauri/src/core/profiles.rs` (Profile, ProfileManager, ProfileEntry): Profile data structures and management logic.
- `src-tauri/src/commands/profiles.rs` (profile_list, profile_get, profile_create, profile_update, profile_delete, profile_apply, profile_export, profile_import, profile_create_from_current): 9 Tauri commands for profile operations.
- `hooks/use-profiles.ts` (useProfiles): React hook for profile operations.
- `lib/stores/settings.ts` (activeProfile): Stores currently active profile.

## 3. Execution Flow (LLM Retrieval Map)

### Profile Creation
- **1. Capture:** `src-tauri/src/commands/profiles.rs:45-78` captures current environment state via `profile_create_from_current`.
- **2. Storage:** `src-tauri/src/core/profiles.rs:25-60` serializes profile to JSON in cognia_dir.
- **3. Listing:** `profile_list` returns all available profiles.

### Profile Application
- **1. Selection:** User selects profile via `hooks/use-profiles.ts`.
- **2. Loading:** `src-tauri/src/commands/profiles.rs:95-130` loads profile JSON and applies configurations.
- **3. Execution:** Iterates through profile entries and calls `env_use_global` or `env_use_local` for each environment.

## 4. Design Rationale

**Snapshot model:** Profiles capture complete environment state including global versions, local project versions, and provider settings.

**JSON persistence:** Profiles stored as JSON for easy inspection, manual editing, and cross-platform compatibility.

**Import/export:** Enables sharing configurations across teams and backup of development setups.
