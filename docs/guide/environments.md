# 环境管理

CogniaLauncher 支持管理多种运行时环境的版本安装与切换。

---

## 支持的环境

| 环境 | Provider | 版本管理器 |
|------|----------|-----------|
| Node.js | nvm, fnm, volta | 多版本共存 |
| Python | pyenv | 多版本共存 |
| Rust | rustup | 工具链管理 |
| Java | SDKMAN | 多发行版支持 |
| Kotlin | SDKMAN (kotlin) | 独立版本管理 |
| Go | goenv | 多版本共存 |
| Ruby | rbenv | 多版本共存 |
| PHP | phpbrew | 多版本共存 |
| Deno | deno | 内置版本管理 |
| .NET | dotnet | SDK 版本管理 |

此外，`system` Provider 可检测系统已安装的运行时版本。

---

## 核心功能

### 版本安装

1. 导航至 **环境** 页面
2. 选择环境类型（如 Node.js）
3. 浏览可用版本列表
4. 点击 **安装** 按钮

安装过程包含以下步骤，均带进度追踪：

- **获取** — 查询版本信息
- **下载** — 下载运行时二进制文件
- **解压** — 解压安装包
- **配置** — 设置环境变量和路径
- **完成** — 安装完成

!!! tip "取消安装"
    安装过程中可以随时点击 **取消** 按钮中止。

### 版本切换

支持三种作用域的版本切换：

- **全局** — 修改 shell 配置文件（`.bashrc`、`.zshrc` 等）
- **项目级** — 写入版本文件（`.node-version`、`.python-version` 等）
- **会话级** — 仅修改当前 shell 会话

### 版本别名

支持以下版本别名自动解析：

| 别名 | 描述 |
|------|------|
| `latest` | 最新稳定版本 |
| `lts` | 最新 LTS 版本（Node.js） |
| `stable` | 稳定版本 |
| `nightly` | 每日构建版本 |

### 自动版本检测

CogniaLauncher 会自动检测项目所需的运行时版本，检测优先级：

1. **项目本地版本文件** — `.node-version`、`.python-version` 等
2. **CogniaLauncher 清单** — `CogniaLauncher.yaml`
3. **全局版本文件** — `~/.CogniaLauncher/versions/`
4. **系统默认** — 系统 PATH 中的版本

### 自定义检测规则

通过 **自定义检测** 功能，可以定义额外的版本检测规则：

- 9 种提取策略（正则、JSON 路径、TOML 字段等）
- 预设规则（可导入常用规则集）
- 按目录/文件匹配

---

## 相关命令

| 命令 | 描述 |
|------|------|
| `env_list` | 列出所有环境类型 |
| `env_get` | 获取环境详情 |
| `env_install` | 安装运行时版本 |
| `env_uninstall` | 卸载运行时版本 |
| `env_use_global` | 设置全局版本 |
| `env_use_local` | 设置项目级版本 |
| `env_detect` | 检测已安装版本 |
| `env_available_versions` | 获取可用版本列表 |
| `env_resolve_alias` | 解析版本别名 |
| `env_install_cancel` | 取消正在进行的安装 |

完整命令参考见 [Tauri 命令](../reference/commands.md)。
