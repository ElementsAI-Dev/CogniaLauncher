# Semver Inspector (Rust Built-in Plugin)

Production built-in plugin for release and dependency version-policy checks.

## Tool

- `semver-inspect`

## Input

```json
{
  "currentVersion": "1.5.0",
  "requirement": "^1.4.0",
  "candidateVersion": "2.0.0"
}
```

## Output

- Success:
  - `ok: true`
  - `currentMatches`
  - optional `candidateMatches`
  - optional `candidateImpact`
  - `recommendationSummary`
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## Notes

- Candidate impact is classified into practical outcomes such as `compatible-upgrade`, `compatible-downgrade`, `no-change`, `out-of-range`, or `breaking-change`.
- Helps explain why a version satisfies or violates the declared semver range.

## Build

```bash
cargo build --manifest-path plugins/rust/semver-inspector/Cargo.toml --release --target wasm32-unknown-unknown
```
