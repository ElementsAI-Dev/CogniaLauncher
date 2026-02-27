# 快速上手

本指南帮助你在 5 分钟内体验 CogniaLauncher 的核心功能。

---

## 启动应用

### Web 模式

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 桌面模式

```bash
pnpm tauri dev
```

此命令会同时启动 Next.js 开发服务器和 Tauri 桌面窗口。

---

## 核心功能导览

### 1. 仪表板

启动后首先看到的是仪表板页面，它提供：

- **环境概览** — 已安装的运行时环境及版本
- **快速操作** — 常用功能的快捷入口
- **系统状态** — Provider 可用性、缓存使用情况
- **可定制小部件** — 拖拽排序、显示/隐藏

### 2. 环境管理

导航至 **环境** 页面：

- 查看已安装的 Node.js、Python、Rust 等环境
- 安装新版本（带进度追踪和取消支持）
- 切换全局/项目级版本
- 版本别名解析（如 `lts`、`latest`、`stable`）

### 3. 包管理

导航至 **包** 页面：

- 搜索 51+ Provider 中的软件包
- 一键安装/卸载
- 查看包详情（版本、依赖、许可证）
- 批量操作支持

### 4. 命令面板

按 ++ctrl+k++（macOS: ++cmd+k++）打开命令面板：

- 搜索所有功能和页面
- 快速导航
- 执行常用操作

---

## 项目结构概览

```text
CogniaLauncher/
├── app/                      # Next.js App Router（页面路由）
├── components/               # React 组件
│   ├── ui/                   # shadcn/ui 基础组件
│   ├── dashboard/            # 仪表板组件
│   ├── settings/             # 设置组件
│   └── ...                   # 其他功能组件
├── hooks/                    # React Hooks（51 个）
├── lib/                      # 工具库与状态管理
│   ├── stores/               # Zustand Stores（9 个）
│   ├── theme/                # 主题系统
│   ├── constants/            # 常量定义
│   └── tauri.ts              # Tauri API 绑定
├── messages/                 # i18n 翻译文件
├── src-tauri/                # Tauri/Rust 后端
│   ├── src/commands/         # Tauri 命令（217+）
│   ├── src/provider/         # Provider 实现（51+）
│   ├── src/core/             # 核心业务逻辑
│   └── src/cache/            # 缓存系统
├── types/                    # TypeScript 类型定义
└── docs/                     # 文档（本站）
```

---

## 下一步

- **[配置说明](configuration.md)** — 自定义网络、代理、镜像源等
- **[使用指南](../guide/dashboard.md)** — 深入了解每个功能模块
- **[Provider 列表](../reference/providers-list.md)** — 查看所有支持的包管理器
