# CLI Commands Reference

CogniaLauncher provides a complete command-line interface for headless package and environment management. When a CLI subcommand is detected, the app runs headless (no GUI window) and exits after completion.

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--verbose` | `-v` | Increase log verbosity |
| `--quiet` | `-q` | Suppress non-essential output |
| `--json` | | Output in JSON format for scripting |
| `--minimized` | | Start GUI minimized to system tray |

## Package Management

### search

Search packages across all providers.

```bash
cognia search lodash
cognia search express --provider npm --limit 10
cognia search numpy --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<query>` | | Search query (positional) |
| `--provider` | `-p` | Filter by provider ID |
| `--limit` | `-l` | Max results (default: 20) |

### install

Install one or more packages via the Orchestrator.

```bash
cognia install lodash
cognia install express@4 typescript --provider npm
cognia install numpy --force
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<packages...>` | | Package names (positional, multiple) |
| `--provider` | `-p` | Specify provider ID |
| `--force` | `-f` | Force reinstall |

### uninstall

Uninstall one or more packages.

```bash
cognia uninstall lodash
cognia uninstall express typescript --provider npm
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<packages...>` | | Package names (positional, multiple) |
| `--provider` | `-p` | Specify provider ID |
| `--force` | `-f` | Force uninstall |

### list

List installed packages.

```bash
cognia list
cognia list --provider npm
cognia list --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--provider` | `-p` | Filter by provider ID |
| `--outdated` | | Show only outdated packages |

### update

Check for and list available updates.

```bash
cognia update --all
cognia update lodash express
cognia update --provider npm --all --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `[packages...]` | | Specific packages (omit for --all) |
| `--provider` | `-p` | Filter by provider ID |
| `--all` | `-a` | Check all packages |

### info

Show detailed package information.

```bash
cognia info lodash
cognia info numpy --provider pip
cognia info express --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<package>` | | Package name (positional) |
| `--provider` | `-p` | Specify provider ID |

## Environment Management

### env list

List installed development environment versions.

```bash
cognia env list
cognia env list --type node
cognia env list --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--type` | `-t` | Filter by environment type |

### env install

Install a specific environment version.

```bash
cognia env install 20.11.0 --type node
cognia env install 3.12.0 --type python --provider pyenv
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<version>` | | Version to install (positional) |
| `--type` | `-t` | Environment type (required) |
| `--provider` | `-p` | Specific provider ID |

### env use

Set the active environment version.

```bash
cognia env use 20.11.0 --type node
cognia env use 3.12.0 --type python --local ./myproject
```

| Arg | Short | Description |
|-----|-------|-------------|
| `<version>` | | Version to activate (positional) |
| `--type` | `-t` | Environment type (required) |
| `--local` | | Project directory for local version |
| `--provider` | `-p` | Specific provider ID |

### env detect

Detect installed environments in a directory.

```bash
cognia env detect
cognia env detect --type python --path ./myproject
cognia env detect --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--type` | `-t` | Filter by environment type |
| `--path` | | Start path (default: current directory) |

## Configuration

### config get

Get a configuration value.

```bash
cognia config get appearance.theme
cognia config get network.proxy --json
```

### config set

Set a configuration value.

```bash
cognia config set appearance.theme dark
cognia config set network.timeout 30
```

### config list

List all configuration keys and values.

```bash
cognia config list
cognia config list --json
```

### config reset

Reset configuration to defaults.

```bash
cognia config reset
```

## Cache Management

### cache info

Show cache statistics.

```bash
cognia cache info
cognia cache info --json
```

### cache clean

Clean cache entries.

```bash
cognia cache clean --expired
cognia cache clean --all
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--all` | `-a` | Clean all cache entries |
| `--expired` | `-e` | Clean only expired entries |

## Health Checks

### doctor

Run system health checks.

```bash
cognia doctor
cognia doctor --type python
cognia doctor --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--type` | `-t` | Check specific environment type |

## Provider Information

### providers

List available package providers.

```bash
cognia providers
cognia providers --system
cognia providers --json
```

| Arg | Short | Description |
|-----|-------|-------------|
| `--system` | `-s` | Show only system package providers |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (operation failed) |
| 2 | Argument error (missing/invalid args) |

## Architecture

The CLI handler (`src-tauri/src/cli.rs`) runs inside the Tauri `.setup()` callback after Settings and ProviderRegistry initialization but before the webview starts. When a subcommand is detected:

1. Single-instance plugin is bypassed (so CLI runs independently of any running GUI instance)
2. Windows console is attached via `AttachConsole(ATTACH_PARENT_PROCESS)` for stdout visibility
3. The subcommand handler executes using existing core modules (`Orchestrator`, `EnvironmentManager`, `HealthCheckManager`, etc.)
4. `std::process::exit(code)` prevents the webview from starting

All subcommand handlers reuse existing core logic — no business logic is duplicated.
