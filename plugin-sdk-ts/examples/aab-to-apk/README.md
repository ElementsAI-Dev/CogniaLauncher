# AAB to APK Plugin (TypeScript)

Convert Android App Bundles (`.aab`) to universal APK with preflight checks, structured diagnostics, and configurable artifact policy.

## What this plugin does

- Supports two operations:
  - `preflight`: validate Java, bundletool, AAB path, output directory writability, and signing field consistency.
  - `convert`: run `bundletool build-apks --mode=universal`, extract `universal.apk`, and produce deterministic output artifacts.
- Returns machine-readable diagnostics:
  - `checks[]` for preflight
  - `steps[]` for conversion command execution
  - `errorCode` and `recommendations[]` on failure
- Redacts secret-like signing values in diagnostics (`ksPass`, `keyPass`).

## Requirements

- Java installed (`java` available in PATH, or pass `javaPath`)
- bundletool jar available (`bundletoolJarPath`)
- Plugin permission `process_exec` enabled in CogniaLauncher
- Host utilities:
  - Windows: `powershell` or `pwsh`
  - Linux/macOS: `unzip`, `find`, `cp`, `rm`, `mkdir`, `sh`

## Build

```bash
pnpm install --filter cognia-aab-to-apk-plugin
pnpm --filter cognia-aab-to-apk-plugin build
```

Build output includes phase markers:
- `[build][aab-to-apk][preflight]`
- `[build][aab-to-apk][bundle]`
- `[build][aab-to-apk][wasm-compile]`

## Input contract

### Quick mode (backward compatible)

Provide a plain `.aab` path:

```text
D:/android/app-release.aab
```

Equivalent to JSON:

```json
{
  "operation": "convert",
  "aabPath": "D:/android/app-release.aab"
}
```

### JSON mode

#### Preflight

```json
{
  "operation": "preflight",
  "aabPath": "D:/android/app-release.aab",
  "outputApkPath": "D:/android/app-universal.apk",
  "bundletoolJarPath": "D:/tools/bundletool-all-1.17.2.jar",
  "javaPath": "java"
}
```

#### Convert (advanced options)

```json
{
  "operation": "convert",
  "aabPath": "D:/android/app-release.aab",
  "outputApkPath": "D:/android/out/app-universal.apk",
  "outputApksPath": "D:/android/out/app-universal.apks",
  "extractDirPath": "D:/android/out/app-universal-extract",
  "bundletoolJarPath": "D:/tools/bundletool-all-1.17.2.jar",
  "javaPath": "java",
  "mode": "universal",
  "overwrite": true,
  "cleanup": true,
  "keepApks": false,
  "keepExtracted": false
}
```

### Signing fields (optional)

When signing fields are used, `ksPath`, `ksPass`, and `ksKeyAlias` are required together.

- `ksPath`: keystore file path
- `ksPass`: keystore password (`pass:...`, `env:...`, `file:...`, or raw password)
- `ksKeyAlias`: key alias in keystore
- `keyPass`: key password (optional; defaults to keystore password behavior if not provided by bundletool)

## Output schema

### Success (`preflight`)

```json
{
  "ok": true,
  "operation": "preflight",
  "message": "Preflight checks passed.",
  "checks": [
    { "id": "java-runtime", "ok": true },
    { "id": "bundletool-runtime", "ok": true }
  ]
}
```

### Success (`convert`)

```json
{
  "ok": true,
  "operation": "convert",
  "message": "AAB converted to universal APK successfully.",
  "apkPath": "D:/android/out/app-universal.apk",
  "steps": [
    { "step": "build-apks", "exitCode": 0 },
    { "step": "extract-apks-archive", "exitCode": 0 },
    { "step": "copy-apk", "exitCode": 0 }
  ]
}
```

### Failure example

```json
{
  "ok": false,
  "operation": "convert",
  "errorCode": "JAVA_NOT_FOUND",
  "message": "Preflight checks failed. Conversion aborted before build execution.",
  "recommendations": ["Install Java or set javaPath to a valid executable."]
}
```

## Troubleshooting

- `JAVA_NOT_FOUND`: verify Java installation and `javaPath`.
- `BUNDLETOOL_NOT_FOUND`: verify `bundletoolJarPath` and jar readability.
- `AAB_NOT_FOUND`: verify `aabPath`.
- `OUTPUT_NOT_WRITABLE`: verify output directory permissions.
- `SIGNING_CONFIG_INVALID`: ensure signing fields are consistent.
- `OUTPUT_EXISTS`: set `overwrite: true` or use a new output path.
- `BUNDLE_SPAWN_PERMISSION_DENIED`: process launch was blocked (for example `spawn EPERM` under restricted/sandboxed shells).
  - Re-run in a non-restricted shell or allow escalated command execution.
- `WASM_COMPILE_EXECUTABLE_NOT_FOUND`: `extism-js` could not be launched.
  - Set `EXTISM_JS_PATH` to a valid local executable or run `pnpm setup:toolchain`.

## Notes

- Plugin host process execution currently has per-command timeout constraints.
- On Windows, PowerShell fallback chain is `powershell` then `pwsh`.
- Sensitive signing values are redacted in diagnostics and command snapshots.
