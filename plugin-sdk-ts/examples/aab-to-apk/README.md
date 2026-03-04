# AAB to APK Plugin (TypeScript)

Convert Android App Bundles (`.aab`) to a universal APK using `bundletool`.

## What this plugin does

- Calls `java -jar bundletool.jar build-apks --mode=universal`
- Extracts `universal.apk` from the generated `.apks` archive
- Copies it to your target output path

## Requirements

- Java installed (`java` available in PATH, or pass `javaPath`)
- `bundletool` jar file available
- Plugin permission `process_exec` must be granted in CogniaLauncher plugin settings

## Build

```bash
pnpm install --filter cognia-aab-to-apk-plugin
pnpm --filter cognia-aab-to-apk-plugin build
```

## Plugin input

### Quick mode

Input plain text path:

```text
D:/android/app-release.aab
```

### JSON mode (recommended)

```json
{
  "aabPath": "D:/android/app-release.aab",
  "bundletoolJarPath": "D:/tools/bundletool-all-1.17.2.jar",
  "outputApkPath": "D:/android/app-universal.apk",
  "javaPath": "java",
  "overwrite": true,
  "cleanup": true
}
```

### Optional signing args

If your workflow requires explicit signing in `bundletool build-apks`, provide:

- `ksPath`
- `ksPass` (raw password or `pass:...` / `file:...` / `env:...`)
- `ksKeyAlias`
- `keyPass`

## Output

On success returns JSON like:

```json
{
  "ok": true,
  "message": "AAB converted to universal APK successfully.",
  "apkPath": "D:/android/app-universal.apk"
}
```

## Notes

- Each host process call has a 60s timeout in current plugin runtime.
- On Windows, archive extraction uses `powershell`/`pwsh`.
- On Linux/macOS, archive extraction uses `unzip`.
