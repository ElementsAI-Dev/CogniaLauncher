# 状态管理参考

CogniaLauncher 使用 Zustand 5 进行状态管理，共 9 个 Store，全部使用 `persist` 中间件实现 localStorage 持久化。

---

## Store 列表

| Store | 文件 | 用途 |
|-------|------|------|
| Appearance | `lib/stores/appearance.ts` | 主题模式、强调色、图表颜色主题 |
| Dashboard | `lib/stores/dashboard.ts` | 仪表板小部件顺序和可见性 |
| Download | `lib/stores/download.ts` | 下载任务列表和设置 |
| Log | `lib/stores/log.ts` | 日志条目、过滤、分页 |
| Settings | `lib/stores/settings.ts` | 通用应用设置 |
| Window State | `lib/stores/window-state.ts` | 窗口最大化/全屏/焦点状态 |
| Environment | `lib/stores/environment.ts` | 环境列表缓存 |
| Onboarding | `lib/stores/onboarding.ts` | 引导向导进度状态 |
| Package | `lib/stores/packages.ts` | 包管理状态 |

---

## 使用方式

```typescript
import { useAppearanceStore } from "@/lib/stores/appearance";

function ThemeToggle() {
  const { mode, setMode } = useAppearanceStore();

  return (
    <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
      切换主题
    </button>
  );
}
```

---

## 持久化

所有 Store 使用 Zustand `persist` 中间件：

```typescript
export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
      // ...
    }),
    {
      name: "appearance-store",
      version: 3,
    }
  )
);
```

数据存储在浏览器 `localStorage` 中，跨会话保持。

---

## 设计决策

- **Zustand vs React Context**：选择 Zustand 是因为它允许任何组件访问状态，不受组件树位置限制（例如 `window-state` Store 被 Titlebar 和 AppShell 同时使用，但它们存在父子关系，无法使用 Context）
- **持久化版本**：每个 Store 有版本号，schema 变更时可做迁移
