# CogniaLauncher 文档索引

> Last Updated: 2026-01-16

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
- **前端**: `app/cache/page.tsx`
- **后端**: `src-tauri/src/cache/`

#### 设置
- **前端**: `app/settings/page.tsx`
- **状态**: `lib/stores/settings.ts`

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
