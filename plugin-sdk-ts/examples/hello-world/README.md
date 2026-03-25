# Hello World Plugin (TypeScript)

A minimal example plugin demonstrating the Cognia TypeScript Plugin SDK.

## Features

- **hello** — Greets the user with platform info and i18n translation
- **env-check** — Detects installed development environments (Node.js, Python, Rust)
- **env-dashboard** — Declarative UI dashboard with actions, structured blocks, and launcher-mediated feedback
- **custom-view** — iframe-backed UI sample using the plugin HTML bridge
- **capability-snapshot** — Read-only snapshot across advanced SDK capability families such as batch, cache, download, git, health, launch, profiles, shell, and WSL
- **cognia_on_log** — Observes plugin-origin log envelopes via `listen_logs = ["plugin"]`

## Unified Contract Notes

For strict-mode adoption, align plugin contract metadata and capability declarations:

```toml
[plugin]
tool_contract_version = "1.0.0"
compatible_cognia_versions = ">=0.1.0"

[[tools]]
ui_mode = "declarative"
capabilities = ["environment.read", "process.exec"]
```

If created with scaffold template options, you also get contract and schema references in:
- `contracts/unified-tool-contract.sample.json`
- `schemas/*.json`
- `docs/validation-guide.md`

## Build

```bash
pnpm install
# Optional: pre-download extism-js + binaryen into .tools/
pnpm setup:toolchain

# Build plugin.wasm (auto-downloads required toolchain if missing)
pnpm build
```

If your environment cannot access GitHub directly, you can provide local tool paths:

```bash
EXTISM_JS_PATH=/path/to/extism-js BINARYEN_BIN=/path/to/binaryen/bin pnpm build
```

Or use mirror URLs:

```bash
EXTISM_JS_URL=https://mirror.example.com/extism-js.gz BINARYEN_URL=https://mirror.example.com/binaryen.tar.gz pnpm build
```

Build output now includes phase markers:
- `[build][hello-world][preflight]`
- `[build][hello-world][bundle]`
- `[build][hello-world][wasm-compile]`

## Ink Authoring Preview

The maintained authoring companion uses the SDK Ink helpers to preview the
`hello` workflow without changing the production WASM entrypoints.

```bash
pnpm authoring:ink -- Trainer
```

This preview is local-authoring only. It does not change `plugin.toml`,
`plugin.d.ts`, or the runtime tool contract used by Launcher.

## Troubleshooting

- `BUNDLE_SCRIPT_NOT_FOUND`: `esbuild.config.mjs` is missing or renamed.
- `OUTPUT_NOT_WRITABLE`: plugin folder or `dist/` is not writable.
- `BUNDLE_SPAWN_PERMISSION_DENIED`: host sandbox/security policy blocked process spawn (often shows `spawn EPERM`).
  - Run build in a non-restricted shell or allow escalated permissions for the command.
- `WASM_COMPILE_EXECUTABLE_NOT_FOUND`: `extism-js` is not available.
  - Set `EXTISM_JS_PATH` or run `pnpm setup:toolchain`.

## Install

Copy this directory into CogniaLauncher's plugins folder, or use the "Install Plugin" button in Toolbox > Plugins.

## SDK APIs Used

- `cognia.platform.info()` — Get OS, arch, hostname
- `cognia.i18n.translate(key, params)` — Localized strings with interpolation
- `cognia.env.detect(envType)` — Check if Node/Python/Rust is installed
- `cognia.ui.*` — Declarative builders, action parsing, and launcher-mediated feedback helpers
- `cognia.log.info(msg)` — Write to launcher log
- `cognia.log.write(record)` — Write a structured log record
- `cognia.log.parseEnvelope(input)` — Parse `cognia_on_log` listener payloads
- `cognia.event.emitStr(name, data)` — Emit plugin events
- `cognia.event.getPluginId()` — Get own plugin ID
- `cognia.event.parseEnvelope(input)` — Parse `cognia_on_event` listener payloads
- `cognia.batch.*` — Package-history and pinned-package snapshot helpers
- `cognia.cache.*` — Cache details, access stats, and external cache discovery
- `cognia.download.*` — Download queue and history stats
- `cognia.git.*` — Read-only Git availability and version checks
- `cognia.health.*` — Package-manager health reporting
- `cognia.launch.*` — Environment activation metadata and program resolution
- `cognia.profiles.*` — Environment profile listing
- `cognia.shell.*` — Shell detection and default-profile metadata
- `cognia.wsl.*` — WSL availability and status snapshot
