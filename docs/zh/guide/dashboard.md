# 仪表板

仪表板是 CogniaLauncher 的主页面，提供系统状态概览和快速操作入口。

---

## 功能概述

### 环境概览

仪表板顶部展示已安装的运行时环境状态：

- **已安装环境数量** — Node.js、Python、Rust 等
- **当前激活版本** — 全局正在使用的版本
- **可用更新** — 检测到的版本更新

### 快速操作

- 一键安装常用环境
- 快速切换版本
- 打开设置页面

### 可定制小部件

仪表板支持小部件自定义：

- **拖拽排序** — 使用 `@dnd-kit` 实现拖拽重排
- **显示/隐藏** — 通过定制对话框控制小部件可见性
- **持久化** — 布局偏好保存在 Zustand Store 中

### 系统状态

- Provider 可用性检查
- 缓存使用情况统计
- 网络连接状态

---

## 相关组件

| 组件 | 路径 | 描述 |
|------|------|------|
| DashboardPage | `app/page.tsx` | 仪表板页面 |
| EnvironmentList | `components/dashboard/environment-list.tsx` | 环境列表 |
| CustomizeDialog | `components/dashboard/customize-dialog.tsx` | 定制对话框 |
| StatusCards | `components/dashboard/status-card.tsx` | 状态卡片 |
| Widgets | `components/dashboard/widgets/` | 小部件集合 |

---

## 状态管理

仪表板数据存储在 `lib/stores/dashboard.ts`（Zustand）：

- 小部件顺序与可见性
- 用户偏好
- 缓存的统计数据
