# Provider 完整列表

CogniaLauncher 集成 51+ Provider，覆盖主流操作系统和编程语言生态。

---

## 系统包管理器

| ID | 名称 | 平台 | 能力 |
|----|------|------|------|
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

## Node.js 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `npm` | npm | 包管理器 | Install, Uninstall, Search, List, Update |
| `pnpm` | pnpm | 包管理器 | Install, Uninstall, Search, List, Update |
| `yarn` | Yarn | 包管理器 | Install, Uninstall, Search, List, Update |
| `bun` | Bun | 包管理器 | Install, Uninstall, Search, List, Update |
| `nvm` | NVM | 版本管理器 | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `fnm` | FNM | 版本管理器 | Install, Uninstall, List, VersionSwitch, MultiVersion |
| `volta` | Volta | 工具链管理器 | Install, Uninstall, List, VersionSwitch |

## Python 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `pip` | pip | 包管理器 | Install, Uninstall, Search, List, Update |
| `uv` | uv | 包管理器 | Install, Uninstall, Search, List, Update |
| `poetry` | Poetry | 项目管理器 | Install, Uninstall, List |
| `pipx` | pipx | CLI 工具管理 | Install, Uninstall, List |
| `pyenv` | pyenv | 版本管理器 | Install, Uninstall, List, VersionSwitch, MultiVersion |

## Rust 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `cargo` | Cargo | 包管理器 | Install, Uninstall, Search, List |
| `rustup` | rustup | 工具链管理器 | Install, Uninstall, List, Update, VersionSwitch |

## Java/Kotlin 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `sdkman` | SDKMAN (Java) | 版本管理器 | Install, Uninstall, List, Update, Upgrade, VersionSwitch |
| `sdkman-kotlin` | SDKMAN (Kotlin) | 版本管理器 | Install, Uninstall, List, Update, Upgrade, VersionSwitch |

## Go 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `goenv` | goenv | 版本管理器 | Install, Uninstall, List, VersionSwitch |
| `gomod` | Go Modules | 包管理器 | Install, Uninstall, List |

## Ruby 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `bundler` | Bundler | 包管理器 | Install, Uninstall, List |
| `gem` | RubyGems | 包管理器 | Install, Uninstall, Search, List |
| `rbenv` | rbenv | 版本管理器 | Install, Uninstall, List, VersionSwitch |

## PHP 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `composer` | Composer | 包管理器 | Install, Uninstall, Search, List |
| `phpbrew` | PHPBrew | 版本管理器 | Install, Uninstall, List, VersionSwitch |

## .NET 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `dotnet` | .NET CLI / NuGet | 包管理器 | Install, Uninstall, Search, List |

## Deno

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `deno` | Deno | 运行时 | Install, Uninstall, List, VersionSwitch |

## C/C++ 生态

| ID | 名称 | 类型 | 能力 |
|----|------|------|------|
| `vcpkg` | vcpkg | 包管理器 | Install, Uninstall, Search, List |
| `conan` | Conan | 包管理器 | Install, Uninstall, Search, List |
| `xmake` | Xmake/Xrepo | 包管理器 | Install, Uninstall, Search, List, Update |

## 容器与虚拟化

| ID | 名称 | 平台 | 能力 |
|----|------|------|------|
| `docker` | Docker | 跨平台 | Search, List |
| `podman` | Podman | 跨平台 | Search, List |
| `wsl` | WSL | Windows | Install, Uninstall, Search, List, Update |

## 其他

| ID | 名称 | 描述 | 能力 |
|----|------|------|------|
| `github` | GitHub Releases | 从 GitHub 下载 | Search, Install |
| `gitlab` | GitLab Releases | 从 GitLab 下载 | Search, Install |
| `psgallery` | PowerShell Gallery | PowerShell 模块 | Install, Uninstall, Search, List |
| `asdf` | asdf | 多语言版本管理器 | Install, Uninstall, List, VersionSwitch |
| `mise` | mise | 多语言版本管理器 | Install, Uninstall, List, VersionSwitch |
| `system` | System Detection | 系统运行时检测（10 种） | List |

---

## 基础设施文件

| 文件 | 用途 |
|------|------|
| `mod.rs` | 模块导出和 Provider 特质定义 |
| `traits.rs` | 特质接口（Provider/EnvironmentProvider/SystemPackageProvider/CustomSourceProvider） |
| `registry.rs` | Provider 注册表和发现 |
| `api.rs` | 包 API 客户端（npm/PyPI/crates.io 镜像支持） |
| `node_base.rs` | Node.js Provider 共享工具和宏 |
| `system.rs` | 系统运行时检测（10 种环境类型） |
