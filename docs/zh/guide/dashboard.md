# 仪表板

仪表板是 CogniaLauncher 的主页面，提供系统状态概览与可完整自定义的首页布局。

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

### 完整布局自定义

首页自定义由两个联动入口组成：

- **Header 编辑模式** — 在网格内启用拖拽排序、尺寸调整、显隐切换、移除操作。
- **自定义对话框** — 管理组件目录、分类过滤、添加操作与恢复默认。

行为保障：

- **统一策略来源** — 添加/移除/显隐都基于同一组件注册策略（`allowMultiple`、`required`、`defaultVisible`）。
- **受策略约束的添加** — 达到实例上限的组件在对话框中会显示为不可继续添加。
- **确定性恢复默认** — 恢复默认始终回到同一套标准组件集合与顺序。
- **持久化与迁移安全** — 布局恢复/迁移时会归一化异常数据（非法尺寸、重复 ID、未知组件、无效载荷回退）。

### 系统状态

- Provider 可用性检查
- 缓存使用情况统计
- 网络连接状态

---

## 相关组件

| 组件 | 路径 | 描述 |
|------|------|------|
| DashboardPage | `app/page.tsx` | 仪表板页面与 Header 交互流 |
| WidgetGrid | `components/dashboard/widget-grid.tsx` | 组件网格渲染与编辑操作 |
| WidgetWrapper | `components/dashboard/widget-wrapper.tsx` | 单组件编辑工具条 |
| CustomizeDialog | `components/dashboard/customize-dialog.tsx` | 组件目录与恢复默认控制 |
| Widgets | `components/dashboard/widgets/` | 小部件集合 |

---

## 状态管理

仪表板布局数据存储在 `lib/stores/dashboard.ts`（Zustand）：

- 小部件顺序、尺寸与可见性
- Store/UI 共享的组件实例策略 helper
- 持久化布局迁移与归一化
