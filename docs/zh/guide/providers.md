# Provider 系统

Provider 是 CogniaLauncher 的核心抽象，每个 Provider 封装一个具体的包管理器或版本管理器。

---

## Provider 分类

### 系统包管理器

| Provider | 平台 | 描述 |
|----------|------|------|
| winget | Windows | Windows Package Manager |
| scoop | Windows | Scoop 包管理器 |
| chocolatey | Windows | Chocolatey 包管理器 |
| brew | macOS | Homebrew |
| macports | macOS | MacPorts |
| apt | Linux (Debian) | APT 包管理器 |
| dnf | Linux (Fedora) | DNF 包管理器 |
| pacman | Linux (Arch) | Pacman 包管理器 |
| zypper | Linux (openSUSE) | Zypper 包管理器 |
| apk | Linux (Alpine) | APK 包管理器 |
| snap | Linux | Snap 包管理器 |
| flatpak | Linux | Flatpak 包管理器 |
| nix | Linux/macOS | Nix 包管理器 |

### 语言包管理器

| Provider | 语言 | 描述 |
|----------|------|------|
| npm | Node.js | npm 包管理器 |
| pnpm | Node.js | pnpm 包管理器 |
| yarn | Node.js | Yarn 包管理器 |
| bun | Node.js | Bun 包管理器 |
| pip | Python | pip 包管理器 |
| uv | Python | uv 快速包管理器 |
| poetry | Python | Poetry 项目管理器 |
| pipx | Python | pipx CLI 工具管理器 |
| cargo | Rust | Cargo 包管理器 |
| composer | PHP | Composer 包管理器 |
| bundler | Ruby | Bundler 包管理器 |
| gem | Ruby | RubyGems |
| dotnet | .NET | NuGet 包管理器 |
| goenv | Go | Go 模块管理 |

### 版本/环境管理器

| Provider | 管理对象 | 描述 |
|----------|----------|------|
| nvm | Node.js | Node Version Manager |
| fnm | Node.js | Fast Node Manager |
| volta | Node.js | Volta 工具链管理器 |
| pyenv | Python | Python 版本管理器 |
| rustup | Rust | Rust 工具链管理器 |
| sdkman | Java | SDKMAN（Java、Kotlin、Gradle、Maven、Scala） |
| sdkman-kotlin | Kotlin | SDKMAN Kotlin 候选 |
| rbenv | Ruby | Ruby 版本管理器 |
| phpbrew | PHP | PHPBrew 版本管理器 |
| deno | Deno | Deno 运行时 |
| goenv | Go | Go 版本管理器 |
| asdf | 多语言 | asdf 版本管理器 |
| mise | 多语言 | mise 版本管理器 |

### 容器与虚拟化

| Provider | 描述 |
|----------|------|
| docker | Docker 容器管理 |
| podman | Podman 容器管理 |
| wsl | Windows Subsystem for Linux |

### C/C++ 包管理器

| Provider | 描述 |
|----------|------|
| vcpkg | vcpkg C/C++ 包管理器 |
| conan | Conan C/C++ 包管理器 |
| xmake | Xmake/Xrepo C/C++ 包管理器 |

### 其他

| Provider | 描述 |
|----------|------|
| github | GitHub Releases 下载 |
| gitlab | GitLab Releases 下载 |
| psgallery | PowerShell Gallery |
| system | 系统运行时检测（10 种环境） |

---

## Provider 能力

每个 Provider 声明其支持的能力：

| 能力 | 描述 |
|------|------|
| `Install` | 安装包/版本 |
| `Uninstall` | 卸载包/版本 |
| `Search` | 搜索包 |
| `List` | 列出已安装 |
| `Update` | 更新包 |
| `Upgrade` | 升级所有包 |
| `UpdateIndex` | 更新包索引 |
| `LockVersion` | 锁定版本 |
| `Rollback` | 版本回滚 |
| `VersionSwitch` | 版本切换（环境 Provider） |
| `MultiVersion` | 多版本共存（环境 Provider） |
| `ProjectLocal` | 项目级版本（环境 Provider） |

---

## Provider 优先级

Provider 按优先级排序，高优先级 Provider 优先使用。可在设置中调整优先级和启用/禁用状态。

优先级范围：0-100，数值越大优先级越高。

---

## 完整列表

查看 [Provider 列表参考](../reference/providers-list.md) 获取所有 51+ Provider 的详细信息。
