# CogniaLauncher

一个现代化的跨平台环境和包管理器，具有图形化界面。基于 **Next.js 16**、**React 19** 和 **Tauri 2.9** 构建，提供原生桌面性能。

[English Documentation](./README.md)

## 特性

- 🔧 **环境管理** - 管理 Node.js (nvm/fnm/volta)、Python (pyenv/conda)、Rust (rustup)、Go (goenv)、Ruby (rbenv)、Java/Kotlin (SDKMAN)、PHP、Deno、.NET 版本
- 📦 **包管理** - 从 48 个提供商搜索、安装和更新包
- 🔌 **多提供商支持** - npm、pnpm、yarn、bun、pip、uv、poetry、cargo、gem、Chocolatey、Scoop、winget、Homebrew、apt、dnf、pacman、Nix、vcpkg、Conan、Docker、GitHub/GitLab Releases 等
- 💾 **缓存管理** - SQLite + JSON 双后端缓存系统，支持清理工具和回收站
- ⚙️ **配置系统** - 网络设置、代理、镜像源、安全选项
- 🖥️ **跨平台** - 支持 Windows、macOS 和 Linux 的原生桌面应用
- 🎨 **现代 UI** - 无边框窗口和自定义标题栏，基于 shadcn/ui 和 Tailwind CSS v4 构建
- 🌐 **国际化** - 多语言支持（中文、英文），基于 next-intl
- 🔄 **自动更新** - 内置应用自更新系统
- 📊 **批量操作** - 对环境和包执行批量操作，支持进度跟踪
- ⌨️ **命令面板** - 通过键盘快捷键快速访问所有功能
- 🐧 **WSL 管理** - 完整的 Windows Subsystem for Linux 管理 (Windows)
- 📥 **下载管理器** - 基于队列的下载系统，支持限速和历史记录
- 📋 **引导系统** - 首次运行向导和交互式巡览
- 📚 **内置文档** - 集成 Markdown 文档查看器
- 🧪 **测试** - 基于 Jest 30、Testing Library 和 270+ Rust 单元测试的完整测试套件

## 前置要求

在开始之前，请确保已安装以下内容：

### Web 开发所需

- **Node.js** 20.x 或更高版本（[下载](https://nodejs.org/)）
- **pnpm** 8.x 或更高版本（推荐）或 npm/yarn

  ```bash
  npm install -g pnpm
  ```

### 桌面开发所需（额外要求）

- **Rust** 1.70 或更高版本（[安装](https://www.rust-lang.org/tools/install)）

  ```bash
  # 验证安装
  rustc --version
  cargo --version
  ```

- **系统依赖**（因操作系统而异）：
  - **Windows**：Microsoft Visual Studio C++ 生成工具
  - **macOS**：Xcode 命令行工具
  - **Linux**：参见 [Tauri 前置要求](https://tauri.app/v1/guides/getting-started/prerequisites)

## 安装

1. **克隆仓库**

   ```bash
   git clone <your-repo-url>
   cd CogniaLauncher
   ```

2. **安装依赖**

   ```bash
   pnpm install
   # 或
   npm install
   # 或
   yarn install
   ```

3. **验证安装**

   ```bash
   # 检查 Next.js 是否就绪
   pnpm dev

   # 运行测试
   pnpm test

   # 检查 Tauri 是否就绪（可选，用于桌面开发）
   pnpm tauri info
   ```

## 开发

### Web 应用开发

#### 启动开发服务器

```bash
pnpm dev
# 或
npm run dev
```

这将在 [http://localhost:3000](http://localhost:3000) 启动 Next.js 开发服务器。当您编辑文件时，页面会自动重新加载。

#### 关键开发文件

- `app/page.tsx` - 仪表板，显示环境和包概览
- `app/environments/page.tsx` - 环境版本管理
- `app/packages/page.tsx` - 包搜索和安装
- `app/providers/page.tsx` - 提供者配置
- `app/cache/page.tsx` - 缓存管理界面
- `app/settings/page.tsx` - 应用设置
- `app/about/page.tsx` - 关于页面，显示系统信息
- `app/downloads/page.tsx` - 下载管理
- `app/wsl/page.tsx` - WSL 分发管理 (Windows)
- `app/logs/page.tsx` - 应用日志查看器
- `app/docs/[[...slug]]/page.tsx` - 内置文档查看器
- `components/ui/` - 可复用的 UI 组件（shadcn/ui）
- `lib/tauri.ts` - Tauri API 绑定（与 Rust 后端通信）
- `lib/hooks/` - React 状态管理钩子
- `lib/stores/` - 支持持久化的 Zustand 状态存储

### 桌面应用开发

#### 启动 Tauri 开发模式

```bash
pnpm tauri dev
```

此命令将：

1. 启动 Next.js 开发服务器
2. 启动 Tauri 桌面应用
3. 为前端和 Rust 代码启用热重载

#### Tauri 开发文件

- `src-tauri/src/main.rs` - Rust 应用主入口点
- `src-tauri/src/lib.rs` - Rust 库代码
- `src-tauri/tauri.conf.json` - Tauri 配置
- `src-tauri/Cargo.toml` - Rust 依赖

## 可用脚本

### 前端脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 在 3000 端口启动 Next.js 开发服务器 |
| `pnpm build` | 构建生产环境的 Next.js 应用（输出到 `out/` 目录） |
| `pnpm start` | 启动 Next.js 生产服务器（在 `pnpm build` 之后） |
| `pnpm lint` | 运行 ESLint 检查代码质量 |
| `pnpm lint --fix` | 自动修复 ESLint 问题 |
| `pnpm test` | 运行 Jest 单元测试 |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |

### Tauri（桌面）脚本

| 命令 | 描述 |
|------|------|
| `pnpm tauri dev` | 启动 Tauri 开发模式，支持热重载 |
| `pnpm tauri build` | 构建生产环境的桌面应用 |
| `pnpm tauri info` | 显示 Tauri 环境信息 |
| `pnpm tauri icon` | 从源图像生成应用图标 |
| `pnpm tauri --help` | 显示所有可用的 Tauri 命令 |

### 桌面 CLI 速查

可以通过桌面二进制以无界面模式运行 CLI 子命令：

```bash
pnpm tauri dev -- search react --limit 10 --json
```

顶层命令：

- `search`
- `install`（支持 `--provider`、`--force`）
- `uninstall`（支持 `--provider`、`--force`）
- `list`（支持 `--provider`、`--outdated`）
- `update`
- `info`
- `env`
- `config`
- `cache`
- `doctor`
- `providers`
- `backup`
- `profiles`
- `envvar`
- `log`
- `download`

环境子命令：

- `env list`
- `env install <version> --type <env>`
- `env use <version> --type <env> [--local <path>]`
- `env detect [--type <env>] [--path <path>]`
- `env remove <version> --type <env> [--provider <id>]`
- `env resolve --type <env> [--path <path>]`

配置子命令：

- `config get <key>`
- `config set <key> <value>`
- `config list`
- `config reset`
- `config export <file>`
- `config import <file>`

备份子命令（P0）：

- `backup list`
- `backup create [--contents <type>...] [--note <text>]`
- `backup restore <path> [--contents <type>...]`
- `backup delete <path>`

配置档案子命令（P0）：

- `profiles list`
- `profiles get <id>`
- `profiles apply <id>`
- `profiles export <id> [--out <file>]`
- `profiles import <file>`
- `profiles create-from-current <name>`

环境变量子命令（P0）：

- `envvar list`
- `envvar get <key> [--scope process|user|system]`
- `envvar set <key> <value> [--scope process|user|system]`
- `envvar remove <key> [--scope process|user|system]`
- `envvar list-persistent [--scope user|system]`
- `envvar set-persistent <key> <value> [--scope user|system]`
- `envvar remove-persistent <key> [--scope user|system]`
- `envvar export <file> [--scope ...] [--format dotenv|shell|fish|powershell|nushell]`
- `envvar import <file> [--scope process|user|system]`
- `envvar snapshot-list`
- `envvar snapshot-create [--scope user|system] [--mode manual|automatic] [--source-action <name>] [--note <text>]`
- `envvar snapshot-protection --action <name> [--scope user|system]`
- `envvar snapshot-preview <path> [--scope user|system ...]`
- `envvar snapshot-restore <path> [--scope user|system ...]`
- `envvar snapshot-delete <path>`

环境变量恢复说明：

- 风险较高的持久化环境变量操作会在执行前判断是复用现有安全快照还是创建新的安全快照。
- 恢复流程默认先做预览，只支持持久化的 `user` / `system` 环境变量与 PATH；`process` 作用域仅用于诊断展示，不能作为持久恢复目标。
- 自动安全快照会按保留策略单独清理，手动恢复点会一直保留，直到用户显式删除。

日志/诊断子命令（P0）：

- `log list`
- `log export [--file <name>] [--out <file>] [--format txt|json] [--search <text>] [--regex]`
- `log clear [--file <name>]`
- `log size`
- `log cleanup`

下载子命令（P0）：

- `download history-list [--limit <n>]`
- `download history-stats`
- `download history-clear [--days <n>]`
- `download history-remove <id>`
- `download queue-list`
- `download queue-stats`
- `download queue-pause <id>`
- `download queue-resume <id>`
- `download queue-cancel <id>`

CLI JSON 契约（`--json`）示例：

```json
{
  "ok": true,
  "command": "download.history-stats",
  "data": {
    "total_count": 12,
    "completed_count": 10
  }
}
```

CLI 错误契约示例：

```json
{
  "ok": false,
  "command": "backup.restore",
  "error": {
    "kind": "usage",
    "message": "backup path is required"
  }
}
```

CLI 分阶段发布说明：

- P0（已完成）：`backup`、`profiles`、`envvar`、`log`、`download`
- P1（规划中）：高频 `plugin` 与 `git` 自动化命令
- P2（规划中）：低频或平台依赖较强的高级命令
- 兼容性契约：现有命令保持向后兼容；统一退出码为 `0`（成功）、`2`（用法错误）、`1`（运行时错误）

### 添加 UI 组件（shadcn/ui）

```bash
# 添加新组件（例如 Card）
pnpm dlx shadcn@latest add card

# 添加多个组件
pnpm dlx shadcn@latest add button card dialog
```

## 项目结构

```text
CogniaLauncher/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 仪表板概览
│   ├── environments/        # 环境管理页面
│   ├── packages/            # 包管理页面
│   ├── providers/           # 提供者配置页面
│   ├── cache/               # 缓存管理页面
│   ├── settings/            # 设置页面
│   ├── about/               # 关于页面，显示系统信息
│   ├── downloads/           # 下载管理页面
│   ├── logs/                # 应用日志查看器
│   ├── layout.tsx           # 带侧边栏的根布局
│   └── globals.css          # 全局样式
├── components/              # React 组件
│   ├── dashboard/           # 拖拽小组件仪表板
│   ├── environments/        # 环境卡片和控件
│   ├── packages/            # 包列表和搜索组件
│   ├── provider-management/ # 提供商卡片、详情、工具栏
│   ├── downloads/           # 下载管理组件
│   ├── wsl/                 # WSL 分发管理组件
│   ├── onboarding/          # 引导向导和巡览
│   ├── docs/                # 文档查看器组件
│   ├── log/                 # 日志查看器组件
│   ├── settings/            # 设置面板组件
│   ├── layout/              # 侧边栏、标题栏、导航
│   └── ui/                  # shadcn/ui 组件
├── lib/                     # 工具和状态
│   ├── hooks/               # React 钩子（use-environments、use-packages 等）
│   ├── stores/              # 支持持久化的 Zustand 状态存储
│   ├── theme/               # 主题配置和工具
│   ├── constants/           # 应用常量
│   ├── tauri.ts             # Tauri API 绑定
│   └── utils.ts             # 辅助函数
├── messages/                 # i18n 翻译文件
│   ├── en.json              # 英文翻译
│   └── zh.json              # 中文翻译
├── src-tauri/               # Tauri/Rust 后端
│   ├── src/
│   │   ├── commands/        # Tauri 命令处理器
│   │   ├── cache/           # SQLite + JSON 缓存管理
│   │   ├── config/          # 配置系统
│   │   ├── core/            # 核心环境/包/批量操作逻辑
│   │   ├── provider/        # 提供商实现（48 个）
│   │   ├── platform/        # 平台抽象层
│   │   ├── resolver/        # 依赖解析
│   │   └── lib.rs           # 主 Tauri 设置
│   ├── icons/               # 桌面应用图标
│   └── tauri.conf.json      # Tauri 配置
├── llmdoc/                   # AI/LLM 文档
├── openspec/                # OpenSpec 变更管理
├── jest.config.ts           # Jest 测试配置
├── components.json          # shadcn/ui 配置
├── next.config.ts           # Next.js 配置
├── tsconfig.json            # TypeScript 配置
└── package.json             # Node.js 依赖
```

## 配置

### 环境变量

在根目录创建 `.env.local` 文件以配置特定环境的变量：

```env
# 示例环境变量
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=React Quick Starter

# 私有变量（不会暴露给浏览器）
DATABASE_URL=postgresql://...
API_SECRET_KEY=your-secret-key

# 可选：覆盖开发态资源 origin（最高优先级）
# 必须填写完整 origin，例如 http://localhost:3100
NEXT_DEV_ORIGIN=http://localhost:3100

# 可选：Tauri 开发模式下用于自动解析 assetPrefix 的主机/端口
TAURI_DEV_HOST=localhost
TAURI_DEV_PORT=3100
```

**重要提示**：

- 只有以 `NEXT_PUBLIC_` 为前缀的变量会暴露给浏览器
- 切勿将 `.env.local` 提交到版本控制
- 使用 `.env.example` 记录所需的变量
- 开发态资源地址解析优先级：`NEXT_DEV_ORIGIN` > `TAURI_DEV_HOST + (TAURI_DEV_PORT | PORT | npm_config_port | 3000)`
- 非 Tauri Web 开发场景会回退为相对资源地址（不会强制跨端口 assetPrefix）

### Tauri 配置

编辑 `src-tauri/tauri.conf.json` 以自定义您的桌面应用：

```json
{
  "productName": "CogniaLauncher",         // 应用名称
  "version": "0.1.0",                      // 应用版本
  "identifier": "com.cognia.launcher",     // 唯一应用标识符
  "build": {
    "frontendDist": "../out",              // Next.js 构建输出
    "devUrl": "http://localhost:3000"      // 开发服务器 URL
  },
  "app": {
    "windows": [{
      "title": "CogniaLauncher",           // 窗口标题
      "width": 1024,                       // 默认宽度
      "height": 768,                       // 默认高度
      "resizable": true,                   // 允许调整大小
      "fullscreen": false                  // 全屏启动
    }]
  }
}
```

### 路径别名

在 `components.json` 和 `tsconfig.json` 中配置：

```typescript
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

可用别名：

- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/ui` → `components/ui/`
- `@/hooks` → `hooks/`
- `@/utils` → `lib/utils.ts`

### Tailwind CSS 配置

项目使用 Tailwind CSS v4，具有以下特性：

- 使用 CSS 变量进行主题化（在 `app/globals.css` 中定义）
- 通过 `class` 策略支持暗色模式
- 使用 CSS 变量的自定义调色板
- shadcn/ui 样式系统

## 生产构建

### 构建 Web 应用

```bash
# 构建静态导出
pnpm build

# 输出目录：out/
# 将 out/ 目录部署到任何静态托管服务
```

构建会在 `out/` 目录中创建一个静态导出，已针对生产环境进行优化。

### 构建桌面应用

```bash
# 为当前平台构建
pnpm tauri build

# 输出位置：
# - Windows: src-tauri/target/release/bundle/msi/
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/appimage/
```

构建选项：

```bash
# 为特定目标构建
pnpm tauri build --target x86_64-pc-windows-msvc

# 使用调试符号构建
pnpm tauri build --debug

# 不打包构建
pnpm tauri build --bundles none
```

## 部署

### Web 部署

#### Vercel（推荐）

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 [Vercel](https://vercel.com/new) 上导入项目
3. Vercel 会自动检测 Next.js 并部署

#### Netlify

```bash
# 构建命令
pnpm build

# 发布目录
out
```

#### 静态托管（Nginx、Apache 等）

1. 构建项目：`pnpm build`
2. 将 `out/` 目录上传到您的服务器
3. 配置服务器以提供静态文件

### 桌面部署

#### Windows

- 分发 `src-tauri/target/release/bundle/msi/` 中的 `.msi` 安装程序
- 用户运行安装程序以安装应用

#### macOS

- 分发 `src-tauri/target/release/bundle/dmg/` 中的 `.dmg` 文件
- 用户将应用拖到应用程序文件夹
- **注意**：对于 App Store 之外的分发，您需要使用 Apple 开发者证书对应用进行签名

#### Linux

- 分发 `src-tauri/target/release/bundle/appimage/` 中的 `.AppImage`
- 用户使其可执行并运行：`chmod +x app.AppImage && ./app.AppImage`
- 替代格式：`.deb`（Debian/Ubuntu）、`.rpm`（Fedora/RHEL）

#### 代码签名（生产环境推荐）

- **Windows**：使用代码签名证书
- **macOS**：需要 Apple 开发者账户和证书
- **Linux**：可选，但建议用于分发

详细说明请参见 [Tauri 分发指南](https://tauri.app/v1/guides/distribution/)。

## 开发工作流

### 典型开发周期

1. **启动开发服务器**

   ```bash
   pnpm dev  # 用于 Web 开发
   # 或
   pnpm tauri dev  # 用于桌面开发
   ```

2. **进行更改**
   - 编辑 `app/`、`components/` 或 `lib/` 中的文件
   - 更改会在浏览器/桌面应用中自动重新加载

3. **添加新组件**

   ```bash
   pnpm dlx shadcn@latest add [component-name]
   ```

4. **检查代码**

   ```bash
   pnpm lint
   ```

5. **构建和测试**

   ```bash
   pnpm build  # 测试 Web 构建
   pnpm tauri build  # 测试桌面构建
   ```

### 最佳实践

- **代码风格**：遵循 ESLint 规则（`pnpm lint`）
- **测试**：为新功能编写测试（`pnpm test`）
- **提交**：使用约定式提交（feat:、fix:、docs: 等）
- **组件**：保持组件小而可复用
- **状态**：在 `lib/stores/` 中使用 Zustand 存储管理全局状态
- **钩子**：在 `lib/hooks/` 中使用自定义钩子处理 Tauri API 交互
- **后端**：在 `src-tauri/src/commands/` 中添加新的 Rust 命令
- **样式**：使用 Tailwind 工具类，尽可能避免自定义 CSS
- **国际化**：在 `messages/en.json` 和 `messages/zh.json` 中添加翻译

## 故障排除

### 常见问题

**端口 3000 已被占用**

```bash
# 终止使用端口 3000 的进程
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

**Tauri 构建失败**

```bash
# 检查 Tauri 环境
pnpm tauri info

# 更新 Rust
rustup update

# 清理构建缓存
cd src-tauri
cargo clean
```

**模块未找到错误**

```bash
# 清除 Next.js 缓存
rm -rf .next

# 重新安装依赖
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 了解更多

### Next.js 资源

- [Next.js 文档](https://nextjs.org/docs) - 了解 Next.js 功能和 API
- [学习 Next.js](https://nextjs.org/learn) - 交互式 Next.js 教程
- [Next.js GitHub](https://github.com/vercel/next.js) - Next.js 仓库

### Tauri 资源

- [Tauri 文档](https://tauri.app/) - Tauri 官方文档
- [Tauri API 参考](https://tauri.app/v1/api/js/) - JavaScript API 参考
- [Tauri GitHub](https://github.com/tauri-apps/tauri) - Tauri 仓库

### UI 和样式

- [shadcn/ui](https://ui.shadcn.com/) - 组件库文档
- [Tailwind CSS](https://tailwindcss.com/docs) - Tailwind CSS 文档
- [Radix UI](https://www.radix-ui.com/) - Radix UI 原语

### 状态管理

- [Zustand](https://zustand-demo.pmnd.rs/) - Zustand 文档

## 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'feat: add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 许可证

本项目是开源的，采用 [MIT 许可证](LICENSE)。

## 支持

如果您遇到任何问题或有疑问：

- 查看[故障排除](#故障排除)部分
- 查阅 [Next.js 文档](https://nextjs.org/docs)
- 查阅 [Tauri 文档](https://tauri.app/)
- 在 GitHub 上提出 issue
