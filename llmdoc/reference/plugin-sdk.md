# Plugin SDK Reference

Complete reference for CogniaLauncher's WASM plugin SDK. Plugins are compiled to WebAssembly and run in an Extism sandbox with capability-based permissions. Both Rust and TypeScript SDKs are provided.

## Plugin Structure

```text
my-plugin/
├── plugin.toml          # Manifest (required)
├── plugin.wasm          # Compiled WASM binary (required)
└── locales/             # Optional i18n files
    ├── en.json
    └── zh.json
```

## SDKs

- **Rust SDK**: `plugin-sdk/` — type-safe wrappers via `cognia::` namespace, `use cognia_plugin_sdk::prelude::*;`
- **TypeScript SDK**: `plugin-sdk-ts/` — mirrors Rust 1:1 via `cognia.` namespace, `import { cognia } from '@cognia/plugin-sdk';`
- **Scaffold**: Use "Create Plugin" in Toolbox > Plugins, or call `plugin_scaffold` command

## Manifest (`plugin.toml`)

```toml
[plugin]
id = "com.example.my-plugin"
name = "My Plugin"
version = "1.0.0"
description = "A sample plugin"
authors = ["Author Name"]

[[tools]]
id = "my-tool"
name_en = "My Tool"
name_zh = "我的工具"
description_en = "Does something useful"
description_zh = "做一些有用的事情"
category = "developer"
keywords = ["sample"]
icon = "Wrench"
entry = "run_my_tool"

[permissions]
config_read = true
env_read = true
pkg_search = true
# Dangerous (require explicit user grant):
# config_write = true
# pkg_install = true
# process_exec = true

[locales.en]
greeting = "Hello, {name}!"

[locales.zh]
greeting = "你好，{name}！"
```

## Permissions

| Permission | Auto-granted | Description |
|---|---|---|
| `config_read` | ✅ | Read application configuration |
| `config_write` | ❌ (dangerous) | Write application configuration |
| `env_read` | ✅ | Read environment/provider info |
| `pkg_search` | ✅ | Search packages, get info/versions/deps |
| `pkg_install` | ❌ (dangerous) | Install/uninstall packages, switch env versions |
| `clipboard` | ✅ | Read/write system clipboard |
| `notification` | ✅ | Send system notifications |
| `fs_read` | ✅ (if paths declared) | Read files in plugin data dir |
| `fs_write` | ✅ (if paths declared) | Write files in plugin data dir |
| `http` | ✅ (if domains declared) | HTTP GET/POST to declared domains |
| `process_exec` | ❌ (dangerous) | Execute shell commands |

## Host Functions (35 total)

All host functions use JSON string I/O. Import them in your WASM module as `cognia_*`.

### Configuration

#### `cognia_config_get`

- **Permission**: `config_read`
- **Input**: `{ "key": "some.config.key" }`
- **Output**: `{ "value": "..." }` or `{ "value": null }`

#### `cognia_config_set`

- **Permission**: `config_write`
- **Input**: `{ "key": "...", "value": "..." }`
- **Output**: `{ "ok": true }`

### Environment Detection

#### `cognia_env_list`

- **Permission**: `env_read`
- **Input**: `""`
- **Output**: `[{ "id": "fnm", "display_name": "Fast Node Manager" }, ...]`

#### `cognia_provider_list`

- **Permission**: `env_read`
- **Input**: `""`
- **Output**: JSON array of ProviderInfo objects

#### `cognia_env_detect`

- **Permission**: `env_read`
- **Input**: `{ "envType": "node" }`
- **Output**: `{ "available": true, "currentVersion": "20.0.0", "installedVersions": ["18.0.0", "20.0.0"] }`

#### `cognia_env_get_current`

- **Permission**: `env_read`
- **Input**: `{ "envType": "node" }`
- **Output**: `{ "version": "20.0.0" }` or `{ "version": null }`

#### `cognia_env_list_versions`

- **Permission**: `env_read`
- **Input**: `{ "envType": "node" }`
- **Output**: `[{ "version": "20.0.0", "current": true }, { "version": "18.0.0", "current": false }]`

#### `cognia_env_install_version`

- **Permission**: `pkg_install`
- **Input**: `{ "envType": "node", "version": "20.0.0" }`
- **Output**: `{ "ok": true }`

#### `cognia_env_set_version`

- **Permission**: `pkg_install`
- **Input**: `{ "envType": "node", "version": "20.0.0" }`
- **Output**: `{ "ok": true }`

### Package Management

#### `cognia_pkg_search`

- **Permission**: `pkg_search`
- **Input**: `{ "query": "express", "provider": "npm" }` (provider optional)
- **Output**: JSON array of PackageSummary

#### `cognia_pkg_info`

- **Permission**: `pkg_search`
- **Input**: `{ "name": "express", "provider": "npm" }` (provider optional)
- **Output**: JSON PackageInfo

#### `cognia_pkg_versions`

- **Permission**: `pkg_search`
- **Input**: `{ "name": "express", "provider": "npm" }`
- **Output**: JSON array of VersionInfo

#### `cognia_pkg_dependencies`

- **Permission**: `pkg_search`
- **Input**: `{ "name": "express", "version": "4.18.0", "provider": "npm" }`
- **Output**: JSON array of Dependency

#### `cognia_pkg_list_installed`

- **Permission**: `pkg_search`
- **Input**: `{ "provider": "npm" }` (provider optional)
- **Output**: JSON array of InstalledPackage

#### `cognia_pkg_check_updates`

- **Permission**: `pkg_search`
- **Input**: `{ "packages": ["express", "lodash"], "provider": "npm" }`
- **Output**: JSON array of UpdateInfo

#### `cognia_pkg_install`

- **Permission**: `pkg_install`
- **Input**: `{ "name": "express", "version": null, "provider": "npm" }`
- **Output**: JSON InstallReceipt

#### `cognia_pkg_uninstall`

- **Permission**: `pkg_install`
- **Input**: `{ "name": "express", "version": null, "provider": "npm" }`
- **Output**: `{ "ok": true }`

### File System (sandboxed to plugin data dir)

#### `cognia_fs_read`

- **Permission**: `fs_read`
- **Input**: `{ "path": "relative/file.txt" }`
- **Output**: file contents as string

#### `cognia_fs_write`

- **Permission**: `fs_write`
- **Input**: `{ "path": "relative/file.txt", "content": "..." }`
- **Output**: `{ "ok": true }`

#### `cognia_fs_list_dir`

- **Permission**: `fs_read`
- **Input**: `{ "path": "relative/dir" }`
- **Output**: `[{ "name": "file.txt", "isDir": false, "size": 1024 }, ...]`

#### `cognia_fs_exists`

- **Permission**: `fs_read`
- **Input**: `{ "path": "relative/file.txt" }`
- **Output**: `{ "exists": true, "isDir": false }`

#### `cognia_fs_delete`

- **Permission**: `fs_write`
- **Input**: `{ "path": "relative/file.txt" }`
- **Output**: `{ "ok": true }`

#### `cognia_fs_mkdir`

- **Permission**: `fs_write`
- **Input**: `{ "path": "relative/dir" }`
- **Output**: `{ "ok": true }`

### HTTP (restricted to declared domains)

#### `cognia_http_get`

- **Permission**: `http` + domain allowlist
- **Input**: `{ "url": "https://api.example.com/data" }`
- **Output**: `{ "status": 200, "body": "..." }`

#### `cognia_http_post`

- **Permission**: `http` + domain allowlist
- **Input**: `{ "url": "https://api.example.com/data", "body": "{...}", "contentType": "application/json" }`
- **Output**: `{ "status": 200, "body": "..." }`

### Clipboard

#### `cognia_clipboard_read`

- **Permission**: `clipboard`
- **Input**: `""`
- **Output**: `{ "text": "clipboard contents" }`

#### `cognia_clipboard_write`

- **Permission**: `clipboard`
- **Input**: `{ "text": "text to copy" }`
- **Output**: `{ "ok": true }`

### Notifications

#### `cognia_notification_send`

- **Permission**: `notification`
- **Input**: `{ "title": "Update Available", "body": "Version 2.0 is ready" }`
- **Output**: `{ "ok": true }`

### Process Execution

#### `cognia_process_exec`

- **Permission**: `process_exec` (dangerous, not auto-granted)
- **Input**: `{ "command": "node", "args": ["--version"], "cwd": null }`
- **Output**: `{ "exitCode": 0, "stdout": "v20.0.0\n", "stderr": "" }`
- **Timeout**: 60 seconds

### i18n

#### `cognia_get_locale`

- **Permission**: none (always allowed)
- **Input**: `""`
- **Output**: `{ "locale": "en" }`

#### `cognia_i18n_translate`

- **Permission**: none (always allowed)
- **Input**: `{ "key": "greeting", "params": { "name": "World" } }`
- **Output**: `{ "text": "Hello, World!" }`
- **Fallback**: current locale → `en` → raw key

#### `cognia_i18n_get_all`

- **Permission**: none (always allowed)
- **Input**: `""`
- **Output**: `{ "locale": "en", "strings": { "greeting": "Hello, {name}!", ... } }`

### Platform & System

#### `cognia_platform_info`

- **Permission**: none (always allowed)
- **Input**: `""`
- **Output**: `{ "os": "windows", "arch": "x86_64", "hostname": "...", "osVersion": "..." }`

#### `cognia_cache_info`

- **Permission**: `env_read`
- **Input**: `""`
- **Output**: `{ "cacheDir": "...", "totalSize": 1048576, "totalSizeHuman": "1.0 MB" }`

### Logging

#### `cognia_log`

- **Permission**: none (always allowed)
- **Input**: `{ "level": "info", "message": "Something happened" }`
- **Output**: `{ "ok": true }`
- **Levels**: `error`, `warn`, `info`, `debug`

## i18n for Plugins

Plugins can provide translations in two ways:

1. **Inline in manifest** via `[locales.en]` / `[locales.zh]` sections
2. **Separate files** in `locales/en.json`, `locales/zh.json` (loaded automatically on discovery)

### From WASM

```json
// Translate a key with parameter interpolation
// input: { "key": "greeting", "params": { "name": "Alice" } }
// call: cognia_i18n_translate
// output: { "text": "Hello, Alice!" }
```

### From Frontend

The `pluginGetLocales(pluginId)` Tauri command returns all locale data. The `usePlugins()` hook provides:

- `getLocales(pluginId)` — fetch locale data
- `translatePluginKey(locales, locale, key, params?)` — client-side translation

## TypeScript SDK (`plugin-sdk-ts/`)

A type-safe TypeScript SDK that mirrors the Rust SDK 1:1. Located at `plugin-sdk-ts/` in the project root.

### Installation

Plugin projects created via the scaffold tool (language: `typescript`) automatically include the SDK dependency.

### Usage

```typescript
import { cognia } from '@cognia/plugin-sdk';

function my_tool(): number {
  const input = Host.inputString();
  const platform = cognia.platform.info();
  cognia.log.info(`Running on ${platform.os}`);
  const greeting = cognia.i18n.translate('greeting', { name: platform.hostname });
  Host.outputString(JSON.stringify({ greeting, platform: platform.os, input }));
  return 0;
}

module.exports = { my_tool };
```

### Modules

| Module | Functions |
|--------|-----------|
| `cognia.config` | `get`, `set` |
| `cognia.env` | `list`, `providerList`, `detect`, `getCurrent`, `listVersions`, `installVersion`, `setVersion` |
| `cognia.pkg` | `search`, `info`, `versions`, `dependencies`, `listInstalled`, `checkUpdates`, `install`, `uninstall` |
| `cognia.fs` | `read`, `write`, `listDir`, `exists`, `remove`, `mkdir` |
| `cognia.http` | `get`, `post` |
| `cognia.clipboard` | `read`, `write` |
| `cognia.notification` | `send` |
| `cognia.process` | `exec` |
| `cognia.i18n` | `getLocale`, `translate`, `t`, `getAll` |
| `cognia.platform` | `info`, `cacheInfo` |
| `cognia.log` | `info`, `warn`, `error`, `debug` |
| `cognia.event` | `emit`, `emitStr`, `getPluginId` |

### Build Pipeline

```bash
# 1. Bundle TS → CJS with esbuild
npx esbuild src/index.ts --bundle --outfile=dist/plugin.js --format=cjs --target=es2020

# 2. Compile CJS → WASM with extism-js
npx extism-js dist/plugin.js -i plugin.d.ts -o plugin.wasm
```

### Scaffold Languages

The scaffold system (`plugin_scaffold` command) supports three languages:
- **Rust** — Uses `cognia-plugin-sdk` crate, compiles with `cargo build --target wasm32-unknown-unknown`
- **JavaScript** — Raw JS with `Host.getFunctions()`, compiles with `extism-js`
- **TypeScript** (recommended) — Uses `@cognia/plugin-sdk`, bundles with esbuild + `extism-js`

## UI Modes

Plugins can declare one of three UI rendering modes per tool via `ui_mode` in `plugin.toml`:

| Mode | Value | Description |
|------|-------|-------------|
| **Text** | `"text"` (default) | Plain text input/output. The existing behavior. |
| **Declarative** | `"declarative"` | WASM returns JSON UI blocks; host renders with native shadcn/ui components. |
| **iframe** | `"iframe"` | Plugin ships HTML/CSS/JS in a `ui/` directory; rendered in a sandboxed iframe. |

### Declarative UI

Tools with `ui_mode = "declarative"` return a JSON envelope from their WASM entry:

```json
{
  "ui": [
    { "type": "heading", "content": "Dashboard", "level": 1 },
    { "type": "table", "headers": ["Env", "Version"], "rows": [["Node", "20.0"]] },
    { "type": "actions", "buttons": [{ "id": "refresh", "label": "Refresh" }] }
  ],
  "state": { "counter": 1 }
}
```

When a user clicks a button or submits a form, the host calls the same WASM entry with an action payload:

```json
{ "action": "button_click", "buttonId": "refresh", "state": { "counter": 1 } }
```

#### Supported Block Types (14)

| Type | Description | Key Fields |
|------|-------------|------------|
| `text` | Paragraph text | `content`, `variant?` (default/muted/code) |
| `heading` | h1/h2/h3 | `content`, `level?` (1-3, default 2) |
| `markdown` | Rendered markdown (GFM + syntax highlight) | `content` |
| `divider` | Horizontal separator | — |
| `alert` | Alert banner | `message`, `title?`, `variant?` (default/destructive) |
| `badge` | Inline badge | `label`, `variant?` |
| `progress` | Progress bar | `value`, `max?` (default 100), `label?` |
| `image` | Image (data: URI) | `src`, `alt?`, `width?`, `height?` |
| `code` | Code block | `code`, `language?` |
| `table` | Data table | `headers: string[]`, `rows: string[][]` |
| `key-value` | Key-value pairs | `items: [{key, value}]` |
| `form` | Interactive form | `id`, `fields: FormField[]`, `submitLabel?` |
| `actions` | Action buttons | `buttons: [{id, label, variant?, icon?}]` |
| `group` | Layout container | `direction?` (horizontal/vertical), `gap?`, `children: UiBlock[]` |

#### Form Field Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `input` | Text input | `id`, `label`, `placeholder?`, `defaultValue?`, `required?` |
| `textarea` | Multi-line text | `id`, `label`, `placeholder?`, `rows?` |
| `select` | Dropdown select | `id`, `label`, `options: [{label, value}]`, `defaultValue?` |
| `checkbox` | Checkbox toggle | `id`, `label`, `defaultChecked?` |
| `slider` | Range slider | `id`, `label`, `min`, `max`, `step?`, `defaultValue?` |

### iframe Custom UI

Tools with `ui_mode = "iframe"` require a `[ui]` section in `plugin.toml`:

```toml
[[tools]]
id = "my-view"
entry = "my_view_fn"
ui_mode = "iframe"

[ui]
entry = "ui/index.html"
width = 800
height = 600
resizable = true
```

The HTML is rendered inside `<iframe sandbox="allow-scripts">` with strict CSP. A bridge script is injected that provides `window.cognia.*` APIs:

| Bridge API | Permission Required | Description |
|------------|-------------------|-------------|
| `cognia.log.info/warn/error/debug(msg)` | None | Write to app log |
| `cognia.i18n.getLocale()` | None | Get current locale |
| `cognia.i18n.translate(key, params)` | None | Translate using plugin's locales |
| `cognia.ui.showToast(message)` | None | Show a toast notification |
| `cognia.ui.close()` | None | Close the plugin view |
| `cognia.theme.current()` | None | Get `{ mode: "light"|"dark" }` |
| `cognia.clipboard.read/write(text)` | `clipboard` | Clipboard access |
| `cognia.callTool(entry, input)` | None | Call back into WASM |

All bridge APIs return Promises and are proxied through the host's permission system.

### SDK UI Module

Both SDKs provide a `ui` module with builder functions:

**Rust:**

```rust
use cognia_plugin_sdk::ui;

let blocks = vec![
    ui::heading("Dashboard", 1),
    ui::table(&["Env", "Version"], &[vec!["Node".into(), "20.0".into()]]),
    ui::actions(&[ui::button("refresh", "Refresh", None, Some("RefreshCw"))]),
];
Ok(ui::render(&blocks))
```

**TypeScript:**

```typescript
import { cognia } from '@cognia/plugin-sdk';

const blocks = [
    cognia.ui.heading('Dashboard', 1),
    cognia.ui.table(['Env', 'Version'], [['Node', '20.0']]),
    cognia.ui.actions([cognia.ui.button('refresh', 'Refresh', 'default', 'RefreshCw')]),
];
Host.outputString(cognia.ui.render(blocks));
```

Both provide `parseAction(input)` to handle user interactions:

```rust
if let Some(action) = ui::parse_action(&input) {
    if action.action == "button_click" && action.button_id.as_deref() == Some("refresh") {
        // Handle refresh
    }
}
```

## Frontend Integration

### TypeScript Types

All types in `types/plugin.ts`: `PluginManifest`, `PluginMeta`, `PluginToolDeclaration`, `PluginPermissions`, `PluginPermissionState`, `PluginInfo`, `PluginSource`, `PluginToolInfo`, `PluginUiConfig`, `PluginUiEntry`.

Declarative UI types in `types/plugin-ui.ts`: `UiBlock` (14 variants), `FormField` (5 types), `ActionButton`, `PluginUiResponse`, `PluginUiAction`.

### Tauri Commands (20)

`pluginList`, `pluginGetInfo`, `pluginListAllTools`, `pluginGetTools`, `pluginImportLocal`, `pluginInstall`, `pluginUninstall`, `pluginEnable`, `pluginDisable`, `pluginReload`, `pluginCallTool`, `pluginGetPermissions`, `pluginGrantPermission`, `pluginRevokePermission`, `pluginGetDataDir`, `pluginGetLocales`, `pluginScaffold`, `pluginValidate`, `pluginGetUiEntry`, `pluginGetUiAsset`.

### React Hook

```tsx
const {
  plugins, pluginTools, loading, error,
  fetchPlugins, installPlugin, importLocalPlugin,
  uninstallPlugin, enablePlugin, disablePlugin,
  reloadPlugin, callTool, getPermissions,
  grantPermission, revokePermission,
  getLocales, translatePluginKey,
  scaffoldPlugin, validatePlugin,
} = usePlugins();
```

### React Components

- `PluginToolRunner` — Auto-dispatches to text/declarative/iframe mode based on `tool.uiMode`
- `PluginUiRenderer` — Renders `UiBlock[]` array into shadcn/ui React components
- `PluginIframeView` — Sandboxed iframe with postMessage bridge

### Example Plugins

- **Rust:** `plugin-sdk/examples/hello-world/` — 3 tools: `hello` (text), `env-check` (text), `env-dashboard` (declarative UI)
- **TypeScript:** `plugin-sdk-ts/examples/hello-world/` — 4 tools: `hello` (text), `env-check` (text), `env-dashboard` (declarative), `custom-view` (iframe with `ui/index.html`)
