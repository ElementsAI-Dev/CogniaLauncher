# Complete Provider List

CogniaLauncher integrates 55 Providers, covering major operating systems and programming language ecosystems.

---

## System Package Managers

| ID | Name | Platform | Capabilities |
|----|------|----------|------|
| `winget` | Windows Package Manager | Windows | Install, Uninstall, Search, List, Update, Upgrade |
| `scoop` | Scoop | Windows | Install, Uninstall, Search, List, Update |
| `chocolatey` | Chocolatey | Windows | Install, Uninstall, Search, List, Update |
| `brew` | Homebrew | macOS | Install, Uninstall, Search, List, Update, Upgrade |
| `macports` | MacPorts | macOS | Install, Uninstall, Search, List, Update |
| `apt` | APT | Linux (Debian) | Install, Uninstall, Search, List, Update |
| `dnf` | DNF | Linux (Fedora) | Install, Uninstall, Search, List, Update |
| `pacman` | Pacman | Linux (Arch) | Install, Uninstall, Search, List, Update |
| `zypper` | Zypper | Linux (openSUSE) | Install, Uninstall, Search, List, Update |
| `apk` | APK | Linux (Alpine) | Install, Uninstall, Search, List, Update |
| `snap` | Snap | Linux | Install, Uninstall, Search, List, Update |
| `flatpak` | Flatpak | Linux | Install, Uninstall, Search, List, Update |
| `nix` | Nix | Linux/macOS | Install, Uninstall, Search, List |

## Node.js Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `npm` | npm | Package manager | Install, Uninstall, Search, List, Update |
| `pnpm` | pnpm | Package manager | Install, Uninstall, Search, List, Update |
| `yarn` | Yarn | Package manager | Install, Uninstall, Search, List, Update |
| `bun` | Bun | Package manager | Install, Uninstall, Search, List, Update |
| `nvm` | NVM | Version manager | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `fnm` | FNM | Version manager | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `volta` | Volta | Toolchain manager | Install, Uninstall, List, VersionSwitch |

## Python Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `pip` | pip | Package manager | Install, Uninstall, Search, List, Update |
| `uv` | uv | Package manager | Install, Uninstall, Search, List, Update |
| `poetry` | Poetry | Project manager | Install, Uninstall, List |
| `pipx` | pipx | CLI tool manager | Install, Uninstall, List |
| `pyenv` | pyenv | Version manager | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `conda` | Conda/Mamba | Environment manager | Install, Uninstall, Search, List, Update |

## Rust Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `cargo` | Cargo | Package manager | Install, Uninstall, Search, List |
| `rustup` | rustup | Toolchain manager | Install, Uninstall, List, Update, VersionSwitch |

## Java/Kotlin Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `sdkman` | SDKMAN (Java) | Version manager | Install, Uninstall, List, Update, Upgrade, VersionSwitch |
| `sdkman-kotlin` | SDKMAN (Kotlin) | Version manager | Install, Uninstall, List, Update, Upgrade, VersionSwitch |

## Go Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `goenv` | goenv | Version manager | Install, Uninstall, List, VersionSwitch |
| `gomod` | Go Modules | Package manager | Install, Uninstall, List |

## Ruby Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `bundler` | Bundler | Package manager | Install, Uninstall, List |
| `gem` | RubyGems | Package manager | Install, Uninstall, Search, List |
| `rbenv` | rbenv | Version manager | Install, Uninstall, List, VersionSwitch |

## PHP Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `composer` | Composer | Package manager | Install, Uninstall, Search, List |
| `phpbrew` | PHPBrew | Version manager | Install, Uninstall, List, VersionSwitch |

## .NET Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `dotnet` | .NET CLI / NuGet | Package manager | Install, Uninstall, Search, List |

## Deno

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `deno` | Deno | Runtime | Install, Uninstall, List, VersionSwitch |

## Dart/Flutter Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `fvm` | FVM | Version manager | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `pub_dev` | Dart Pub | Package manager | Install, Uninstall, Search, List |

## Lua Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `luarocks` | LuaRocks | Package manager | Install, Uninstall, Search, List |

## Zig Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `zig` | Zig | Version manager | Install, Uninstall, List, VersionSwitch |

## C/C++ Ecosystem

| ID | Name | Type | Capabilities |
|----|------|------|------|
| `vcpkg` | vcpkg | Package manager | Install, Uninstall, Search, List |
| `conan` | Conan | Package manager | Install, Uninstall, Search, List |
| `xmake` | Xmake/Xrepo | Package manager | Install, Uninstall, Search, List, Update |
| `msvc` | MSVC | Detection | List (vswhere.exe detects Visual Studio Build Tools) |
| `msys2` | MSYS2 | Package manager | Install, Uninstall, Search, List, Update |

## Containers & Virtualization

| ID | Name | Platform | Capabilities |
|----|------|------|------|
| `docker` | Docker | Cross-platform | Search, List |
| `podman` | Podman | Cross-platform | Search, List |
| `wsl` | WSL | Windows | Install, Uninstall, Search, List, Update |

## Other

| ID | Name | Description | Capabilities |
|----|------|------|------|
| `github` | GitHub Releases | Download from GitHub | Search, Install |
| `gitlab` | GitLab Releases | Download from GitLab | Search, Install |
| `psgallery` | PowerShell Gallery | PowerShell modules | Install, Uninstall, Search, List |
| `asdf` | asdf | Polyglot version manager | Install, Uninstall, List, VersionSwitch |
| `mise` | mise | Polyglot version manager | Install, Uninstall, List, VersionSwitch |
| `git` | Git | Git version management and repository inspection | List |
| `system` | System Detection | System runtime detection (27 types) | List |

---

## Infrastructure Files

| File | Purpose |
|------|------|
| `mod.rs` | Module exports and Provider trait definitions |
| `traits.rs` | Trait interfaces (Provider/EnvironmentProvider/SystemPackageProvider/CustomSourceProvider) |
| `registry.rs` | Provider registry and discovery |
| `api.rs` | Package API client (npm/PyPI/crates.io mirror support) |
| `node_base.rs` | Node.js Provider shared utilities and macros |
| `system.rs` | System runtime detection (10 environment types) |
