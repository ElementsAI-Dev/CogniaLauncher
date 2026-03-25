# Cognia Plugin SDK (TypeScript)

Type-safe TypeScript SDK for building CogniaLauncher WASM plugins.

## Quick Start

```typescript
import { cognia } from '@cognia/plugin-sdk';

function my_tool(): number {
  const input = Host.inputString();

  // Get platform information
  const platform = cognia.platform.info();
  cognia.log.info(`Plugin running on ${platform.os} ${platform.arch}`);

  // Get current locale and translate a greeting
  const greeting = cognia.i18n.translate('greeting', { name: platform.hostname });

  // Return JSON result
  Host.outputString(JSON.stringify({
    greeting,
    platform: platform.os,
    input,
  }));
  return 0;
}

module.exports = { my_tool };
```

## Project Setup

Create a new plugin project using the CogniaLauncher scaffold tool (select "TypeScript"), or manually:

```bash
mkdir my-plugin && cd my-plugin
pnpm init
pnpm add @cognia/plugin-sdk
pnpm add -D @extism/js-pdk esbuild
```

### Unified Contract Scaffold Options

The scaffold now supports unified toolbox contract options through `templateOptions`:

- `includeUnifiedContractSamples`
- `contractTemplate`: `minimal` or `advanced`
- `schemaPreset`: `basic-form`, `multi-step-flow`, `repeatable-collection`
- `includeValidationGuidance`
- `includeStarterTests`

Generated projects can include:

- `contracts/unified-tool-contract.sample.json`
- `schemas/input.schema.json`
- `schemas/output.schema.json`
- `schemas/action-envelope.schema.json`
- `docs/validation-guide.md`

Manifest contract defaults in scaffolded projects:

```toml
[plugin]
tool_contract_version = "1.0.0"
compatible_cognia_versions = ">=0.1.0"
```

### Scaffold Lifecycle and Output Rules

Scaffold behavior is determined by both `language` and `lifecycleProfile`:

| Lifecycle | Language Support | Output Directory Expectation | Next Step |
|---|---|---|---|
| `external` | `rust`, `javascript`, `typescript` | Any writable directory | Build `plugin.wasm`, validate locally, import plugin |
| `builtin` | `rust`, `typescript` | Point to `plugins/` workspace root | Add catalog entry, run checksums, run validate |

Notes:
- `builtin` with `javascript` is rejected.
- For built-ins, do not target `plugins/rust` or `plugins/typescript` directly as output root.

### Scaffold Import-Readiness Contract

Scaffolded projects should be validated before import:

- If `plugin.wasm` is missing, validation returns `buildRequired = true` and blocks import.
- `missingArtifactPath` reports where `plugin.wasm` is expected.
- After build output exists and manifest checks pass, import can proceed.

### Ink Authoring Helpers

The SDK now exposes named Ink authoring helpers for local companions. These
helpers are for preview/testing workflows outside the Extism runtime and do not
change production plugin entrypoints.

Typical authoring flow:

```ts
import {
  buildInkAuthoringSnapshot,
  createInkAuthoringHostAdapter,
} from '@cognia/plugin-sdk';

const adapter = createInkAuthoringHostAdapter({
  pluginId: 'com.example.preview',
  services: {},
  prerequisites: [
    { id: 'node', label: 'Node.js 20+', satisfied: true },
  ],
});

const snapshot = buildInkAuthoringSnapshot({
  pluginId: adapter.pluginId,
  workflowId: 'preview',
  title: 'Preview',
  summary: 'Authoring-only preview',
  preview: { ok: true },
  prerequisites: adapter.prerequisites,
});
```

For maintained examples and built-ins, pair these helpers with an `authoring:ink`
script that launches a local Ink companion through `tsx`.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": [],
    "types": ["@extism/js-pdk"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "node_modules/@cognia/plugin-sdk/cognia.d.ts"]
}
```

### plugin.d.ts

Declare your exported functions:

```typescript
declare module "main" {
  export function my_tool(): I32;
}
```

### Build

```bash
# Bundle TypeScript → CJS with esbuild
pnpm exec esbuild src/index.ts --bundle --outfile=dist/plugin.js --format=cjs --target=es2020

# Install extism-js CLI + binaryen (one-time)
# Windows:
powershell Invoke-WebRequest -Uri https://raw.githubusercontent.com/extism/js-pdk/main/install-windows.ps1 -OutFile install-windows.ps1
powershell -executionpolicy bypass -File .\install-windows.ps1

# Compile to WASM
extism-js dist/plugin.js -i plugin.d.ts -o plugin.wasm
```

If you scaffold from CogniaLauncher templates, you can simply run `pnpm build`
and the generated script will auto-download missing toolchain binaries.

## API Reference

All APIs are accessible via the `cognia` namespace:

```typescript
import { cognia } from '@cognia/plugin-sdk';
```

### cognia.config

| Function | Permission | Description |
|----------|-----------|-------------|
| `get(key)` | config_read | Read a configuration value |
| `set(key, value)` | config_write | Write a configuration value |

### cognia.env

| Function | Permission | Description |
|----------|-----------|-------------|
| `list()` | env_read | List all environment providers |
| `providerList()` | env_read | List all providers with full info |
| `detect(envType)` | env_read | Detect an environment |
| `getCurrent(envType)` | env_read | Get current active version |
| `listVersions(envType)` | env_read | List installed versions |
| `installVersion(envType, version)` | pkg_install | Install a version |
| `setVersion(envType, version)` | pkg_install | Switch to a version |

`providerList()` now returns a typed `ProviderInfo[]` payload:
`{ id, displayName, capabilities, platforms, priority, isEnvironmentProvider, enabled }`.

### cognia.pkg

| Function | Permission | Description |
|----------|-----------|-------------|
| `search(query, provider?)` | pkg_search | Search for packages |
| `info(name, provider?)` | pkg_search | Get package info |
| `versions(name, provider?)` | pkg_search | Get available versions |
| `dependencies(name, version, provider?)` | pkg_search | Get dependencies |
| `listInstalled(provider?)` | pkg_search | List installed packages |
| `checkUpdates(packages, provider)` | pkg_search | Check for updates |
| `install(name, version?, provider?)` | pkg_install | Install a package |
| `uninstall(name, version?, provider?)` | pkg_install | Uninstall a package |

### cognia.fs

| Function | Permission | Description |
|----------|-----------|-------------|
| `read(path)` | fs_read | Read a file |
| `write(path, content)` | fs_write | Write a file |
| `listDir(path)` | fs_read | List directory contents |
| `exists(path)` | fs_read | Check if file exists |
| `remove(path)` | fs_write | Delete a file |
| `mkdir(path)` | fs_write | Create a directory |

### cognia.http

| Function | Permission | Description |
|----------|-----------|-------------|
| `request(input)` | http | Normalized HTTP request (recommended) |
| `get(url)` | http | Compatibility helper for HTTP GET |
| `post(url, body, contentType?)` | http | Compatibility helper for HTTP POST |

### cognia.clipboard

| Function | Permission | Description |
|----------|-----------|-------------|
| `read()` | clipboard | Read clipboard text |
| `write(text)` | clipboard | Write clipboard text |

### cognia.notification

| Function | Permission | Description |
|----------|-----------|-------------|
| `send(title, body)` | notification | Send system notification |

### cognia.ui

Declarative block builders remain available as before. The SDK now also exposes launcher-mediated UI helpers for bounded host effects.

| Function | Permission | Description |
|----------|-----------|-------------|
| `getContext()` | none | Read launcher UI context such as locale/theme/window effect |
| `toast(message, options?)` | ui_feedback | Show in-app feedback through the active launcher window |
| `navigate(path)` | ui_navigation | Navigate to an internal launcher route |
| `confirm(message, options?)` | ui_dialog | Ask the user for confirmation |
| `pickFile(options?)` | ui_file_picker | Open the native file picker |
| `pickDirectory(options?)` | ui_file_picker | Open the native directory picker |
| `saveFile(options?)` | ui_file_picker | Open the native save dialog |
| `openExternal(url)` | ui_navigation | Open an external URL with the host opener |
| `revealPath(path)` | ui_navigation | Reveal or open a path in the host file manager |

Each helper returns a typed result envelope with `status` (`ok`, `cancelled`, `denied`, `unavailable`, `error`) so plugins can handle failures explicitly.

### cognia.process

| Function | Permission | Description |
|----------|-----------|-------------|
| `exec(command, args?, cwd?)` | process_exec | Execute direct process command (legacy-compatible) |
| `exec(command, options)` | process_exec | Execute direct process command with structured options |
| `execShell(command, options?)` | process_exec | Execute command through the host shell |
| `which(command)` | process_exec | Resolve a program on the host PATH |
| `isAvailable(command)` | process_exec | Probe whether a program exists on the host PATH |

```ts
const legacy = cognia.process.exec('node', ['--version'], null);

const structured = cognia.process.exec('node', {
  args: ['--version'],
  cwd: '/workspace/demo',
  env: { DEMO_FLAG: '1' },
  timeoutMs: 2000,
});

const shell = cognia.process.execShell('echo hello', { timeoutMs: 1000 });
const lookup = cognia.process.which('node');
const availability = cognia.process.isAvailable('node');

console.log(legacy.success, structured.exitCode, shell.stdout);
console.log(lookup.path, availability.available);
```

All process helpers require the plugin manifest permission `process_exec`, which maps to the host capability `process.exec`.

### cognia.i18n

| Function | Permission | Description |
|----------|-----------|-------------|
| `getLocale()` | none | Get current locale |
| `translate(key, params?)` | none | Translate a key |
| `t(key)` | none | Shorthand translate |
| `getAll()` | none | Get all locale strings |

### cognia.platform

| Function | Permission | Description |
|----------|-----------|-------------|
| `info()` | none | Get platform info |
| `cacheInfo()` | env_read | Get cache info |

### cognia.log

| Function | Permission | Description |
|----------|-----------|-------------|
| `info(message)` | none | Log info |
| `info({ message, target, fields, tags, correlationId })` | none | Log structured info |
| `warn(message)` | none | Log warning |
| `error(message)` | none | Log error |
| `debug(message)` | none | Log debug |
| `write(record)` | none | Write a structured log record |
| `parseEnvelope(input)` | none | Parse `cognia_on_log` callback envelope |

### cognia.event

| Function | Permission | Description |
|----------|-----------|-------------|
| `emit(name, payload)` | none | Emit an event |
| `emitStr(name, message)` | none | Emit string event |
| `getPluginId()` | none | Get plugin ID |
| `parseEnvelope(input)` | none | Parse `cognia_on_event` callback envelope |

### cognia.ui (declarative)

`cognia.ui.render(blocks)` returns JSON payload for `ui_mode = "declarative"` tools.

| Function | Description |
|----------|-------------|
| `text`, `heading`, `markdown`, `divider`, `alert`, `badge`, `progress`, `code`, `table`, `keyValue` | Display blocks |
| `actions`, `button`, `form`, `group` | Interactive/layout blocks |
| `numberField`, `passwordField`, `radioGroupField`, `switchField`, `dateTimeField`, `multiSelectField` | Extended form field builders |
| `jsonView`, `descriptionList`, `statCards`, `result` | Structured output blocks |
| `tabs`, `accordion`, `copyButton`, `fileInput` | Extended interactive blocks |
| `renderWithState`, `parseAction` | Stateful rendering and action parsing |

#### Action payload contract

`parseAction(input)` returns `UiAction | null`. For compatibility, existing actions are unchanged (`button_click`, `form_submit`, `file_selected`, `tab_change`), and newer runtimes may include normalized metadata:

- `version`: action schema version (for current normalized payloads this is `2`)
- `sourceType`: origin type such as `form`, `actions`, `file-input`, `tabs`, or generic `declarative`
- `sourceId`: source control/block identifier
- `formDataTypes`: map of form field id to field type (on `form_submit`)

Plugins should treat these metadata fields as optional and keep fallback logic for older payloads.

#### Example: Extended declarative form + structured output

```typescript
const blocks = [
  cognia.ui.heading('Build Pipeline', 2),
  cognia.ui.form(
    'build-form',
    [
      cognia.ui.radioGroupField('channel', 'Channel', [
        { label: 'Stable', value: 'stable' },
        { label: 'Canary', value: 'canary' },
      ], 'stable'),
      cognia.ui.numberField('retryCount', 'Retries', { min: 0, max: 5, defaultValue: 1 }),
      cognia.ui.switchField('includePrerelease', 'Include pre-release', false),
      cognia.ui.multiSelectField('targets', 'Targets', [
        { label: 'Node', value: 'node' },
        { label: 'Python', value: 'python' },
      ], ['node']),
      cognia.ui.dateTimeField('scheduleAt', 'Schedule at'),
      cognia.ui.passwordField('token', 'Access token'),
    ],
    'Run'
  ),
  cognia.ui.result('Build completed', 'success', 'Build result'),
  cognia.ui.statCards([
    { id: 'total', label: 'Total', value: 12 },
    { id: 'passed', label: 'Passed', value: 12, status: 'success' },
  ]),
  cognia.ui.jsonView({ artifact: 'plugin.wasm', elapsedMs: 4820 }, 'Output'),
];

Host.outputString(cognia.ui.render(blocks));
```

## Plugin-Point Mapping

Supported plugin-point governance is declared in `plugins/extension-point-matrix.json`.

| Plugin Point | Manifest Contract | Example |
|---|---|---|
| `tool-text` | `[[tools]].entry` |
`plugin-sdk-ts/examples/hello-world` |
| `tool-declarative-ui` | `[[tools]].ui_mode = "declarative"` |
`plugin-sdk-ts/examples/hello-world` |
| `tool-iframe-ui` | `[[tools]].ui_mode = "iframe"` + `[ui].entry` |
`plugins/marketplace/hello-world-ts` |
| `event-listener` | `[plugin].listen_events` + `cognia_on_event` export |
`plugin-sdk-ts/examples/hello-world` |
| `log-listener` | `[plugin].listen_logs` + `cognia_on_log` export |
`plugin-sdk-ts/examples/hello-world` |
| `settings-schema` | `[[settings]]` declarations |
`plugins/rust/file-config-assistant` |

## Built-in Capability Mapping

The built-in plugin workspace and official examples now provide full stable SDK coverage:

| SDK Module(s) | Maintained Usage Path | Path |
|---|---|---|
| `env`, `platform`, `event`, `notification` | Env Provider Audit | `plugins/typescript/env-provider-audit` |
| `pkg`, `clipboard`, `notification`, `event` | Package Update Advisor | `plugins/typescript/pkg-update-advisor` |
| `fs`, `config` | File Config Assistant | `plugins/rust/file-config-assistant` |
| `http` | Local API Workbench | `plugins/typescript/local-api-workbench` |
| `process` | Port Inspector | `plugins/typescript/port-inspector` |
| `batch`, `cache`, `download`, `git`, `health`, `launch`, `profiles`, `shell`, `wsl` | Hello World capability snapshot | `plugin-sdk-ts/examples/hello-world` |
| `i18n`, `log`, `ui` | Hello World / Env Dashboard | `plugin-sdk-ts/examples/hello-world` |

Governance source:

- `plugins/sdk-capability-matrix.json` defines required plugin IDs, expected permissions, and primary entrypoints used by built-in validation.
- `plugins/sdk-usage-inventory.json` defines the full stable SDK capability inventory, permission guidance, maintained usage paths, and toolbox/runtime prerequisite hints.
- `plugins/sdk-usage-inventory.json` can now distinguish `runtime` paths from `ink-authoring` companion paths, including launch commands and local prerequisites.
- `plugins/extension-point-matrix.json` defines officially supported plugin points, prerequisites, SDK coverage, and scaffold support.

## Host Contract Compatibility

The SDK includes an explicit host contract inventory at `host-contract.json` and
an executable parity check:

```bash
pnpm --dir plugin-sdk-ts run check:contract
```

For HTTP calls, `request()` is the recommended stable path. `get()` and `post()`
remain supported as compatibility helpers and map to the same host capability set.

Parity validation also checks the Rust SDK host declarations/wrappers against the same contract inventory.

## Rust SDK Comparison

This TypeScript SDK mirrors the Rust SDK (`plugin-sdk/`) 1:1:

| Rust | TypeScript |
|------|-----------|
| `cognia::env::detect("node")` | `cognia.env.detect("node")` |
| `cognia::pkg::search("express", Some("npm"))` | `cognia.pkg.search("express", "npm")` |
| `cognia::log::info("msg")` | `cognia.log.info("msg")` |
| `cognia::i18n::translate("key", &[("name", "World")])` | `cognia.i18n.translate("key", { name: "World" })` |

## License

MIT
