# Architecture of Self-Update System

## 1. Identity

- **What it is:** Application auto-update mechanism using Tauri's updater plugin.
- **Purpose:** Enables CogniaLauncher to check for and install updates automatically.

## 2. Core Components

- `src-tauri/src/commands/updater.rs` (self_check_update, self_update): Implements update checking and installation using tauri-plugin-updater.
- `src-tauri/Cargo.toml` (tauri-plugin-updater): Updater plugin dependency.
- `src-tauri/tauri.conf.json` (plugins.updater): Plugin configuration with empty pubkey/endpoints for manual update server setup.
- `src-tauri/capabilities/default.json` (updater:default): Security permissions for update operations.
- `src-tauri/src/lib.rs` (lines 175-176, 178): Command registration and plugin initialization.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Check Update:** Frontend calls `selfCheckUpdate` in `lib/tauri.ts:464`, invoking `self_check_update` command.
- **2. Query Remote:** `src-tauri/src/commands/updater.rs:14-56` checks for updates via `AppHandle.updater()`.
- **3. Return Info:** Returns `SelfUpdateInfo` struct with current/latest versions and release notes.
- **4. Install Update:** Frontend calls `selfUpdate` in `lib/tauri.ts:465`, invoking `self_update` command.
- **5. Download & Install:** `src-tauri/src/commands/updater.rs:59-88` downloads and applies update.

## 4. Design Rationale

Uses Tauri's official updater plugin for cross-platform compatibility. Fails gracefully when updater unavailable (logs warning, returns current version).
