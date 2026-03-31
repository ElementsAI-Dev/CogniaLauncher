# Built-in Plugins Workspace

This directory hosts first-party production plugins shipped with CogniaLauncher.

## Structure

- `manifest.json`: Built-in plugin catalog (id/version/framework/checksum metadata).
- `sdk-capability-matrix.json`: Capability governance for required built-ins (`sdkCapabilities`, `expectedPermissions`, `primaryEntrypoints`).
- `sdk-usage-inventory.json`: Capability-centric coverage inventory for the full stable SDK export surface (`permissionGuidance`, maintained usage paths, toolbox/runtime prerequisites, reference-vs-guided workflow coverage).
- `extension-point-matrix.json`: Official plugin-point support matrix (`manifestPrerequisites`, SDK coverage, scaffold support, reference examples).
- `rust/*`: Rust SDK built-in plugins.
- `typescript/*`: TypeScript SDK built-in plugins.

## Lifecycle

1. Build all built-ins:
   - `pnpm plugins:build`
2. Refresh checksums in catalog:
   - `pnpm plugins:checksums`
3. Validate built-in release readiness against existing artifacts, metadata, checksums, and tests:
   - `pnpm plugins:validate`

## Scaffold Handoff Contract

When creating a built-in plugin from Toolbox > Plugins > Create Plugin with lifecycle `builtin`:

- Output directory must be the `plugins/` workspace root.
- The scaffold generates:
  - `catalog-entry.sample.json`
  - builtin TypeScript sample metadata aligned with generated `package.json`
    and `src/index.test.ts` via `packageName` / `testFile`
  - `cognia.scaffold.json`
  - lifecycle handoff metadata for catalog/checksum/validation steps
  - authoring selections summary for plugin points, host capabilities, and HTTP
    domains when those advanced inputs were chosen
- Standard onboarding commands remain:
  - `pnpm plugins:checksums`
  - `pnpm plugins:validate`
- Use the generated `README.md` / `cognia.scaffold.json` command list as the
  canonical per-plugin handoff. Do not invent alternate shell-specific steps
  when the scaffold already emitted the build path.

For external scaffolds, follow build -> validate -> import workflow first; built-in onboarding starts after the artifact is generated and validated.

## Targeted Maintainer Runs

The canonical maintainer commands support additive selectors so you can work on a subset of the catalog without changing the default full-suite behavior.

- Target one or more plugin ids:
  - `pnpm plugins:build -- --plugin com.cognia.builtin.git-workspace-summary`
- Target a framework lane:
  - `pnpm plugins:validate -- --framework rust`
- Combine selectors (union of requested ids and frameworks):
  - `pnpm plugins:validate -- --plugin com.cognia.builtin.git-workspace-summary --framework rust`
- Request a machine-readable summary for CI or follow-up tooling:
  - `pnpm plugins:validate -- --framework typescript --json`

Selector rules:

- Repeat `--plugin <id>` and `--framework <rust|typescript>` as needed.
- Unknown selectors fail before build, checksum, or test stages mutate anything.
- Filtered runs report both selected and skipped plugin ids so partial coverage is explicit.
- Filtered runs are for focused iteration only; run the canonical commands without selectors before shipping the full built-in suite.

## Current Required Capability-Coverage Built-ins

- `com.cognia.builtin.env-provider-audit` (`plugins/typescript/env-provider-audit`)
  - Focus: `env`, `platform`, `event`, `notification`
- `com.cognia.builtin.pkg-update-advisor` (`plugins/typescript/pkg-update-advisor`)
  - Focus: `pkg`, `clipboard`, `notification`, `event`
- `com.cognia.builtin.file-config-assistant` (`plugins/rust/file-config-assistant`)
  - Focus: `fs`, `config`
- `com.cognia.builtin.local-api-workbench` (`plugins/typescript/local-api-workbench`)
  - Focus: `http`
- `com.cognia.builtin.port-inspector` (`plugins/typescript/port-inspector`)
  - Focus: `process`

When adding or modifying required built-ins:

1. Update `plugins/sdk-capability-matrix.json`.
2. Keep `expectedPermissions` aligned with `plugin.toml` `[permissions]`.
3. Keep `primaryEntrypoints` aligned with `[[tools]].entry` and source exports.
   Keep `guidedWorkflowEntrypoints` / `guidedWorkflowToolIds` aligned with any declarative companion tools that represent the preferred Toolbox workflow.
4. Keep `plugins/sdk-usage-inventory.json` aligned with the maintained usage path you expect contributors and toolbox/runtime diagnostics to rely on.
5. Keep `plugins/extension-point-matrix.json` reference examples and supported plugin-point coverage aligned with the built-in implementation.

## Stable SDK Usage Coverage

The repository now tracks full stable SDK capability coverage in `plugins/sdk-usage-inventory.json`.

- Built-in paths cover high-value in-product workflows such as `env`, `pkg`, `fs`, `config`, `http`, and `process`.
- Official example paths cover broader operational capability families that do not yet need dedicated built-in surfaces, including `batch`, `cache`, `download`, `git`, `health`, `launch`, `profiles`, `shell`, and `wsl`.
- `pnpm plugins:validate` blocks drift between:
  - public SDK exports in `plugin-sdk/src/lib.rs` and `plugin-sdk-ts/src/index.ts`
  - `plugins/sdk-usage-inventory.json`
  - `plugins/sdk-capability-matrix.json`
  - referenced built-in/example assets

Maintained usage paths may now describe both:

- `runtime` surfaces: the production Launcher/WASM workflow.
- `ink-authoring` surfaces: local terminal authoring companions with explicit
  `launchCommand` and `localPrerequisites`.
- `coverage: "reference"`: automation-compatible text entrypoints or example assets.
- `coverage: "builtin-primary"`: the preferred Toolbox-facing guided workflow for a first-party built-in.

For guided built-ins, keep the governance story consistent across:

- `plugin.toml` companion `ui_mode = "declarative"` tool entries
- `sdk-capability-matrix.json` guided workflow metadata
- `sdk-usage-inventory.json` preferred workflow paths, interaction mode, and workflow intents

Keep those surfaces distinct in docs and inventory so contributors can tell
which path is safe for production runtime and which one is for local preview.

## Runtime Sync Behavior

At app startup, built-ins from this catalog are synced into runtime plugin storage:

- Missing built-ins are installed.
- Managed built-ins are upgraded when version/checksum changes.
- User-managed conflicting plugins are never overwritten.

## Authoring Rules

- Keep `plugin.toml` permissions least-privilege.
- Ensure `plugin.wasm` is deterministic and present before checksum refresh.
- Provide localized metadata (`name_zh` / `description_zh` and localized docs/messages where applicable).
- Include tests for at least one success and one failure path for primary tool workflows.
- Keep a task-oriented `README.md` beside each built-in plugin so operators can understand inputs, outputs, safety limits, and troubleshooting steps before catalog admission.
