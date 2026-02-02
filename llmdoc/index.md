# CogniaLauncher 文档索引

> Last Updated: 2026-02-02

本文档提供 CogniaLauncher 项目的 AI 上下文文档导航索引。

---

## 文档结构

### 根级文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 项目主上下文 | `/CLAUDE.md` | 项目总览、架构、开发指南 |
| OpenSpec 规范 | `/openspec/CLAUDE.md` | 变更提案规范 |
| Tauri 后端 | `/src-tauri/CLAUDE.md` | Rust 后端模块文档 |
| 文档索引 | `/docs/index.md` | 完整软件设计文档 |

### LLM 文档 (llmdoc/)

#### 概述 (overview/)
| 文档 | 描述 |
|------|------|
| `testing-infrastructure.md` | Jest 30 测试框架概览 |

#### 指南 (guides/)
| 文档 | 描述 |
|------|------|
| `testing-guide.md` | 测试代码和运行测试 |

#### 架构 (architecture/)
| 文档 | 描述 |
|------|------|
| `testing-architecture.md` | 测试框架架构和组件 |

#### 参考 (reference/)
| 文档 | 描述 |
|------|------|
| `error-handling.md` | 错误处理和解析 |
| `keyboard-shortcuts.md` | 键盘快捷键系统 |
| `theme-system.md` | 主题和颜色系统 |
| `version-caching.md` | 版本列表缓存 |
| `auto-version-detection.md` | 自动版本检测和切换 |

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

#### 包管理
- **前端**: `app/packages/page.tsx`
- **组件**: `components/packages/`
- **状态**: `lib/stores/packages.ts`

#### Provider 系统
- **前端**: `app/providers/page.tsx`
- **组件**: `components/providers/`
- **后端**: `src-tauri/src/provider/`

#### 缓存管理
- **后端**: `src-tauri/src/cache/` - SQLite + JSON 双后端缓存系统
- **架构**: `/llmdoc/architecture/cache-system.md` - 缓存系统架构
- **命令**: `/llmdoc/reference/cache-commands.md` - 缓存命令参考
- **前端**: `app/cache/page.tsx`
- **规范**: `openspec/specs/cache-management/spec.md`

#### 设置与主题
- **前端**: `app/settings/page.tsx`
- **状态**: `lib/stores/settings.ts`, `lib/stores/appearance.ts`
- **主题**: `lib/theme/`, `components/providers/theme-provider.tsx`
- **组件**: `components/settings/`
- **总览**: `llmdoc/overview/settings-and-theme-system.md`
- **架构**: `llmdoc/architecture/settings-system.md`, `llmdoc/architecture/settings-ui-components.md`
- **指南**: `llmdoc/guides/add-settings-section.md`, `llmdoc/guides/add-accent-color.md`
- **API 参考**: `llmdoc/reference/settings-and-theme-apis.md`

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
- 命令: `src-tauri/src/commands/`
- 核心逻辑: `src-tauri/src/core/`
- Provider: `src-tauri/src/provider/`
- 平台抽象: `src-tauri/src/platform/`
- 缓存系统: `src-tauri/src/cache/`

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
