# CogniaLauncher 文档索引

> Last Updated: 2026-02-23 | v1.4.0

本文档提供 CogniaLauncher 项目的 AI 上下文文档导航索引。

## 快速查找 v1.4.0 新增内容

| 类型 | 描述 |
|------|------|
| 功能 | WSL 管理系统 (安装/导出/导入/配置/终端/网络/文件系统) |
| 功能 | 引导向导 (Onboarding) 和交互式巡览 |
| 功能 | 内置文档查看器 (`/docs` 路由，Markdown 渲染) |
| 功能 | GitLab Releases 下载支持 |
| 功能 | 启动/Shim/PATH 管理系统 |
| 功能 | 无边框窗口和自定义标题栏 |
| 功能 | Kotlin 语言支持 (SDKMAN) |
| 增强 | 48 个 Provider (新增 14 个：asdf, bun, conan, conda, gem, gitlab, macports, mise, nix, pipx, podman, volta, wsl, xmake) |
| 增强 | 260+ Tauri 命令 (跨 20 个模块) |
| 增强 | 100+ 测试文件 (55+ 组件测试, 270+ Rust 单元测试) |

---

## v1.4.0 更新内容 (2026-02-23)

### 新增功能
- **WSL 管理**: 完整的 Windows Subsystem for Linux 管理 (21+ 命令，distro 详情页含文件系统/网络/服务/终端)
- **引导系统**: 首次运行引导向导 + 交互式巡览覆盖层
- **文档查看器**: 内置 Markdown 文档浏览器，支持 TOC 和侧边栏导航
- **GitLab 集成**: GitLab Releases 下载支持 (15 条命令)
- **启动/Shim/PATH**: 环境激活、Shim 创建、PATH 管理 (16 条命令)
- **无边框窗口**: 自定义标题栏，Windows 最大化边距补偿
- **Kotlin 支持**: 通过 SDKMAN 管理 Kotlin 编译器

### 新增 Provider (14 个)
- `asdf`, `bun`, `conan`, `conda`, `gem`, `gitlab`, `macports`, `mise`, `nix`, `pipx`, `podman`, `volta`, `wsl`, `xmake`

### 架构增强
- **Provider 系统**: 完整审计和修复，48 个 Provider 全部经过 bug 修复
- **核心模块**: 新增 eol, history, project_env_detect (共 12 个)
- **Zustand Stores**: 新增 dashboard, onboarding, window-state (共 8 个)
- **路由**: 新增 docs, package detail, provider detail, wsl distro detail (共 16 页)
- **测试**: 100+ 测试文件 (Frontend), 270+ Rust 单元测试

### v1.3.0 更新 (2026-02-05)
- Health Check 系统、Profiles 系统
- 新增 deno, phpbrew, bundler, composer, dotnet, poetry 提供商
- 增强版本元数据 (发布日期、yanked/deprecated 状态)

---

## 文档结构

### 根级文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 项目主上下文 | `/CLAUDE.md` | 项目总览、架构、开发指南 |
| OpenSpec 规范 | `/openspec/CLAUDE.md` | 变更提案规范 |
| Tauri 后端 | `/src-tauri/CLAUDE.md` | Rust 后端模块文档 |
| 文档索引 | `/llmdoc/index.md` | 完整软件设计文档 |

### LLM 文档 (llmdoc/)

#### 概述 (overview/)
| 文档 | 描述 |
|------|------|
| `batch-operations.md` | 批量操作系统概览 |
| `command-palette.md` | 命令面板概览 |
| `custom-detection-system.md` | 自定义检测系统概览 |
| `downloads-system.md` | 下载管理系统概览 |
| `health-check-system.md` | 健康检查系统概览 |
| `profiles-system.md` | 环境配置文件系统概览 |
| `settings-and-theme-system.md` | 设置和主题系统概览 |
| `system-tray.md` | 系统托盘概览 |
| `testing-infrastructure.md` | Jest 30 测试框架概览 |

#### 指南 (guides/)
| 文档 | 描述 |
|------|------|
| `add-accent-color.md` | 添加自定义强调色 |
| `add-settings-section.md` | 添加设置页面部分 |
| `batch-progress-integration.md` | 集成批量操作进度 |
| `command-palette-actions.md` | 向命令面板添加操作 |
| `custom-detection-integration.md` | 集成自定义检测规则 |
| `downloads-integration.md` | 集成下载系统 |
| `implementing-environment-installation-cancellation.md` | 实现环境安装取消 |
| `system-tray-integration.md` | 扩展系统托盘功能 |
| `testing-guide.md` | 测试代码和运行测试 |

#### 架构 (architecture/)
| 文档 | 描述 |
|------|------|
| `batch-operations-system.md` | 批量操作系统架构 |
| `cache-system.md` | 缓存系统架构 (SQLite + JSON) |
| `command-palette.md` | 命令面板组件架构 |
| `custom-detection-system.md` | 自定义检测系统架构 |
| `dashboard-components.md` | 仪表板 UI 组件架构 (flexbox 布局, 文本溢出处理) |
| `downloads-system.md` | 下载管理器架构 |
| `environment-installation-progress.md` | 环境安装进度架构 |
| `log-panel-system.md` | 日志面板系统架构 |
| `provider-system.md` | Provider 系统架构 (40+ providers, system detection) |
| `self-update-system.md` | 自更新系统架构 |
| `settings-system.md` | 设置系统架构 |
| `settings-ui-components.md` | 设置 UI 组件架构 |
| `ssr-internationalization.md` | SSR 安全的国际化架构 (useSyncExternalStore) |
| `testing-architecture.md` | 测试框架架构 |
| `system-tray.md` | 系统托盘架构 |

#### 参考 (reference/)
| 文档 | 描述 |
|------|------|
| `auto-version-detection.md` | 自动版本检测和切换 |
| `batch-api.md` | 批量操作 API 参考 |
| `cache-commands.md` | 缓存命令参考 |
| `custom-detection-api.md` | 自定义检测 API 参考 |
| `downloads-api.md` | 下载系统 API 参考 |
| `environment-version-alias-resolution.md` | 环境版本别名解析 |
| `error-handling.md` | 错误处理和解析 |
| `keyboard-shortcuts.md` | 键盘快捷键系统 |
| `provider-version-detection.md` | Provider 版本检测增强 API |
| `settings-and-theme-apis.md` | 设置和主题 API 参考 |
| `theme-system.md` | 主题和颜色系统 |
| `tray-api.md` | 系统托盘 API 参考 |
| `version-caching.md` | 版本列表缓存 |

### 模块级文档

| 模块 | 路径 | 说明 |
|------|------|------|
| Frontend | `app/`, `components/`, `lib/` | Next.js 16 + React 19 前端 |
| Backend | `src-tauri/` | Rust + Tauri 后端 |
| OpenSpec | `openspec/` | 规范与变更提案 |

---

## 快速导航

### 按功能区域

#### 环境管理
- **前端**: `app/environments/page.tsx`
- **组件**: `components/environments/`
- **状态**: `lib/stores/environment.ts`
- **后端**: `src-tauri/src/commands/environment.rs` - 环境命令

#### 包管理
- **前端**: `app/packages/page.tsx`
- **组件**: `components/packages/`
- **状态**: `lib/stores/packages.ts`
- **后端**: `src-tauri/src/commands/package.rs` - 包命令

#### Provider 系统 (v1.4.0 增强)
- **后端**: `src-tauri/src/provider/` - 48 provider 实现 + 6 基础设施文件
- **注册表**: `src-tauri/src/provider/registry.rs` - Provider 注册和发现
- **Traits**: `src-tauri/src/provider/traits.rs` - Provider trait 定义和系统检测
- **系统检测**: `src-tauri/src/provider/system.rs` - 系统安装的运行时检测 (11 种类型)
- **前端**: `app/providers/page.tsx` - Provider 管理 UI
- **详情页**: `app/providers/[id]/page.tsx` - 单个 Provider 配置详情
- **组件**: `components/provider-management/` - Provider 卡片、列表、工具栏
- **常量**: `lib/constants/environments.ts` - 11 种语言环境定义
- **架构**: `llmdoc/architecture/provider-system.md` - Provider 系统架构
- **版本检测 API**: `llmdoc/reference/provider-version-detection.md` - 增强版本元数据 API
- **环境管理器**: nvm, fnm, volta, pyenv, rustup, rbenv, sdkman, goenv, phpbrew, deno, asdf, mise
- **语言包管理器**: npm, pnpm, yarn, bun, pip, uv, poetry, pipx, conda, cargo, gem, bundler, composer, dotnet
- **系统包管理器**: brew, macports, apt, dnf, pacman, zypper, apk, snap, flatpak, nix, winget, chocolatey, scoop
- **C/C++**: vcpkg, conan, xmake
- **其他**: docker, podman, github, gitlab, psgallery, wsl, system

#### 自定义检测系统
- **后端**: `src-tauri/src/core/custom_detection.rs` - 核心检测逻辑
- **命令**: `src-tauri/src/commands/custom_detection.rs` - 17 条命令
- **前端**: `lib/tauri.ts:1008-1150` - TypeScript 类型和命令包装器
- **总览**: `llmdoc/overview/custom-detection-system.md` - 系统概览
- **架构**: `llmdoc/architecture/custom-detection-system.md` - 系统架构
- **集成指南**: `llmdoc/guides/custom-detection-integration.md` - 集成指南
- **API 参考**: `llmdoc/reference/custom-detection-api.md` - API 参考
- **功能**: 用户定义版本检测规则，支持 9 种提取策略

#### 健康检查系统
- **后端**: `src-tauri/src/core/health_check.rs` - 健康检查核心逻辑
- **命令**: `src-tauri/src/commands/health_check.rs` - 2 条命令
- **前端**: `hooks/use-health-check.ts` - 健康检查 Hook
- **组件**: `components/environments/health-check-panel.tsx` - 健康检查面板
- **总览**: `llmdoc/overview/health-check-system.md` - 系统概览
- **架构**: `llmdoc/architecture/health-check-system.md` - 系统架构
- **功能**: 环境和系统健康检查，问题检测

#### 环境配置文件系统
- **后端**: `src-tauri/src/core/profiles.rs` - 配置文件核心逻辑
- **命令**: `src-tauri/src/commands/profiles.rs` - 9 条命令
- **前端**: `hooks/use-profiles.ts` - 配置文件 Hook
- **总览**: `llmdoc/overview/profiles-system.md` - 系统概览
- **架构**: `llmdoc/architecture/profiles-system.md` - 系统架构
- **API 参考**: `llmdoc/reference/profiles-api.md` - API 参考
- **功能**: 环境配置文件管理，快速切换，导入导出

#### 缓存管理
- **后端**: `src-tauri/src/cache/` - SQLite + JSON 双后端缓存系统
- **架构**: `/llmdoc/architecture/cache-system.md` - 缓存系统架构
- **命令**: `/llmdoc/reference/cache-commands.md` - 缓存命令参考
- **前端**: `app/cache/page.tsx`
- **规范**: `openspec/specs/cache-management/spec.md`

#### 下载管理
- **后端**: `src-tauri/src/download/` - 下载管理器 (队列、节流、历史)
- **命令**: `src-tauri/src/commands/download.rs` - Tauri 下载命令
- **前端**: `app/downloads/page.tsx` - 下载 UI
- **总览**: `llmdoc/overview/downloads-system.md` - 系统概览
- **架构**: `llmdoc/architecture/downloads-system.md` - 系统架构
- **集成指南**: `llmdoc/guides/downloads-integration.md` - 集成指南
- **API 参考**: `llmdoc/reference/downloads-api.md` - API 参考

#### 设置与主题
- **前端**: `app/settings/page.tsx`
- **状态**: `lib/stores/settings.ts`, `lib/stores/appearance.ts`
- **主题**: `lib/theme/`, `components/providers/theme-provider.tsx`
- **国际化**: `components/providers/locale-provider.tsx`, `lib/i18n.ts`
- **组件**: `components/settings/`
- **总览**: `llmdoc/overview/settings-and-theme-system.md`
- **架构**: `llmdoc/architecture/settings-system.md`, `llmdoc/architecture/settings-ui-components.md`, `llmdoc/architecture/ssr-internationalization.md`
- **指南**: `llmdoc/guides/add-settings-section.md`, `llmdoc/guides/add-accent-color.md`
- **API 参考**: `llmdoc/reference/settings-and-theme-apis.md`

#### 命令面板
- **前端**: `components/command-palette.tsx` - 命令面板组件
- **UI 组件**: `components/ui/command/` - shadcn/ui Command 组件
- **快捷键**: `Ctrl+K` (或 `Cmd+K`)
- **总览**: `llmdoc/overview/command-palette.md` - 系统概览
- **架构**: `llmdoc/architecture/command-palette.md` - 组件架构
- **扩展指南**: `llmdoc/guides/command-palette-actions.md` - 添加操作

#### 仪表板组件
- **前端**: `app/page.tsx` - 仪表板主页
- **组件**: `components/dashboard/` - 环境列表、包列表、快速搜索、统计卡片
- **状态**: `lib/stores/environment.ts`, `lib/stores/packages.ts`
- **架构**: `llmdoc/architecture/dashboard-components.md` - Flexbox 布局和文本溢出处理模式

#### 系统托盘
- **后端**: `src-tauri/src/tray.rs` - 托盘初始化、状态管理、13个Tauri命令
- **前端**: `components/providers/tray-provider.tsx` - 托盘上下文提供者
- **Hook**: `lib/hooks/use-tray-sync.ts` - 托盘状态同步钩子
- **设置**: `components/settings/tray-settings.tsx` - 托盘设置 UI (autostart, notifications, click behavior)
- **状态**: `lib/stores/settings.ts` (autostart, trayClickBehavior, showNotifications, minimizeToTray, startMinimized)
- **总览**: `llmdoc/overview/system-tray.md` - 系统概览
- **架构**: `llmdoc/architecture/system-tray.md` - 托盘架构
- **扩展指南**: `llmdoc/guides/system-tray-integration.md` - 扩展功能
- **API 参考**: `llmdoc/reference/tray-api.md` - API 参考

#### 日志面板
- **后端**: `src-tauri/src/commands/log.rs` - 日志命令
- **前端**: `app/logs/page.tsx` - 日志页面
- **组件**: `components/log/` - 日志组件
- **状态**: `lib/stores/log.ts` - 日志存储
- **架构**: `llmdoc/architecture/log-panel-system.md` - 日志系统架构

#### 自更新系统
- **后端**: `src-tauri/src/commands/updater.rs`
- **架构**: `llmdoc/architecture/self-update-system.md`

#### 批量操作系统
- **后端**: `src-tauri/src/core/batch.rs`, `src-tauri/src/commands/batch.rs`
- **前端**: `lib/tauri.ts:217-231`
- **总览**: `llmdoc/overview/batch-operations.md`
- **架构**: `llmdoc/architecture/batch-operations-system.md`
- **集成指南**: `llmdoc/guides/batch-progress-integration.md`
- **API 参考**: `llmdoc/reference/batch-api.md`

#### 环境安装进度系统
- **后端**: `src-tauri/src/commands/environment.rs:19-353`
- **前端**: `lib/tauri.ts:10-36`, `components/environments/installation-progress-dialog.tsx`
- **架构**: `llmdoc/architecture/environment-installation-progress.md`
- **版本别名**: `llmdoc/reference/environment-version-alias-resolution.md`
- **取消实现**: `llmdoc/guides/implementing-environment-installation-cancellation.md`

#### 自定义检测系统
- **后端**: `src-tauri/src/core/custom_detection.rs`, `src-tauri/src/commands/custom_detection.rs`
- **前端**: `lib/tauri.ts:1008-1150` - TypeScript types and command wrappers
- **总览**: `llmdoc/overview/custom-detection-system.md`
- **架构**: `llmdoc/architecture/custom-detection-system.md`
- **集成指南**: `llmdoc/guides/custom-detection-integration.md`
- **API 参考**: `llmdoc/reference/custom-detection-api.md`

#### 健康检查系统
- **后端**: `src-tauri/src/core/health_check.rs`, `src-tauri/src/commands/health_check.rs`
- **前端**: `hooks/use-health-check.ts`, `components/environments/health-check-panel.tsx`
- **总览**: `llmdoc/overview/health-check-system.md`
- **架构**: `llmdoc/architecture/health-check-system.md`

#### 环境配置文件系统
- **后端**: `src-tauri/src/core/profiles.rs`, `src-tauri/src/commands/profiles.rs`
- **前端**: `hooks/use-profiles.ts`
- **总览**: `llmdoc/overview/profiles-system.md`
- **架构**: `llmdoc/architecture/profiles-system.md`
- **API 参考**: `llmdoc/reference/profiles-api.md`

#### WSL 管理系统
- **后端**: `src-tauri/src/provider/wsl.rs` - WSL Provider
- **命令**: `src-tauri/src/commands/wsl.rs` - 21+ WSL 命令
- **前端**: `app/wsl/page.tsx` - WSL 分发列表页面
- **详情页**: `app/wsl/distro/page.tsx` - Distro 详情 (概览/文件系统/网络/服务/终端)
- **组件**: `components/wsl/` - 33 个 WSL 组件文件
- **Hook**: `hooks/use-wsl.ts` - WSL 操作 Hook
- **功能**: 安装/卸载、导出/导入、配置管理、终端执行、网络信息、文件系统管理

#### 引导系统 (Onboarding)
- **组件**: `components/onboarding/onboarding-wizard.tsx` - 引导向导
- **组件**: `components/onboarding/tour-overlay.tsx` - 交互式巡览覆盖层
- **步骤**: `components/onboarding/steps/` - 引导步骤
- **状态**: `lib/stores/onboarding.ts` - 引导进度状态
- **Hook**: `hooks/use-onboarding.ts` - 引导操作 Hook

#### 文档查看器
- **前端**: `app/docs/[[...slug]]/page.tsx` - 文档路由 (catch-all)
- **组件**: `components/docs/` - Markdown 渲染器、侧边栏、TOC
- **数据**: `lib/docs/content.ts` - 文档内容
- **导航**: `lib/docs/navigation.ts` - 文档导航树

#### GitLab 集成
- **后端**: `src-tauri/src/commands/gitlab.rs` - 15 条 GitLab 命令
- **后端**: `src-tauri/src/provider/gitlab.rs` - GitLab Releases Provider
- **Hook**: `hooks/use-gitlab-downloads.ts` - GitLab 下载 Hook

#### 启动/Shim/PATH 系统
- **后端**: `src-tauri/src/commands/launch.rs` - 6 条启动命令
- **后端**: `src-tauri/src/commands/shim.rs` - 10 条 Shim/PATH 命令
- **Hook**: `hooks/use-launch.ts` - 启动操作 Hook
- **Hook**: `hooks/use-shim.ts` - Shim/PATH 管理 Hook

#### 测试基础设施
- **配置**: `jest.config.ts` - Jest 30 配置和覆盖率阈值
- **总览**: `llmdoc/overview/testing-infrastructure.md` - 测试框架概览
- **架构**: `llmdoc/architecture/testing-architecture.md` - 100+ 测试文件
- **指南**: `llmdoc/guides/testing-guide.md` - 测试代码和运行测试
- **Rust 测试**: 270+ 单元测试 (Provider 解析、版本检测)

### 按技术栈

#### TypeScript/React
- 类型定义: `lib/tauri.ts`, `types/tauri.ts`
- Hooks: `hooks/` (35+ hooks)
- UI 组件: `components/ui/` (26+ shadcn/ui 组件)
- 功能组件: `components/` (15 个功能目录)
- 状态: `lib/stores/` (8 Zustand stores)
- 文档: `lib/docs/` (内容和导航)

#### Rust
- 命令: `src-tauri/src/commands/` - 20 个模块, 260+ 命令
- 核心逻辑: `src-tauri/src/core/` (12 模块: batch, custom_detection, environment, eol, health_check, history, installer, orchestrator, profiles, project_env_detect, shim)
- Provider: `src-tauri/src/provider/` - 48 提供商 + 6 基础设施文件
- 平台抽象: `src-tauri/src/platform/`
- 缓存系统: `src-tauri/src/cache/`
- 下载管理: `src-tauri/src/download/`
- 系统托盘: `src-tauri/src/tray.rs`
- 自定义检测: `src-tauri/src/core/custom_detection.rs`

---

## 开发工作流文档

### 添加新功能
1. 阅读 `openspec/AGENTS.md` 了解变更提案规范
2. 在 `openspec/specs/` 创建功能规范
3. 阅读相关模块的 `CLAUDE.md`
4. 实现功能（前端/后端）
5. 更新 `llmdoc/` 文档系统

### 添加新 Provider
1. 实现 Rust trait: `src-tauri/src/provider/{name}.rs`
2. 注册到: `src-tauri/src/provider/mod.rs`
3. 更新规范: `openspec/specs/provider-system/`
4. 添加前端配置 UI

### 调试
- 前端: `pnpm dev` (http://localhost:3000)
- 桌面: `pnpm tauri dev`
- 类型检查: `pnpm exec tsc --noEmit`
- 测试: `pnpm test`

---

## 文档维护

- **当前版本:** v1.4.0 (2026-02-23)
- **覆盖范围:** 95% (380/400+ files)
- **文档总数:** 49 (概述: 9, 指南: 9, 架构: 17, 参考: 14)
- **Provider 数量:** 48
- **Tauri 命令:** 260+
- **命令模块:** 20
- **核心模块:** 12
- **Hooks:** 35+
- **Zustand Stores:** 8
- **前端路由:** 16 页
- **测试文件:** 100+ (前端) + 270+ (Rust)
- **更新频率:** 每次重大功能变更后
- **责任:** 开发团队
- **审查:** 技术负责人

---

## 相关资源

- [README.md](/README.md) - 用户文档
- [AGENTS.md](/AGENTS.md) - AI 指南
- [docs/development/ci-cd.md](/docs/development/ci-cd.md) - CI/CD 配置
- [docs/development/testing.md](/docs/development/testing.md) - 测试指南
