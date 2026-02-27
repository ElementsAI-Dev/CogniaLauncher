# Environment Management

CogniaLauncher supports managing version installation and switching for multiple runtime environments.

---

## Supported Environments

| Environment | Provider | Version Manager |
|-------------|----------|-----------------|
| Node.js | nvm, fnm, volta | Multi-version coexistence |
| Python | pyenv | Multi-version coexistence |
| Rust | rustup | Toolchain management |
| Java | SDKMAN | Multi-distribution support |
| Kotlin | SDKMAN (kotlin) | Independent version management |
| Go | goenv | Multi-version coexistence |
| Ruby | rbenv | Multi-version coexistence |
| PHP | phpbrew | Multi-version coexistence |
| Deno | deno | Built-in version management |
| .NET | dotnet | SDK version management |

Additionally, the `system` Provider can detect system-installed runtime versions.

---

## Core Features

### Version Installation

1. Navigate to the **Environments** page
2. Select an environment type (e.g., Node.js)
3. Browse the available versions list
4. Click the **Install** button

The installation process includes the following steps, all with progress tracking:

- **Fetch** — Query version information
- **Download** — Download runtime binaries
- **Extract** — Extract the installation package
- **Configure** — Set up environment variables and paths
- **Complete** — Installation finished

!!! tip "Cancel Installation"
    You can click the **Cancel** button at any time during installation to abort.

### Version Switching

Three scopes of version switching are supported:

- **Global** — Modifies shell configuration files (`.bashrc`, `.zshrc`, etc.)
- **Project-level** — Writes to version files (`.node-version`, `.python-version`, etc.)
- **Session-level** — Only modifies the current shell session

### Version Aliases

The following version aliases are supported for automatic resolution:

| Alias | Description |
|-------|-------------|
| `latest` | Latest stable version |
| `lts` | Latest LTS version (Node.js) |
| `stable` | Stable version |
| `nightly` | Nightly build |

### Automatic Version Detection

CogniaLauncher automatically detects the runtime version required by a project, with the following detection priority:

1. **Project local version files** — `.node-version`, `.python-version`, etc.
2. **CogniaLauncher manifest** — `CogniaLauncher.yaml`
3. **Global version files** — `~/.CogniaLauncher/versions/`
4. **System default** — Version in system PATH

### Custom Detection Rules

Through the **Custom Detection** feature, you can define additional version detection rules:

- 9 extraction strategies (regex, JSON path, TOML field, etc.)
- Preset rules (importable common rule sets)
- Match by directory/file

---

## Related Commands

| Command | Description |
|---------|-------------|
| `env_list` | List all environment types |
| `env_get` | Get environment details |
| `env_install` | Install a runtime version |
| `env_uninstall` | Uninstall a runtime version |
| `env_use_global` | Set global version |
| `env_use_local` | Set project-level version |
| `env_detect` | Detect installed versions |
| `env_available_versions` | Get available versions list |
| `env_resolve_alias` | Resolve version alias |
| `env_install_cancel` | Cancel an in-progress installation |

See [Tauri Commands](../reference/commands.md) for the complete command reference.
