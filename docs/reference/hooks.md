# React Hooks 参考

CogniaLauncher 包含 51 个自定义 React Hooks，封装业务逻辑和 Tauri API 调用。

---

## 核心 Hooks

| Hook | 文件 | 用途 |
|------|------|------|
| `useAppInit` | `use-app-init.ts` | 应用初始化（Provider 注册、设置加载） |
| `useAboutData` | `use-about-data.ts` | 关于页数据（版本、构建信息） |

## 环境管理

| Hook | 文件 | 用途 |
|------|------|------|
| `useEnvironments` | `use-environments.ts` | 环境列表和版本管理 |
| `useEnvironmentDetail` | `use-environment-detail.ts` | 环境详情和操作 |
| `useLaunch` | `use-launch.ts` | 程序启动 |

## 包管理

| Hook | 文件 | 用途 |
|------|------|------|
| `usePackages` | `use-packages.ts` | 包搜索和管理 |
| `useProviders` | `use-providers.ts` | Provider 列表和状态 |
| `useBatch` | `use-batch.ts` | 批量操作 |

## 下载管理

| Hook | 文件 | 用途 |
|------|------|------|
| `useDownloads` | `use-downloads.ts` | 下载任务管理 |
| `useGithubDownloads` | `use-github-downloads.ts` | GitHub Release 下载 |
| `useGitlabDownloads` | `use-gitlab-downloads.ts` | GitLab Release 下载 |
| `useAssetMatcher` | `use-asset-matcher.ts` | 下载资产匹配 |

## 缓存管理

| Hook | 文件 | 用途 |
|------|------|------|
| `useCache` | `use-cache.ts` | 缓存操作 |
| `useCacheDetail` | `use-cache-detail.ts` | 缓存类型详情 |

## 设置

| Hook | 文件 | 用途 |
|------|------|------|
| `useSettings` | `use-settings.ts` | 设置读写 |
| `useSettingsSearch` | `use-settings-search.ts` | 设置搜索和区域追踪 |
| `useAppearanceConfigSync` | `use-appearance-config-sync.ts` | 外观设置与后端同步 |

## WSL

| Hook | 文件 | 用途 |
|------|------|------|
| `useWsl` | `use-wsl.ts` | WSL 管理操作 |

## 日志

| Hook | 文件 | 用途 |
|------|------|------|
| `useLogs` | `use-logs.ts` | 日志查看和管理 |

## 其他

| Hook | 文件 | 用途 |
|------|------|------|
| `useCustomDetection` | `use-custom-detection.ts` | 自定义检测规则 |
| `useHealthCheck` | `use-health-check.ts` | 健康检查 |
| `useProfiles` | `use-profiles.ts` | 配置快照 |
| `useShim` | `use-shim.ts` | Shim 管理 |
| `useSearch` | `use-search.ts` | 高级搜索 |
| `useUpdater` | `use-updater.ts` | 应用自更新 |

---

## 使用方式

```tsx
import { useEnvironments } from "@/hooks/use-environments";

function EnvironmentPage() {
  const {
    environments,
    loading,
    install,
    uninstall,
    setGlobalVersion,
  } = useEnvironments();

  // 使用 Hook 返回的数据和方法
}
```

所有 Hooks 内部使用 `isTauri()` 守卫，确保 Web 模式下不调用 Tauri API。
