# CogniaLauncher

**跨平台环境与包管理器** — 使用现代图形界面管理开发环境和软件包。

基于 **Next.js 16** + **React 19** + **Tauri 2.9** 构建，提供原生桌面性能。

---

## 核心功能

| 功能 | 描述 |
|------|------|
| 🔧 **环境管理** | 管理 Node.js、Python、Rust、Java、Kotlin、Go、Ruby、PHP、Deno 等运行时版本 |
| 📦 **包管理** | 搜索、安装、更新来自 51+ Provider 的软件包 |
| 💾 **缓存管理** | SQLite + JSON 双后端缓存，支持清理、验证、修复 |
| 📥 **下载管理** | 队列式下载，支持限速、并发控制、断点续传、历史记录 |
| 🖥️ **WSL 管理** | Windows 子系统管理，支持导入/导出、磁盘挂载、配置编辑 |
| ⌨️ **命令面板** | 全局快捷搜索，快速访问所有功能 |
| 📊 **批量操作** | 批量安装/卸载/更新，带进度追踪和依赖解析 |
| 🔍 **自定义检测** | 用户定义版本检测规则，支持 9 种提取策略 |
| 🏥 **健康检查** | 环境和系统诊断，提供修复建议 |
| 📸 **配置快照** | 环境配置的 Profile 管理 |
| 🎨 **现代 UI** | shadcn/ui + Tailwind CSS v4，支持多主题和强调色 |
| 🌐 **国际化** | 中英文双语支持 |
| 🔄 **自动更新** | 内置应用自更新系统 |
| 🧪 **测试覆盖** | Jest 30 + Testing Library 完整测试套件 |

---

## 技术栈

### 前端

- **Next.js 16** — App Router，静态导出
- **React 19** — 最新 React 特性
- **Tailwind CSS v4** — 原子化样式
- **shadcn/ui** — 高质量 UI 组件
- **Zustand 5** — 轻量状态管理（持久化）
- **next-intl** — 国际化
- **Recharts** — 数据可视化
- **cmdk** — 命令面板

### 后端

- **Tauri 2.9** — 原生桌面框架
- **Rust** — 高性能后端逻辑
- **SQLite** — 缓存与状态存储
- **51+ Provider** — 可扩展的包源系统

### 开发工具

- **Jest 30** — 单元测试
- **Testing Library** — 组件测试
- **ESLint** — 代码质量
- **GitHub Actions** — CI/CD

---

## 支持的平台

| 平台 | 架构 | 安装格式 |
|------|------|----------|
| Windows | x64 | MSI, NSIS |
| macOS | x64, ARM64 | DMG |
| Linux | x86_64 | AppImage, .deb |

---

## 快速导航

- **[安装指南](getting-started/installation.md)** — 从零开始安装 CogniaLauncher
- **[快速上手](getting-started/quick-start.md)** — 5 分钟快速体验核心功能
- **[配置说明](getting-started/configuration.md)** — 自定义应用配置
- **[使用指南](guide/dashboard.md)** — 详细功能使用教程
- **[架构设计](architecture/overview.md)** — 系统架构与设计思想
- **[开发者指南](development/setup.md)** — 参与项目开发
- **[API 参考](reference/commands.md)** — 完整的 API 和命令参考
- **[Provider 列表](reference/providers-list.md)** — 51+ Provider 详细信息

---

## 项目状态

| 指标 | 数值 |
|------|------|
| Provider 数量 | 51+ |
| Tauri 命令 | 217+ |
| React Hooks | 51 |
| Zustand Stores | 9 |
| i18n 键值 | 1640+ |
| 支持语言 | 10+ 运行时环境 |
| 测试覆盖 | Jest 30 + Testing Library |
