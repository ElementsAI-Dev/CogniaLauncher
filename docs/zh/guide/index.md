# 使用指南

本节详细介绍 CogniaLauncher 的各项功能模块。

## 功能模块

- **[仪表板](dashboard.md)** — 应用主界面，环境概览与快速操作
- **[环境管理](environments.md)** — 管理运行时版本（Node.js、Python、Rust 等）
- **[包管理](packages.md)** — 搜索、安装、更新软件包
- **[Provider 系统](providers.md)** — 了解 51+ 包管理器集成
- **[缓存管理](cache.md)** — 缓存清理、验证与监控
- **[下载管理](downloads.md)** — 下载队列、限速与历史
- **[WSL 管理](wsl.md)** — Windows 子系统管理（仅 Windows）
- **[设置与主题](settings.md)** — 个性化配置与外观
- **[命令面板](command-palette.md)** — 全局快捷搜索
- **[日志系统](logs.md)** — 应用日志查看与分析

## 桌面优先路由说明

应用壳层还包含 `/git`、`/envvar`、`/terminal`、`/health` 等桌面优先路由。
在 Web 模式下，这些路由应展示回退引导而非桌面专属控制。
当这些路由行为变化时，应同步更新相关文档并对齐 E2E 路由覆盖。
