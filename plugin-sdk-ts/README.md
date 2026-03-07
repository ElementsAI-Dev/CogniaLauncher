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
| `get(url)` | http | HTTP GET request |
| `post(url, body, contentType?)` | http | HTTP POST request |

### cognia.clipboard

| Function | Permission | Description |
|----------|-----------|-------------|
| `read()` | clipboard | Read clipboard text |
| `write(text)` | clipboard | Write clipboard text |

### cognia.notification

| Function | Permission | Description |
|----------|-----------|-------------|
| `send(title, body)` | notification | Send system notification |

### cognia.process

| Function | Permission | Description |
|----------|-----------|-------------|
| `exec(command, args?, cwd?)` | process_exec | Execute shell command |

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
| `warn(message)` | none | Log warning |
| `error(message)` | none | Log error |
| `debug(message)` | none | Log debug |

### cognia.event

| Function | Permission | Description |
|----------|-----------|-------------|
| `emit(name, payload)` | none | Emit an event |
| `emitStr(name, message)` | none | Emit string event |
| `getPluginId()` | none | Get plugin ID |

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
