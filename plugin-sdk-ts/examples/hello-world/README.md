# Hello World Plugin (TypeScript)

A minimal example plugin demonstrating the Cognia TypeScript Plugin SDK.

## Features

- **hello** — Greets the user with platform info and i18n translation
- **env-check** — Detects installed development environments (Node.js, Python, Rust)

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
- `cognia.log.info(msg)` — Write to launcher log
- `cognia.event.emitStr(name, data)` — Emit plugin events
- `cognia.event.getPluginId()` — Get own plugin ID
