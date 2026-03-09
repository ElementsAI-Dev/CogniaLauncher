# Env Provider Audit (TypeScript Built-in Plugin)

Production built-in plugin for environment/provider visibility and runtime readiness checks.

## Tool

- `env-provider-audit`

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

## Build

```bash
pnpm --filter cognia-builtin-env-provider-audit-plugin build
```
