# Provider System

Providers are the core abstraction in CogniaLauncher. Each Provider encapsulates a specific package manager or version manager.

---

## Provider Categories

### System Package Managers

| Provider | Platform | Description |
|----------|----------|-------------|
| winget | Windows | Windows Package Manager |
| scoop | Windows | Scoop package manager |
| chocolatey | Windows | Chocolatey package manager |
| brew | macOS | Homebrew |
| macports | macOS | MacPorts |
| apt | Linux (Debian) | APT package manager |
| dnf | Linux (Fedora) | DNF package manager |
| pacman | Linux (Arch) | Pacman package manager |
| zypper | Linux (openSUSE) | Zypper package manager |
| apk | Linux (Alpine) | APK package manager |
| snap | Linux | Snap package manager |
| flatpak | Linux | Flatpak package manager |
| nix | Linux/macOS | Nix package manager |

### Language Package Managers

| Provider | Language | Description |
|----------|----------|-------------|
| npm | Node.js | npm package manager |
| pnpm | Node.js | pnpm package manager |
| yarn | Node.js | Yarn package manager |
| bun | Node.js | Bun package manager |
| pip | Python | pip package manager |
| uv | Python | uv fast package manager |
| poetry | Python | Poetry project manager |
| pipx | Python | pipx CLI tool manager |
| cargo | Rust | Cargo package manager |
| composer | PHP | Composer package manager |
| bundler | Ruby | Bundler package manager |
| gem | Ruby | RubyGems |
| dotnet | .NET | NuGet package manager |
| goenv | Go | Go module management |

### Version/Environment Managers

| Provider | Manages | Description |
|----------|---------|-------------|
| nvm | Node.js | Node Version Manager |
| fnm | Node.js | Fast Node Manager |
| volta | Node.js | Volta toolchain manager |
| pyenv | Python | Python version manager |
| rustup | Rust | Rust toolchain manager |
| sdkman | Java | SDKMAN (Java, Kotlin, Gradle, Maven, Scala) |
| sdkman-kotlin | Kotlin | SDKMAN Kotlin candidate |
| rbenv | Ruby | Ruby version manager |
| phpbrew | PHP | PHPBrew version manager |
| deno | Deno | Deno runtime |
| goenv | Go | Go version manager |
| asdf | Polyglot | asdf version manager |
| mise | Polyglot | mise version manager |

### Containers & Virtualization

| Provider | Description |
|----------|-------------|
| docker | Docker container management |
| podman | Podman container management |
| wsl | Windows Subsystem for Linux |

### C/C++ Package Managers

| Provider | Description |
|----------|-------------|
| vcpkg | vcpkg C/C++ package manager |
| conan | Conan C/C++ package manager |
| xmake | Xmake/Xrepo C/C++ package manager |

### Other

| Provider | Description |
|----------|-------------|
| github | GitHub Releases download |
| gitlab | GitLab Releases download |
| psgallery | PowerShell Gallery |
| system | System runtime detection (10 environment types) |

---

## Provider Capabilities

Each Provider declares its supported capabilities:

| Capability | Description |
|------------|-------------|
| `Install` | Install packages/versions |
| `Uninstall` | Uninstall packages/versions |
| `Search` | Search packages |
| `List` | List installed |
| `Update` | Update packages |
| `Upgrade` | Upgrade all packages |
| `UpdateIndex` | Update package index |
| `LockVersion` | Lock version |
| `Rollback` | Version rollback |
| `VersionSwitch` | Version switching (environment Providers) |
| `MultiVersion` | Multi-version coexistence (environment Providers) |
| `ProjectLocal` | Project-level version (environment Providers) |

---

## Provider Priority

Providers are sorted by priority, with higher-priority Providers used first. You can adjust priority and enable/disable status in settings.

Priority range: 0-100, higher values mean higher priority.

---

## Full List

See [Provider List Reference](../reference/providers-list.md) for detailed information on all 51+ Providers.
