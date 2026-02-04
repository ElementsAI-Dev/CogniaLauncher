# CogniaLauncher 文档索引

> Last Updated: 2026-02-05

本文档提供 CogniaLauncher 项目的 AI 上下文文档导航索引。

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
| `downloads-system.md` | 下载管理器架构 |
| `environment-installation-progress.md` | 环境安装进度架构 |
| `log-panel-system.md` | 日志面板系统架构 |
| `provider-system.md` | Provider 系统架构 (35+ providers, system detection) |
| `self-update-system.md` | 自更新系统架构 |
| `settings-system.md` | 设置系统架构 |
| `settings-ui-components.md` | 设置 UI 组件架构 |
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

#### Provider 系统
- **后端**: `src-tauri/src/provider/` - 35+ provider 实现
- **注册表**: `src-tauri/src/provider/registry.rs` - Provider 注册和发现
- **Traits**: `src-tauri/src/provider/traits.rs` - Provider trait 定义和系统检测
- **系统检测**: `src-tauri/src/provider/traits.rs:182-272` - 可执行文件版本检测
- **前端**: `app/providers/page.tsx` - Provider 配置 UI
- **组件**: `components/providers/` - Provider 相关组件
- **常量**: `lib/constants/environments.ts` - 环境类型定义
- **架构**: `llmdoc/architecture/provider-system.md` - Provider 系统架构
- **新提供商**: `rbenv.rs`, `sdkman.rs`, `goenv.rs` - Ruby/Java/Go 版本管理

#### 自定义检测系统
- **后端**: `src-tauri/src/core/custom_detection.rs` - 核心检测逻辑
- **命令**: `src-tauri/src/commands/custom_detection.rs` - 20+ 条命令
- **前端**: `lib/tauri.ts:1008-1150` - TypeScript 类型和命令包装器
- **总览**: `llmdoc/overview/custom-detection-system.md` - 系统概览
- **架构**: `llmdoc/architecture/custom-detection-system.md` - 系统架构
- **集成指南**: `llmdoc/guides/custom-detection-integration.md` - 集成指南
- **API 参考**: `llmdoc/reference/custom-detection-api.md` - API 参考
- **功能**: 用户定义版本检测规则，支持 9 种提取策略

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
- **组件**: `components/settings/`
- **总览**: `llmdoc/overview/settings-and-theme-system.md`
- **架构**: `llmdoc/architecture/settings-system.md`, `llmdoc/architecture/settings-ui-components.md`
- **指南**: `llmdoc/guides/add-settings-section.md`, `llmdoc/guides/add-accent-color.md`
- **API 参考**: `llmdoc/reference/settings-and-theme-apis.md`

#### 命令面板
- **前端**: `components/command-palette.tsx` - 命令面板组件
- **UI 组件**: `components/ui/command/` - shadcn/ui Command 组件
- **快捷键**: `Ctrl+K` (或 `Cmd+K`)
- **总览**: `llmdoc/overview/command-palette.md` - 系统概览
- **架构**: `llmdoc/architecture/command-palette.md` - 组件架构
- **扩展指南**: `llmdoc/guides/command-palette-actions.md` - 添加操作

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

#### 测试基础设施
- **配置**: `jest.config.ts` - Jest 30 配置和覆盖率阈值
- **总览**: `llmdoc/overview/testing-infrastructure.md`
- **架构**: `llmdoc/architecture/testing-architecture.md`
- **指南**: `llmdoc/guides/testing-guide.md`

### 按技术栈

#### TypeScript/React
- 类型定义: `lib/tauri.ts`
- Hooks: `lib/hooks/`, `hooks/`
- UI 组件: `components/ui/`

#### Rust
- 命令: `src-tauri/src/commands/` - 12 个模块
- 核心逻辑: `src-tauri/src/core/`
- Provider: `src-tauri/src/provider/` - 35+ 提供商
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

- 更新频率: 每次重大功能变更后
- 责任: 开发团队
- 审查: 技术负责人

---

## 相关资源

- [README.md](/README.md) - 用户文档
- [AGENTS.md](/AGENTS.md) - AI 指南
- [CI_CD.md](/CI_CD.md) - CI/CD 配置
- [TESTING.md](/TESTING.md) - 测试策略
