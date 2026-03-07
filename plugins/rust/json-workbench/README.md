# JSON Workbench (Rust Built-in Plugin)

Built-in plugin for structured-document validation, conversion, and diffing.

## Tool

- `json-workbench`

## Supported modes

- `validate`
- `prettify`
- `minify`
- `convert`
- `compare`

## Input

```json
{
  "mode": "convert",
  "input": "name: cognia\nports:\n  - 3000\n",
  "inputFormat": "yaml",
  "outputFormat": "json"
}
```

## Output

- Success:
  - `ok: true`
  - `mode`
  - `inputFormat`
  - optional `outputFormat`
  - `normalized`
  - `formatted`, `minified`, or `converted`
  - `comparison` with `differenceSummary` for compare mode
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## Notes

- Supports JSON and YAML payloads.
- Auto-detects input format when `inputFormat` is omitted.
- Compare mode returns structural added/removed/changed counts, not just a boolean.
- No dangerous permissions are required.

## Build

```bash
cargo build --manifest-path plugins/rust/json-workbench/Cargo.toml --release --target wasm32-unknown-unknown
```
