# Tasks: Update WSL management completeness

## 1. Specification

- [x] 1.1 Add `wsl-management` capability spec delta with capability gating, safeguards, and compatibility requirements.
- [x] 1.2 Validate change with `openspec validate update-wsl-management-completeness --strict`.

## 2. Backend command and provider updates

- [x] 2.1 Add `WslCapabilities` detection in provider, with parsing from `wsl --help` and `wsl --version`.
- [x] 2.2 Fix running distro detection to prefer `--running --quiet` and fallback safely.
- [x] 2.3 Add provider operations for `move` and `resize` manage commands.
- [x] 2.4 Update default-user change flow to prefer `--manage --set-default-user` with fallback.
- [x] 2.5 Add mount `--options` argument support in provider + commands.

## 3. Tauri command surface and TypeScript API/types

- [x] 3.1 Add Tauri commands: `wsl_get_capabilities`, `wsl_move_distro`, `wsl_resize_distro`.
- [x] 3.2 Register newly added WSL commands in Tauri invoke handler exports.
- [x] 3.3 Update TS types and invoke wrappers for capabilities, resize, move, and mount options.
- [x] 3.4 Extend `useWsl` hook state/actions for new APIs.

## 4. WSL UI completeness and safeguards

- [x] 4.1 Wire not-available page install flow (`installWslOnly`).
- [x] 4.2 Add advanced operations UI for default version, import-in-place, mount/unmount, sparse, move, resize.
- [x] 4.3 Gate advanced controls by capabilities with clear unsupported reasons.
- [x] 4.4 Add high-risk confirmation and warning UX for destructive/risky operations.

## 5. Docs, i18n, and validation

- [x] 5.1 Update `messages/en.json` and `messages/zh.json` for new WSL actions and capability hints.
- [x] 5.2 Update `docs/guide/wsl.md` with capability requirements and compatibility behavior.
- [x] 5.3 Add/extend Rust and Jest tests for capability parsing, fallback behavior, and UI wiring.
- [x] 5.4 Run targeted and regression validations for WSL backend/frontend tests.
