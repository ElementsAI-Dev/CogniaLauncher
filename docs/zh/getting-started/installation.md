# 安装指南

## 前置要求

### Web 开发

- **Node.js** 20.x 或更高版本（[下载](https://nodejs.org/)）
- **pnpm** 8.x 或更高版本（推荐）

```bash
npm install -g pnpm
```

### 桌面应用开发（额外要求）

- **Rust** 1.70 或更高版本（[安装](https://www.rust-lang.org/tools/install)）

```bash
# 验证安装
rustc --version
cargo --version
```

- **系统依赖**（按操作系统）：
    - **Windows**：Microsoft Visual Studio C++ Build Tools
    - **macOS**：Xcode Command Line Tools
    - **Linux**：参见 [Tauri 前置要求](https://tauri.app/v1/guides/getting-started/prerequisites)

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone <your-repo-url>
cd CogniaLauncher
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 验证安装

```bash
# 检查 Next.js 是否就绪
pnpm dev

# 运行测试
pnpm test

# 检查 Tauri 是否就绪（可选，需要 Rust 工具链）
pnpm tauri info
```

---

## 可用脚本

### 前端脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Next.js 开发服务器（端口 3000） |
| `pnpm build` | 构建生产版本（输出到 `out/` 目录） |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | 运行 ESLint 代码检查 |
| `pnpm lint --fix` | 自动修复 ESLint 问题 |
| `pnpm test` | 运行 Jest 单元测试 |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |

### Tauri（桌面）脚本

| 命令 | 描述 |
|------|------|
| `pnpm tauri dev` | 启动 Tauri 开发模式（热重载） |
| `pnpm tauri build` | 构建桌面应用 |
| `pnpm tauri info` | 显示 Tauri 环境信息 |
| `pnpm tauri icon` | 从源图片生成应用图标 |

---

## 生产构建

### Web 应用

```bash
pnpm build
# 输出目录: out/
# 可部署到任何静态托管服务
```

### 桌面应用

```bash
# 构建当前平台
pnpm tauri build
```

输出位置：

| 平台 | 路径 |
|------|------|
| Windows | `src-tauri/target/release/bundle/msi/` |
| macOS | `src-tauri/target/release/bundle/dmg/` |
| Linux | `src-tauri/target/release/bundle/appimage/` |

构建选项：

```bash
# 指定目标平台
pnpm tauri build --target x86_64-pc-windows-msvc

# 带调试信息
pnpm tauri build --debug
```

---

## 添加 UI 组件

项目使用 shadcn/ui 组件库：

```bash
# 添加单个组件
pnpm dlx shadcn@latest add card

# 添加多个组件
pnpm dlx shadcn@latest add button card dialog
```
