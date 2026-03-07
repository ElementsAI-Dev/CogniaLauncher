# Port Inspector (TypeScript Built-in Plugin)

Built-in plugin for inspecting listening sockets and the process context around them.

## Tool

- `port-inspect`

## Input

```json
{
  "port": 3000,
  "processNameContains": "node",
  "addressContains": "127.0.0.1"
}
```

You can also pass a raw port string like `3000`, or leave input empty to inspect all listeners.

## Output

- `ok`
- `os`
- `queriedPort`
- `filters`
- `commandUsed`
- `entries[]` with:
  - `protocol`
  - `state`
  - `address`
  - `port`
  - `processId`
  - optional `processName`
  - optional `metadataMissing[]`
- `warnings[]`
- `recommendations[]`

## Notes

- Supports target filters for `port`, `processId`, `processNameContains`, and `addressContains`.
- Tries to enrich missing process names with follow-up OS commands when a PID is available.
- Keeps partial metadata explicit instead of hiding unresolved process details.

## Permissions

- `process_exec = true` — required to run platform-native socket inspection and PID lookup commands.
