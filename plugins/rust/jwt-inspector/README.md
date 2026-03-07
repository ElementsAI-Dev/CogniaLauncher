# JWT Inspector (Rust Built-in Plugin)

Built-in plugin for decoding JWT content, inspecting claim timing, and optionally verifying shared-secret signatures offline.

## Tool

- `jwt-inspect`

## Input

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
  "nowEpochSeconds": 1950000000,
  "verification": {
    "sharedSecret": "secret"
  }
}
```

## Output

- Success:
  - `ok: true`
  - `header`
  - `payload`
  - `issuedAt`, `notBefore`, `expiresAt`
  - `isExpired`, `isActive`
  - `verification`
  - `trustEstablished`
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## Notes

- Decode-only mode stays explicit: the result says when signature trust was not established.
- Offline verification currently supports HMAC shared-secret JWTs (`HS256`, `HS384`, `HS512`).
- No dangerous permissions are required.

## Build

```bash
cargo build --manifest-path plugins/rust/jwt-inspector/Cargo.toml --release --target wasm32-unknown-unknown
```
