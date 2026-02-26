# Tasks: Update terminal management completeness

## 1. Specification

- [x] 1.1 Add `terminal-management` capability spec delta with launch completeness and compatibility requirements.
- [x] 1.2 Add `configuration-system` delta for terminal proxy keys in config listing.
- [x] 1.3 Add `environment-management` delta for profile launch env injection behavior.
- [x] 1.4 Validate spec change with `openspec validate update-terminal-management-completeness --strict`.

## 2. Backend launch behavior completeness

- [x] 2.1 Add shell resolution helper for profile launch (detected shell list first, `ShellType` fallback).
- [x] 2.2 Add launch options helper to apply timeout, cwd, env manager variables, proxy env, and profile env.
- [x] 2.3 Add command `terminal_launch_profile_detailed` returning structured launch result.
- [x] 2.4 Keep `terminal_launch_profile` compatibility by reusing detailed launch path and returning stdout.
- [x] 2.5 Register new command export and invoke handler entry.

## 3. Backend configuration visibility

- [x] 3.1 Include `terminal.proxy_mode`, `terminal.custom_proxy`, and `terminal.no_proxy` in `config_list`.

## 4. Frontend terminal UX/state completeness

- [x] 4.1 Add `terminalLaunchProfileDetailed` wrapper in `lib/tauri.ts`.
- [x] 4.2 Update `useTerminal` with `launchingProfileId`, `lastLaunchResult`, and `clearLaunchResult`.
- [x] 4.3 Update profile launch behavior and toasts based on structured launch result.
- [x] 4.4 Update profile list UI to display latest launch output and exit status.
- [x] 4.5 Fix profile dialog stale initial state when `open/profile/shells` changes.
- [x] 4.6 Fix framework detection aggregation by shell type.
- [x] 4.7 Refresh proxy env vars on proxy settings mount.

## 5. Tests and validation

- [x] 5.1 Add Rust tests for detailed launch behavior, shell resolution, env/cwd handling, and compatibility output.
- [x] 5.2 Add Rust test for config list terminal proxy keys.
- [x] 5.3 Add Jest tests for `use-terminal` launch state and framework merge behavior.
- [x] 5.4 Add/extend component tests for profile dialog reset and profile list launch result rendering.
- [x] 5.5 Run targeted backend/frontend tests and lint checks.
