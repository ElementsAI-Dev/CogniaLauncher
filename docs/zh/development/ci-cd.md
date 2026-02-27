# CI/CD

CogniaLauncher 使用 GitHub Actions 实现持续集成和部署。

---

## 工作流概览

| Job | 触发条件 | 功能 |
|-----|----------|------|
| Code Quality & Security | Push, PR | ESLint + 安全检查 |
| Test Suite | Push, PR | Jest 测试 + 覆盖率 |
| Deploy Preview | PR | Vercel 预览部署 |
| Deploy Production | Push to main | Vercel 生产部署 |
| Build Tauri | Tag (v*) | 构建桌面应用 |
| Create Release | Tag (v*) | 创建 GitHub Release |

---

## 触发规则

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  release:
    types: [created]
```

---

## Job 详情

### Code Quality & Security

- 运行 `pnpm lint`
- 检查依赖安全漏洞
- TypeScript 类型检查

### Test Suite

- 运行 `pnpm test`
- 生成覆盖率报告
- 上传测试结果为 Artifact

### Deploy Preview

- PR 创建时自动部署预览版本
- 提供预览 URL 在 PR 评论中

### Build Tauri

- 多平台构建：Windows (x64)、macOS (x64/ARM64)、Linux (x86_64)
- 输出：MSI、DMG、AppImage、.deb
- 上传构建产物为 Artifact

### Create Release

- 从 Tag 触发
- 收集所有平台构建产物
- 创建 GitHub Release 并附加二进制文件

---

## 缓存策略

| 缓存 | Key | 用途 |
|------|-----|------|
| pnpm store | `pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}` | Node 依赖 |
| Cargo | `cargo-${{ hashFiles('Cargo.lock') }}` | Rust 依赖 |
| Next.js | `.next/cache` | 构建缓存 |

---

## 并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

同一分支的重复工作流会自动取消旧的运行。

---

## 必要的 Secrets

| Secret | 用途 |
|--------|------|
| `VERCEL_TOKEN` | Vercel 部署 |
| `VERCEL_ORG_ID` | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID |
| `TAURI_PRIVATE_KEY` | Tauri 更新器签名密钥 |
| `TAURI_KEY_PASSWORD` | 签名密钥密码 |

---

## 本地验证

提交 PR 前在本地运行：

```bash
# 前端
pnpm lint
pnpm test

# 后端
cargo check
cargo test

# 构建验证
pnpm build
```

---

## 故障排查

### 常见 CI 失败原因

1. **Lint 失败** — 运行 `pnpm lint --fix` 修复
2. **测试失败** — 检查本地是否通过 `pnpm test`
3. **类型错误** — 确保 `pnpm build` 本地能成功
4. **Cargo 编译失败** — 运行 `cargo check` 检查
5. **依赖不匹配** — 删除 `node_modules` 重新 `pnpm install`
