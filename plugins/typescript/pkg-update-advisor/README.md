# Package Update Advisor (TypeScript Built-in Plugin)

Production built-in plugin for dependency update visibility and team-ready update summaries.

## Tool

- `pkg-update-advisor`
- `pkg-update-advisor-guided`

## Workflow Split

- `pkg-update-advisor`: automation-safe text entrypoint for scripts and deterministic JSON summaries.
- `pkg-update-advisor-guided`: declarative Toolbox workflow with filters, structured summary/stream/artifact channels, and partial follow-up degradation reporting when clipboard / notification / event follow-ups fail.

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

The guided entrypoint renders the same update-advisor core through declarative form state instead of requiring raw JSON input.

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

The guided workflow keeps `pkg_search` as the core requirement and treats clipboard / notification / event follow-ups as degradable stages so update results remain visible on partial failure.

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
