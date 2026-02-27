# 安全设计

CogniaLauncher 的安全模型涵盖网络通信、文件系统访问和权限控制。

---

## 网络安全

### HTTPS 优先

- 默认仅允许 HTTPS 连接
- `allow_http` 设置项用于开发环境
- 证书验证默认开启

### 代理支持

- HTTP/HTTPS 代理
- 代理地址在设置中配置
- 不记录代理凭据

---

## Tauri 安全

### 能力系统

Tauri 2.x 使用能力（Capability）系统控制权限：

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    ...
  ]
}
```

### 最小权限原则

- 仅授予必要的窗口操作权限
- 文件系统访问限制在应用数据目录
- 网络请求限制在已知的包源 API

---

## 环境变量安全

### Next.js 侧

- 仅 `NEXT_PUBLIC_` 前缀变量暴露给客户端
- `.env.local` 不提交到版本控制
- 生产构建不包含开发环境变量

### Tauri 侧

- API Token 存储在系统凭据管理器或加密配置
- Provider Token（如 GitHub Token）通过设置管理
- 不在日志中输出敏感信息

---

## 包安装安全

### 校验和验证

- 下载文件支持 SHA256 校验和验证
- 缓存文件存储校验和用于去重验证
- 安装前可选校验

### 权限提升

部分操作需要管理员权限：

| 操作 | 需要提升 | Provider |
|------|----------|----------|
| 系统包安装 | 是 | apt, dnf, pacman, zypper |
| WSL 管理 | 是 | wsl |
| 全局包安装 | 部分 | winget, chocolatey |
| 用户级安装 | 否 | scoop, brew, npm, pip |

Provider 通过 `requires_elevation()` 方法声明是否需要权限提升。

---

## 内容安全策略

!!! warning "待完善"
    当前 `tauri.conf.json` 中 CSP 设置为 null（开发阶段常见）。
    生产发布前应配置严格的 CSP 策略。

建议的生产 CSP：

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https://registry.npmjs.org https://pypi.org;
```
