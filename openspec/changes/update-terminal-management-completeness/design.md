# Design: Terminal management completeness (compatible extension)

## Context

Terminal management currently uses profile data from `core::terminal::TerminalProfile`, with launch implemented in `commands::terminal::terminal_launch_profile`. The existing launch path executes shell commands but does not fully apply profile context (`cwd`, `envType/envVersion`) and only returns `stdout` as string.

Separately, `commands::launch` already defines structured launch output (`LaunchResult`) and environment activation logic through `EnvironmentManager`.

## Goals

- Preserve backward compatibility for existing `terminal_launch_profile` callers.
- Provide a structured launch API for correct UX and result semantics.
- Reuse existing environment activation logic and avoid introducing PTY architecture.
- Ensure deterministic env precedence and shell resolution behavior.

## Non-goals

- Interactive PTY/session terminal emulation (`xterm`, `node-pty`, `tauri-plugin-shell` interactive session).
- Event/channel migration for high-throughput terminal stream transport.
- Redesign of terminal profile storage format.

## Backend Design

### 1) Introduce structured launch command

- Add `terminal_launch_profile_detailed(id, manager, settings, registry) -> Result<LaunchResult, String>`.
- Reuse `LaunchResult` type from `commands::launch` for consistency and existing TypeScript typing.
- Keep old command:
  - `terminal_launch_profile(...) -> Result<String, String>`
  - Internally call detailed command and return `.stdout`.

### 2) Shell resolution strategy

Add helper `resolve_profile_shell(profile, detected_shells)`:

1. Try matching `profile.shell_id` against detected shell list (`core::terminal::detect_installed_shells`) by `id`.
2. Fallback: `ShellType::from_id(profile.shell_id)` and `ShellType::executable_path()`.
3. Return `(shell_type, executable_path)` or explicit error.

This supports shell ids like `gitbash` (present in detected list but not in `ShellType::from_id`).

### 3) Launch option construction

Add helper `build_launch_options(profile, settings, registry)` to construct `ProcessOptions`:

- Base timeout: 300s.
- Apply `cwd` when present.
- Apply environment manager vars when `env_type` is present:
  - if `env_version` present: use directly;
  - else require `cwd` and run `EnvironmentManager::detect_version`;
  - error if neither version nor detectable cwd context exists.
- Apply env precedence:
  1. env manager variables (`PATH` + `set_variables`)
  2. proxy env (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` variants)
  3. profile env vars (override previous values)

### 4) Config list completion

In `commands::config::config_list`, include terminal proxy keys in static key listing:

- `terminal.proxy_mode`
- `terminal.custom_proxy`
- `terminal.no_proxy`

This aligns list output with `Settings::get_value` support.

## Frontend Design

### 1) API wrapper

- Add `terminalLaunchProfileDetailed(id)` in `lib/tauri.ts`.
- Keep existing `terminalLaunchProfile(id)` for compatibility.

### 2) Hook state updates

In `hooks/use-terminal.ts`:

- Add state fields:
  - `launchingProfileId: string | null`
  - `lastLaunchResult: { profileId, result } | null`
- Add `clearLaunchResult`.
- Update `launchProfile` to call detailed API, set loading markers, and emit success/error toast by `success` and `exitCode`.

### 3) UI output visualization

In profile list UI:

- Show last launch target profile, exit status badge, and stdout/stderr blocks.
- Provide clear action for output state.
- Disable launch button for active profile launch.

### 4) UI consistency fixes

- Profile dialog: reset local form state when `open/profile/shells` changes.
- Framework detection: merge/update by `shellType` instead of replacing all framework results per call.
- Proxy panel: fetch latest proxy env vars on component mount.

## Testing Strategy

- Rust unit tests:
  - shell resolution precedence (detected shell id vs fallback)
  - detailed launch applies cwd
  - env_type/env_version validation behavior
  - compatibility between old/new launch outputs
  - config list contains terminal proxy keys
- Jest tests:
  - `use-terminal` launch status and result state transitions
  - framework detection merge logic
  - profile dialog state reset
  - profile list launch result rendering

## Risks & Mitigations

- **Risk**: environment detection failure for profiles without cwd.
  - **Mitigation**: explicit actionable error (`envVersion` or `cwd` required when `envType` is set).
- **Risk**: shell id mapping regressions.
  - **Mitigation**: detected shell list first, fallback mapping second, test both paths.
- **Risk**: UI state race for repeated launch clicks.
  - **Mitigation**: per-profile launch-in-progress flag and disabled launch buttons.
