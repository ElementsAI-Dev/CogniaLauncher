# Built-in Plugins Workspace

This directory hosts first-party production plugins shipped with CogniaLauncher.

## Structure

- `manifest.json`: Built-in plugin catalog (id/version/framework/checksum metadata).
- `rust/*`: Rust SDK built-in plugins.
- `typescript/*`: TypeScript SDK built-in plugins.

## Lifecycle

1. Build all built-ins:
   - `pnpm plugins:build`
2. Refresh checksums in catalog:
   - `pnpm plugins:checksums`
3. Validate built-in release readiness against existing artifacts, metadata, checksums, and tests:
   - `pnpm plugins:validate`

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
