# Change: Update terminal management completeness

## Why

Current terminal management provides shell detection, profile CRUD, config parsing, and PowerShell utilities, but still has functional gaps that impact correctness:

- Profile launch behavior is incomplete (`cwd` is ignored, `envType/envVersion` is not applied).
- Shell resolution is brittle for shell ids that are not directly mappable to `ShellType` (for example `gitbash`).
- UI feedback is misleading (`launch` may report success even when command fails).
- Proxy settings are not fully visible from `config_list`, causing first-load state drift.
- Frontend state handling has consistency issues (profile dialog stale state, framework detection overwrite).

The goal is to complete terminal management behavior without introducing PTY-heavy architecture changes and while preserving backward compatibility.

## What Changes

- Add a compatibility-safe detailed launch command:
  - keep `terminal_launch_profile(id) -> String` behavior for existing callers
  - add `terminal_launch_profile_detailed(id) -> LaunchResult` for structured result handling
- Refactor terminal profile launch internals:
  - robust shell resolution for profile shell ids (detected shell list first, then `ShellType` fallback)
  - apply `cwd` to process options
  - apply `envType/envVersion` through `EnvironmentManager` (with explicit validation when version cannot be resolved)
  - enforce env precedence: environment manager < proxy env < profile env
- Add missing terminal proxy keys to `config_list`:
  - `terminal.proxy_mode`
  - `terminal.custom_proxy`
  - `terminal.no_proxy`
- Extend frontend terminal UX and state:
  - show launch result (`stdout/stderr/exitCode/success`) in profile area
  - track `launchingProfileId` and `lastLaunchResult`
  - provide `clearLaunchResult`
  - prevent stale profile dialog form state
  - merge framework detection results by `shellType` instead of overwriting on multi-shell scan
  - proactively refresh proxy env vars on proxy panel mount

## Impact

- Affected specs:
  - `terminal-management` (new capability spec)
  - `configuration-system` (modified: proxy key visibility)
  - `environment-management` (modified: profile launch environment injection)
- Affected backend:
  - `src-tauri/src/commands/terminal.rs`
  - `src-tauri/src/commands/mod.rs`
  - `src-tauri/src/commands/config.rs`
  - `src-tauri/src/lib.rs`
- Affected frontend:
  - `lib/tauri.ts`
  - `hooks/use-terminal.ts`
  - `components/terminal/terminal-profile-list.tsx`
  - `components/terminal/terminal-profile-dialog.tsx`
  - `components/terminal/terminal-shell-framework.tsx`
  - `components/terminal/terminal-proxy-settings.tsx`
- Affected tests:
  - Rust tests in `src-tauri/src/commands/terminal.rs` and `src-tauri/src/commands/config.rs`
  - Jest tests for hook and terminal components
