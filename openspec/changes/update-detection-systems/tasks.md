# Tasks: Update detection systems

## 1. Specification

- [x] 1.1 Add spec deltas for provider visibility and health checks (`provider-system`).
- [x] 1.2 Add spec deltas for project-file-driven environment detection and field semantics (`environment-management`).
- [x] 1.3 Add spec deltas for UI expectations (providers pages + environment detection display) (`ui-interface`).
- [x] 1.4 Run `openspec validate update-detection-systems --strict`.

## 2. Provider / Package manager detection

- [x] 2.1 Register all known providers regardless of install state (platform-filtered), preserving `enabled` as a separate control.
- [x] 2.2 Ensure `provider_list` and `/providers` can enumerate all providers (installed or not).
- [x] 2.3 Make `provider_check` and `provider_status_all` reflect true installation/availability (not `enabled`).
- [x] 2.4 Expand package-manager health checks to include all system-capable package providers and fill version/path/instructions where available.
- [x] 2.5 Provide a single-provider health endpoint for provider detail pages.

## 3. Project environment version detection

- [x] 3.1 Implement a project-file detector that traverses upward and detects versions by env type (node/python/go/rust/dotnet/deno/bun), including `.tool-versions`.
- [x] 3.2 Implement correct precedence rules (e.g., `go.mod toolchain` over `go`, rustup toolchain file precedence, `global.json sdk.version`).
- [x] 3.3 Strictly avoid misleading sources (e.g., do not treat `deno.json` `"version"` as runtime).
- [x] 3.4 Wire `env_detect` / `env_detect_all` to use the detector and respect `detection_files` settings (fallback to defaults).
- [x] 3.5 Add Rust unit tests for detection behavior and source labels.

## 4. Frontend alignment

- [x] 4.1 Align `DEFAULT_DETECTION_FILES` with supported concrete sources and safe defaults.
- [x] 4.2 Ensure frontend expects logical `env_type` and concrete `source` labels (types/tests/store).
- [x] 4.3 Use single-provider health endpoint in provider detail to reduce overhead.
- [x] 4.4 Run `pnpm lint` and `pnpm test` and fix any regressions related to these changes.
