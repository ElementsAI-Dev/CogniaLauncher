# Package Update Advisor (TypeScript Built-in Plugin)

Production built-in plugin for dependency update visibility and team-ready update summaries.

## Tool

- `pkg-update-advisor`

## Input

```json
{
  "provider": "npm",
  "packages": ["react", "next"],
  "limit": 20,
  "copySummary": true,
  "notifyOnUpdates": true,
  "emitEvent": true
}
```

All fields are optional. Empty input auto-selects installed packages for the selected provider.

## Output

- Success:
  - `ok: true`
  - `provider`
  - `targetPackages[]`
  - `updates[]`
  - `summary`
  - `recommendations[]`
- Failure:
  - `ok: false`
  - `errorCode`
  - `message`
  - `recommendations[]`

## SDK Coverage

- `cognia.pkg`: installed list and update checks
- `cognia.clipboard`: optional summary sharing
- `cognia.notification`: optional update alerting
- `cognia.event`: completion signal

## Build

```bash
pnpm --filter cognia-builtin-pkg-update-advisor-plugin build
```

## Ink Authoring Preview

Use the maintained local Ink companion to preview the advisor summary without
changing the production WASM entrypoint:

```bash
pnpm --dir plugins/typescript/pkg-update-advisor authoring:ink
```

This preview remains authoring-only and keeps the runtime manifest and
permissions unchanged.
