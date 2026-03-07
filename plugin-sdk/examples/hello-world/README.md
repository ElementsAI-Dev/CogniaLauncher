# Hello World Plugin

A minimal example plugin demonstrating the Cognia Plugin SDK.

## Features

- **hello** — Greets the user with platform info and i18n translation
- **env-check** — Detects installed development environments (Node.js, Python, Rust)
- **env-dashboard** — Declarative dashboard with:
  - Extended input fields (`radio-group`, `number`, `switch`, `multi-select`, `date-time`, `password`)
  - Structured output blocks (`result`, `stat-cards`, `description-list`, `json-view`)
  - Action payload metadata handling (`version`, `sourceType`, `sourceId`, `formDataTypes`)

## Unified Contract Notes

For strict-mode-ready plugins, keep the manifest contract metadata and capability declarations aligned:

```toml
[plugin]
tool_contract_version = "1.0.0"
compatible_cognia_versions = ">=0.1.0"

[[tools]]
ui_mode = "declarative"
capabilities = ["environment.read", "process.exec"]
```

When scaffolded with unified templates, the project also includes schema + guidance files under `contracts/`, `schemas/`, and `docs/validation-guide.md`.

## Build

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/cognia_hello_world.wasm plugin.wasm
```

## Install

Copy this directory into CogniaLauncher's plugins folder, or use the "Install Plugin" button in Toolbox > Plugins.

## SDK APIs Used

- `cognia::platform::info()` — Get OS, arch, hostname
- `cognia::i18n::translate(key, params)` — Localized strings with interpolation
- `cognia::env::detect(env_type)` — Check if Node/Python/Rust is installed
- `cognia::log::info(msg)` — Write to launcher log
- `cognia::event::emit_str(name, data)` — Emit plugin events
- `cognia::event::get_plugin_id()` — Get own plugin ID
- `cognia_plugin_sdk::ui::*` — Declarative UI builders, including extended form/output blocks and action parsing
