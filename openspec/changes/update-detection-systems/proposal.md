# Change: Update detection systems (providers + project environments)

## Why

The current detection behavior is incomplete and inconsistent with the UI and types:

- Provider registry visibility is coupled to `is_available()`, so many known providers do not appear unless installed. This breaks `/providers` completeness and can break static `/providers/[id]` generation.
- Provider status and package-manager health checks only cover a subset of providers and often cannot return real version/path details.
- Project environment version detection is currently provider-driven and returns provider IDs as `env_type`, while `source` is an abstract enum label. This prevents reliable UI display and causes missed detections when a different version manager is installed (e.g., Volta installed but project uses `.nvmrc`).
- Some detection sources are misleading (e.g., treating `deno.json` `"version"` as a runtime version) and must be avoided.

## What Changes

- Decouple provider registration from availability: all known providers are registered (platform-filtered) and always visible; availability becomes a status/health field.
- Expand provider status and health checks to cover all system-capable package providers and fill `version`, `executable_path`, and `install_instructions` when supported.
- Rework project environment version detection to be **project-file driven** and **independent of the installed provider**, with:
  - `env_type` = logical environment type (`node`, `python`, `go`, `rust`, ...).
  - `source` = concrete source label (e.g., `.nvmrc`, `global.json (sdk.version)`).
  - strict avoidance of incorrect sources like `deno.json` package `"version"`.
- Respect user settings for enabled detection sources (`detection_files`) with safe defaults (enable first two sources for each env type).

## Impact

- Affected specs: `provider-system`, `environment-management`, `ui-interface`
- Affected code: `src-tauri/src/provider/registry.rs`, `src-tauri/src/core/health_check.rs`,
  `src-tauri/src/core/environment.rs`, `src-tauri/src/commands/*`, `lib/constants/environments.ts`,
  provider/environment UI and tests.

