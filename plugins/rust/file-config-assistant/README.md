# File Config Assistant (Rust Built-in Plugin)

Production built-in plugin for profile file lifecycle and active-profile pointer management.

## Tool

- `file-config-assistant`
- `file-config-assistant-guided`

## Workflow Split

- `file-config-assistant`: automation-safe text entrypoint for explicit action JSON.
- `file-config-assistant-guided`: declarative Toolbox workflow for profile actions, staged summaries, exportable outputs, and partial-success handling when a later config pointer update fails after file mutation succeeds.

## Input

```json
{
  "action": "write_profile",
  "profileId": "default",
  "content": "{\"region\":\"us\"}",
  "setActive": true
}
```

Supported actions:

- `list_profiles`
- `read_profile`
- `write_profile`
- `delete_profile`
- `set_active_profile`
- `get_active_profile`

The guided entrypoint renders these same actions through declarative form state instead of requiring raw JSON input.

## Output

- Success:
  - `ok: true`
  - `action`
  - optional `profiles`
  - optional `profileId`
  - optional `content`
  - optional `activeProfileId`
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## SDK Coverage

- `cognia::fs`: profile file CRUD in plugin workspace
- `cognia::config`: active profile pointer read/write

The guided workflow treats file mutation as the first successful stage and keeps that result visible even if a later config pointer update is blocked.

## Build

```bash
cargo build --manifest-path plugins/rust/file-config-assistant/Cargo.toml --release --target wasm32-unknown-unknown
```
