# Git Workspace Summary (TypeScript Built-in Plugin)

Built-in plugin for read-only Git repository health checks.

## Tool

- `git-workspace-summary`

## Input

```json
{
  "repoPath": "D:/Project/CogniaLauncher"
}
```

You can also pass a raw path string.

## Output

- `ok`
- `repoPath`
- `branch`, `upstream`, `ahead`, `behind`
- `detachedHead`
- `counts` for:
  - `staged`
  - `unstaged`
  - `untracked`
  - `conflicted`
  - `deleted`
  - `renamed`
- `stashCount`
- `lastCommit`
- `entries[]` with short status and path
- `recommendations[]`

## Notes

- Uses read-only Git commands only.
- Surfaces stash pressure and detached-HEAD state for daily maintenance workflows.
- Keeps remediation guidance descriptive; it does not modify the repository.

## Permissions

- `process_exec = true` — required to run local `git` commands in read-only mode.
