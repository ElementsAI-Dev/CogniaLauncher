# 配置说明

CogniaLauncher 提供灵活的配置系统，涵盖网络、缓存、Provider、外观等方面。

---

## 应用设置

在应用内通过 **设置** 页面（侧边栏底部齿轮图标）进行配置。

### 常规设置

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| 语言 | 界面语言 | 系统语言 |
| 并行下载数 | 同时下载任务数 | 4 |
| 解析策略 | 版本解析策略（latest/minimal/locked） | latest |
| 元数据缓存 TTL | 元数据缓存过期时间（秒） | 3600 |

### 网络设置

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| 超时时间 | 网络请求超时（秒） | 30 |
| 重试次数 | 失败重试次数 | 3 |
| 代理 | HTTP/HTTPS 代理地址 | 无 |

### 缓存设置

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| 最大缓存大小 | 缓存占用上限 | 无限制 |
| 最大缓存天数 | 缓存过期天数 | 无限制 |
| 自动清理 | 自动清理过期缓存 | 关闭 |
| 清理阈值 | 触发自动清理的阈值 | 80% |
| 监控间隔 | 缓存监控检查间隔（秒） | 300 |

---

## 后端配置文件

后端使用 TOML 格式配置文件，位于 `~/.CogniaLauncher/config/config.toml`。

### 主配置文件示例

```toml
[general]
parallel_downloads = 4
resolve_strategy = "latest"
auto_update_metadata = true
metadata_cache_ttl = 3600

[network]
timeout = 30
retries = 3
# proxy = "http://proxy.example.com:8080"

[mirrors]
[mirrors.npm]
url = "https://registry.npmmirror.com"
priority = 100

[mirrors.pypi]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
priority = 100

[providers]
[providers.brew]
enabled = true
priority = 100

[providers.winget]
enabled = true
priority = 100

[providers.github]
enabled = true
# token = "ghp_xxxx"  # 可选，提高 API 速率限制

[security]
allow_http = false
verify_certificates = true
allow_self_signed = false
```

---

## 镜像源配置

CogniaLauncher 支持为不同的包源配置镜像，加速中国大陆等地区的下载速度。

### 常用镜像

| 包源 | 镜像地址 |
|------|----------|
| npm | `https://registry.npmmirror.com` |
| PyPI | `https://pypi.tuna.tsinghua.edu.cn/simple` |
| crates.io | `https://rsproxy.cn/crates.io-index` |
| Homebrew | `https://mirrors.ustc.edu.cn/brew.git` |

在设置页面的 **镜像** 部分配置，或直接编辑 `config.toml` 的 `[mirrors]` 节。

---

## 环境变量

### Next.js 环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=CogniaLauncher
```

!!! warning "安全提示"
    - 只有 `NEXT_PUBLIC_` 前缀的变量会暴露给浏览器
    - 不要将 `.env.local` 提交到版本控制

### Tauri 配置

编辑 `src-tauri/tauri.conf.json`：

```json
{
  "productName": "CogniaLauncher",
  "version": "0.1.0",
  "identifier": "com.cognia.launcher",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000"
  }
}
```

---

## 路径别名

项目使用以下 TypeScript 路径别名：

| 别名 | 映射 |
|------|------|
| `@/components` | `components/` |
| `@/lib` | `lib/` |
| `@/ui` | `components/ui/` |
| `@/hooks` | `hooks/` |
| `@/utils` | `lib/utils.ts` |

使用方式：

```typescript
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

---

## 外观配置

### 主题

支持浅色/深色模式切换，通过 CSS `class` 策略实现。

### 强调色

可在设置中选择不同的强调色方案。

### 图表颜色主题

支持 6 种图表颜色主题：default、vibrant、pastel、ocean、sunset、monochrome。

在设置页面的 **外观** 部分配置。
