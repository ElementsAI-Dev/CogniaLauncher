# Change: Update WSL management completeness

## Why

Current WSL management in CogniaLauncher already contains substantial backend functionality, but it has three gaps:

- Capability mismatch: newer `wsl --manage` features are not consistently surfaced and cannot be reliably gated by runtime support.
- UX mismatch: several implemented backend actions are not connected to UI workflows, leaving advanced operations inaccessible.
- Robustness mismatch: command parsing and high-risk workflows need stronger locale compatibility and safety guarantees.

The goal is to make WSL management feature-complete, capability-aware, and safe-by-default while preserving compatibility through graceful downgrade paths.

## What Changes

- Introduce runtime WSL capability detection and expose it through dedicated command/API (`wsl_get_capabilities`).
- Expand WSL command surface with `wsl_move_distro` and `wsl_resize_distro`, and extend mount options support.
- Improve command compatibility and output parsing:
  - Prefer `wsl --list --running --quiet` for running distro detection.
  - Keep locale-safe parsing fallback behavior for multilingual output.
  - Prefer `wsl --manage <distro> --set-default-user` and fall back automatically when unsupported.
- Connect existing but unexposed WSL features in UI:
  - install WSL-only flow
  - set default WSL version
  - import-in-place
  - mount/unmount operations
  - sparse VHD toggles
- Add unified high-risk operation safeguards across WSL actions:
  - explicit confirmations
  - risk/admin hinting
  - actionable error feedback.
- Update WSL docs and i18n strings to reflect capability gating and operation requirements.

## Impact

- Affected specs: `wsl-management` (new capability spec)
- Affected backend:
  - `src-tauri/src/provider/wsl.rs`
  - `src-tauri/src/commands/wsl.rs`
  - `src-tauri/src/lib.rs`
- Affected frontend:
  - `types/tauri.ts`
  - `lib/tauri.ts`
  - `hooks/use-wsl.ts`
  - `app/wsl/page.tsx`
  - `components/wsl/*`
- Affected docs/i18n:
  - `docs/guide/wsl.md`
  - `messages/en.json`
  - `messages/zh.json`
