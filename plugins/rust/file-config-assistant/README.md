# File Config Assistant (Rust Built-in Plugin)

Production built-in plugin for profile file lifecycle and active-profile pointer management.

## Tool

- `file-config-assistant`

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

## Build

```bash
cargo build --manifest-path plugins/rust/file-config-assistant/Cargo.toml --release --target wasm32-unknown-unknown
```
