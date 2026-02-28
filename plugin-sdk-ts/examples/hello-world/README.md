# Hello World Plugin (TypeScript)

A minimal example plugin demonstrating the Cognia TypeScript Plugin SDK.

## Features

- **hello** — Greets the user with platform info and i18n translation
- **env-check** — Detects installed development environments (Node.js, Python, Rust)

## Build

```bash
pnpm install
pnpm build
```

## Install

Copy this directory into CogniaLauncher's plugins folder, or use the "Install Plugin" button in Toolbox > Plugins.

## SDK APIs Used

- `cognia.platform.info()` — Get OS, arch, hostname
- `cognia.i18n.translate(key, params)` — Localized strings with interpolation
- `cognia.env.detect(envType)` — Check if Node/Python/Rust is installed
- `cognia.log.info(msg)` — Write to launcher log
- `cognia.event.emitStr(name, data)` — Emit plugin events
- `cognia.event.getPluginId()` — Get own plugin ID
