# Env Provider Audit (TypeScript Built-in Plugin)

Production built-in plugin for environment/provider visibility and runtime readiness checks.

## Tool

- `env-provider-audit`
- `env-provider-audit-guided`

## Workflow Split

- `env-provider-audit`: automation-safe text entrypoint. Keep using this for deterministic JSON input/output in scripts.
- `env-provider-audit-guided`: declarative Toolbox workflow with form defaults, structured summary/stream/artifact channels, and partial follow-up degradation reporting when notification/event side-effects fail.

## Input

```json
{
  "envTypes": ["node", "python", "rust"],
  "includeProviders": true,
  "notifyOnIssues": true,
  "emitEvent": true
}
```

All fields are optional. Empty input uses safe defaults.

The guided entrypoint renders the same audit core through declarative form state instead of requiring raw JSON input.

## Output

- Success:
  - `ok: true`
  - `platform`
  - `providers[]` (when `includeProviders=true`)
  - `environments[]`
  - `issues[]`
  - `recommendations[]`
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## SDK Coverage

- `cognia.env`: provider and environment probing
- `cognia.platform`: host OS context
- `cognia.event`: emits completion signal
- `cognia.notification`: optional issue summary notification

The guided workflow keeps `env_read` as the core requirement and treats `notification` / `event` follow-ups as degradable stages instead of blanking the successful audit result.

## Build

```bash
pnpm --filter cognia-builtin-env-provider-audit-plugin build
```

## Ink Authoring Preview

Use the maintained local Ink companion to preview the audit workflow with the
same shared audit core used by the production plugin:

```bash
pnpm --dir plugins/typescript/env-provider-audit authoring:ink
```

This preview does not modify the built-in manifest, exported WASM entrypoint, or
runtime permission contract.
