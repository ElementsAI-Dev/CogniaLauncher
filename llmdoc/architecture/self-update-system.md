# Architecture of Self-Update System

## 1. Identity

- **What it is:** Source-aware application self-update workflow built on `tauri-plugin-updater`.
- **Purpose:** Allow users to select update source strategy (official/mirror/custom), support deterministic fallback, and surface structured diagnostics.

## 2. Core Components

- `src-tauri/src/config/settings.rs`
  - Persists update source settings:
    - `updates.source_mode`: `official | mirror | custom`
    - `updates.custom_endpoints`: JSON array string
    - `updates.fallback_to_official`: boolean
  - Validates endpoint format and HTTPS scheme during `config_set`.
- `src-tauri/src/commands/updater.rs`
  - Resolves source candidates using settings.
  - Dynamically builds updater instances via `app.updater_builder().endpoints(...).build()`.
  - Shares source resolution logic between check and install paths.
  - Emits structured source/error context in check results and progress events.
- `lib/stores/settings.ts` + `lib/settings/app-settings-mapping.ts`
  - Maps backend `updates.*` values to frontend `AppSettings`.
- `components/settings/update-settings.tsx`
  - UI for source mode, custom endpoints, and fallback toggle.
  - Validates custom endpoint input before persisting custom mode.
- `hooks/use-auto-update.ts` + `hooks/use-about-data.ts` + `lib/update-lifecycle.ts`
  - Consumes backend diagnostics to avoid treating source failures as “up to date”.

## 3. Execution Flow

### 3.1 Check Flow (`self_check_update`)

1. Load update source settings from shared backend settings state.
2. Build candidate chain in deterministic order:
   - Selected source first (`official` or `mirror` or validated custom endpoints).
   - Append `official` if `fallback_to_official=true` and selected source is not official.
3. Attempt each source sequentially until:
   - update found, or
   - no update found for current source, or
   - all sources fail.
4. Return `SelfUpdateInfo` with source diagnostics:
   - `selected_source`
   - `attempted_sources`
   - `error_category` / `error_message` (when failed)

### 3.2 Install Flow (`self_update`)

1. Reuse the same source candidate chain as check flow.
2. For each source:
   - check update
   - if available, run download+install
3. Emit `self-update-progress` events with:
   - status (`downloading | installing | done | error`)
   - progress
   - source/error context (`selectedSource`, `attemptedSources`, `errorCategory`, `errorMessage`)
4. If all sources fail, emit exactly one terminal `error` progress event and return categorized error.

## 4. Contract

### 4.1 `SelfUpdateInfo` (check result)

- Existing fields remain:
  - `current_version`
  - `latest_version`
  - `update_available`
  - `release_notes`
- Added diagnostic fields:
  - `selected_source`
  - `attempted_sources`
  - `error_category`
  - `error_message`

### 4.2 `SelfUpdateProgressEvent` (install stream)

- Existing fields remain:
  - `status`
  - `progress`
- Added optional context fields:
  - `selectedSource`
  - `attemptedSources`
  - `errorCategory`
  - `errorMessage`

## 5. Error Categories

Backend updater diagnostics normalize to:

- `source_unavailable`
- `network`
- `timeout`
- `validation`
- `signature`
- `no_update`
- `unknown`

Frontend lifecycle maps these categories into user-facing update states/messages.

## 6. Compatibility Notes

- Existing update toggles (`check_on_start`, `auto_install`, `notify`) are preserved.
- New diagnostics are additive; previous status vocabulary (`downloading/installing/done/error`) is unchanged.
- Existing configs without new fields default to:
  - `source_mode=official`
  - `custom_endpoints=[]`
  - `fallback_to_official=true`

