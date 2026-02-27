# State Management Reference

CogniaLauncher uses Zustand 5 for state management, with 9 Stores total, all using the `persist` middleware for localStorage persistence.

---

## Store List

| Store | File | Purpose |
|-------|------|---------|
| Appearance | `lib/stores/appearance.ts` | Theme mode, accent color, chart color theme |
| Dashboard | `lib/stores/dashboard.ts` | Dashboard widget order and visibility |
| Download | `lib/stores/download.ts` | Download task list and settings |
| Log | `lib/stores/log.ts` | Log entries, filtering, pagination |
| Settings | `lib/stores/settings.ts` | General application settings |
| Window State | `lib/stores/window-state.ts` | Window maximize/fullscreen/focus state |
| Environment | `lib/stores/environment.ts` | Environment list cache |
| Onboarding | `lib/stores/onboarding.ts` | Onboarding wizard progress state |
| Package | `lib/stores/packages.ts` | Package management state |

---

## Usage

```typescript
import { useAppearanceStore } from "@/lib/stores/appearance";

function ThemeToggle() {
  const { mode, setMode } = useAppearanceStore();

  return (
    <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
      Toggle Theme
    </button>
  );
}
```

---

## Persistence

All Stores use the Zustand `persist` middleware:

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

Data is stored in browser `localStorage`, persisted across sessions.

---

## Design Decisions

- **Zustand vs React Context**: Zustand was chosen because it allows any component to access state regardless of component tree position (e.g., the `window-state` Store is used by both Titlebar and AppShell, which have a parent-child relationship and cannot use Context)
- **Persistence Versioning**: Each Store has a version number, enabling migrations when the schema changes
