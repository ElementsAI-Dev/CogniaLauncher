# 前端架构

CogniaLauncher 前端基于 **Next.js 16** (App Router) + **React 19** 构建。

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.0.10 | 框架（App Router, 静态导出） |
| React | 19.2.0 | UI 库 |
| Tailwind CSS | 4.x | 样式系统 |
| shadcn/ui | 最新 | UI 组件库 |
| Zustand | 5.x | 状态管理 |
| next-intl | 4.x | 国际化 |
| Recharts | 3.x | 数据可视化 |
| cmdk | 1.x | 命令面板 |
| @dnd-kit | 6.x | 拖拽排序 |
| Radix UI | 最新 | 无障碍原语 |
| Lucide React | 最新 | 图标库 |

---

## 路由结构

```
app/
├── page.tsx              # 仪表板（首页）
├── layout.tsx            # 根布局（侧边栏 + 标题栏）
├── loading.tsx           # 全局加载状态
├── error.tsx             # 错误边界
├── not-found.tsx         # 404 页面
├── global-error.tsx      # 全局错误边界
├── environments/
│   ├── page.tsx          # 环境列表
│   └── [envType]/page.tsx # 环境详情（动态路由）
├── packages/
│   ├── page.tsx          # 包管理
│   └── [provider]/page.tsx # Provider 详情
├── cache/
│   ├── page.tsx          # 缓存管理
│   └── [cacheType]/page.tsx # 缓存类型详情
├── downloads/page.tsx    # 下载管理
├── settings/page.tsx     # 设置
├── wsl/page.tsx          # WSL 管理
├── logs/page.tsx         # 日志
└── about/page.tsx        # 关于
```

每个路由页面均配有 `loading.tsx` 加载状态。

---

## 组件架构

### 组件分层

```
components/
├── ui/                # 基础 UI 组件（shadcn/ui）
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── layout/            # 布局组件
│   ├── titlebar.tsx   # 自定义标题栏（无边框窗口）
│   └── sidebar.tsx    # 侧边栏导航
├── dashboard/         # 仪表板功能组件
├── settings/          # 设置功能组件
├── downloads/         # 下载功能组件
├── cache/             # 缓存功能组件
├── wsl/               # WSL 功能组件
├── log/               # 日志功能组件
├── about/             # 关于页组件
├── providers/         # 上下文 Provider 组件
├── app-shell.tsx      # 应用外壳
├── app-sidebar.tsx    # 应用侧边栏
└── command-palette.tsx # 命令面板
```

### 命名约定

- 组件文件：`kebab-case.tsx`（如 `environment-list.tsx`）
- 组件导出：`PascalCase`（如 `EnvironmentList`）
- Hook 文件：`use-*.ts`（如 `use-environments.ts`）
- Store 文件：`*.ts`（如 `appearance.ts`）

---

## 状态管理

### Zustand Stores

| Store | 文件 | 用途 |
|-------|------|------|
| Appearance | `appearance.ts` | 主题、强调色、图表颜色 |
| Dashboard | `dashboard.ts` | 仪表板布局和偏好 |
| Download | `download.ts` | 下载任务状态 |
| Log | `log.ts` | 日志条目和过滤 |
| Settings | `settings.ts` | 通用设置 |
| Window State | `window-state.ts` | 窗口最大化/全屏状态 |

所有 Store 使用 `persist` 中间件，数据存储在 `localStorage`。

### 数据流

```
用户操作 → React 组件 → Hook → Tauri invoke → Rust 命令
                              ↓
                        Zustand Store → React 组件更新
```

---

## 主题系统

### CSS 变量

主题基于 CSS 自定义属性，定义在 `app/globals.css`：

- 颜色变量（背景、前景、强调色等）
- 暗色模式通过 `.dark` class 切换
- 支持自定义强调色
- 6 种图表颜色主题

### 无边框窗口

桌面模式使用自定义标题栏：

- 拖拽区域通过 `app-region: drag` 实现
- 交互元素标记为 `app-region: no-drag`
- Windows 最大化时补偿 8px WS_THICKFRAME 边框
- 窗口状态通过 Zustand Store 跨组件共享

---

## 国际化

使用 `next-intl` 实现：

- 翻译文件：`messages/en.json`、`messages/zh.json`
- 1640+ 键值对
- 组件内通过 `useTranslations()` Hook 使用
- 系统托盘支持多语言
