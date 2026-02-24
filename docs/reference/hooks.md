# React Hooks 参考

CogniaLauncher 包含 30 个自定义 React Hooks，封装业务逻辑和 Tauri API 调用。

---

## 核心 Hooks

| Hook | 文件 | 用途 |
|------|------|------|
| `useAppInit` | `use-app-init.ts` | 应用初始化（Provider 注册、设置加载） |
| `useAboutData` | `use-about-data.ts` | 关于页数据（版本、构建信息） |
| `useNetwork` | `use-network.ts` | 网络状态监控 |

## 环境管理

| Hook | 文件 | 用途 |
|------|------|------|
| `useEnvironments` | `use-environments.ts` | 环境列表和版本管理 |
| `useLaunch` | `use-launch.ts` | 程序启动和环境激活 |
| `useAutoVersion` | `use-auto-version.ts` | 自动版本检测和切换 |
| `useVersionCache` | `use-version-cache.ts` | 版本列表缓存 |
| `useRustup` | `use-rustup.ts` | Rustup 工具链/组件/目标管理 |

## 包管理

| Hook | 文件 | 用途 |
|------|------|------|
| `usePackages` | `use-packages.ts` | 包搜索和管理 |
| `usePackageExport` | `use-package-export.ts` | 包列表导出 |
| `useProviderDetail` | `use-provider-detail.ts` | Provider 详情和配置 |

## 下载管理

| Hook | 文件 | 用途 |
|------|------|------|
| `useDownloads` | `use-downloads.ts` | 下载任务管理 |
| `useGithubDownloads` | `use-github-downloads.ts` | GitHub Release 下载 |
| `useGitlabDownloads` | `use-gitlab-downloads.ts` | GitLab Release 下载 |
| `useAssetMatcher` | `use-asset-matcher.ts` | 下载资产匹配 |

## 设置与外观

| Hook | 文件 | 用途 |
|------|------|------|
| `useSettings` | `use-settings.ts` | 设置读写 |
| `useSettingsSearch` | `use-settings-search.ts` | 设置搜索和区域追踪 |
| `useSettingsShortcuts` | `use-settings-shortcuts.ts` | 设置页快捷键 |
| `useAppearanceConfigSync` | `use-appearance-config-sync.ts` | 外观设置与后端同步 |

## WSL

| Hook | 文件 | 用途 |
|------|------|------|
| `useWsl` | `use-wsl.ts` | WSL 管理操作 |

## 日志

| Hook | 文件 | 用途 |
|------|------|------|
| `useLogs` | `use-logs.ts` | 日志查看和管理 |

## 系统功能

| Hook | 文件 | 用途 |
|------|------|------|
| `useHealthCheck` | `use-health-check.ts` | 健康检查 |
| `useProfiles` | `use-profiles.ts` | 配置快照 |
| `useShim` | `use-shim.ts` | Shim/PATH 管理 |
| `useAutoUpdate` | `use-auto-update.ts` | 应用自动更新 |
| `useOnboarding` | `use-onboarding.ts` | 引导向导 |

## UI 工具

| Hook | 文件 | 用途 |
|------|------|------|
| `useKeyboardShortcuts` | `use-keyboard-shortcuts.ts` | 全局键盘快捷键 |
| `useMobile` | `use-mobile.ts` | 移动端/响应式检测 |
| `useTraySync` | `use-tray-sync.ts` | 系统托盘状态同步 |
| `useUnsavedChanges` | `use-unsaved-changes.ts` | 未保存更改提示 |

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
