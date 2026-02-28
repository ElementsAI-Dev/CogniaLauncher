# Hello World Plugin

A minimal example plugin demonstrating the Cognia Plugin SDK.

## Features

- **hello** — Greets the user with platform info and i18n translation
- **env-check** — Detects installed development environments (Node.js, Python, Rust)

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
