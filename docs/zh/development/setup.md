# 开发环境搭建

## 前置要求

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | 20.x+ | JavaScript 运行时 |
| pnpm | 8.x+ | 包管理器 |
| Rust | 1.70+ | 后端编译（可选） |
| Git | 2.x+ | 版本控制 |

---

## 快速开始

```bash
# 1. 克隆仓库
git clone <repo-url>
cd CogniaLauncher

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev          # 仅前端（Web 模式）
pnpm tauri dev    # 前端 + 桌面（需要 Rust）
```

---

## 项目结构

```text
CogniaLauncher/
├── app/                 # Next.js App Router 路由
├── components/          # React 组件
│   └── ui/              # shadcn/ui 基础组件
├── hooks/               # 自定义 React Hooks (51)
├── lib/                 # 工具库
│   ├── stores/          # Zustand Stores (9)
│   ├── theme/           # 主题系统
│   ├── constants/       # 常量定义
│   └── tauri.ts         # Tauri API 绑定
├── messages/            # i18n 翻译 (en/zh)
├── types/               # TypeScript 类型
├── src-tauri/           # Rust 后端
│   └── src/
│       ├── commands/    # Tauri 命令 (217+)
│       ├── provider/    # Provider (51+)
│       ├── core/        # 核心逻辑
│       └── cache/       # 缓存系统
├── docs/                # 文档（本站）
├── llmdoc/              # AI 上下文文档
└── openspec/            # 变更规范
```

---

## 开发命令

### 前端

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Next.js 开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm lint` | 运行 ESLint |
| `pnpm lint --fix` | 自动修复 lint 问题 |
| `pnpm test` | 运行 Jest 测试 |
| `pnpm test:watch` | 监听模式测试 |
| `pnpm test:coverage` | 测试覆盖率 |

### 后端

| 命令 | 描述 |
|------|------|
| `cargo check` | 检查 Rust 编译 |
| `cargo test` | 运行 Rust 测试 |
| `cargo clippy` | 运行 Rust linter |
| `pnpm tauri dev` | 启动桌面开发模式 |
| `pnpm tauri build` | 构建桌面应用 |

---

## IDE 配置

### VS Code 推荐扩展

- **Tailwind CSS IntelliSense** — 样式提示
- **ESLint** — 代码质量
- **rust-analyzer** — Rust 语言支持
- **Tauri** — Tauri 开发工具
- **Even Better TOML** — TOML 文件支持

### 路径别名

项目配置了以下路径别名（`tsconfig.json`）：

```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

使用方式：`import { Button } from "@/components/ui/button"`
