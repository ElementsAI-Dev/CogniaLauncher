# Frontend Architecture

CogniaLauncher's frontend is built with **Next.js 16** (App Router) + **React 19**.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.10 | Framework (App Router, static export) |
| React | 19.2.0 | UI library |
| Tailwind CSS | 4.x | Styling system |
| shadcn/ui | Latest | UI component library |
| Zustand | 5.x | State management |
| next-intl | 4.x | Internationalization |
| Recharts | 3.x | Data visualization |
| cmdk | 1.x | Command palette |
| @dnd-kit | 6.x | Drag and drop |
| Radix UI | Latest | Accessibility primitives |
| Lucide React | Latest | Icon library |

---

## Route Structure

```
app/
├── page.tsx              # Dashboard (home)
├── layout.tsx            # Root layout (sidebar + titlebar)
├── loading.tsx           # Global loading state
├── error.tsx             # Error boundary
├── not-found.tsx         # 404 page
├── global-error.tsx      # Global error boundary
├── environments/
│   ├── page.tsx          # Environment list
│   └── [envType]/page.tsx # Environment details (dynamic route)
├── packages/
│   ├── page.tsx          # Package management
│   └── [provider]/page.tsx # Provider details
├── cache/
│   ├── page.tsx          # Cache management
│   └── [cacheType]/page.tsx # Cache type details
├── downloads/page.tsx    # Download management
├── settings/page.tsx     # Settings
├── wsl/page.tsx          # WSL management
├── logs/page.tsx         # Logs
└── about/page.tsx        # About
```

Each route page includes a `loading.tsx` loading state.

---

## Component Architecture

### Component Layers

```
components/
├── ui/                # Base UI components (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── layout/            # Layout components
│   ├── titlebar.tsx   # Custom titlebar (frameless window)
│   └── sidebar.tsx    # Sidebar navigation
├── dashboard/         # Dashboard feature components
├── settings/          # Settings feature components
├── downloads/         # Download feature components
├── cache/             # Cache feature components
├── wsl/               # WSL feature components
├── log/               # Log feature components
├── about/             # About page components
├── providers/         # Context Provider components
├── app-shell.tsx      # Application shell
├── app-sidebar.tsx    # Application sidebar
└── command-palette.tsx # Command palette
```

### Naming Conventions

- Component files: `kebab-case.tsx` (e.g., `environment-list.tsx`)
- Component exports: `PascalCase` (e.g., `EnvironmentList`)
- Hook files: `use-*.ts` (e.g., `use-environments.ts`)
- Store files: `*.ts` (e.g., `appearance.ts`)

---

## State Management

### Zustand Stores

| Store | File | Purpose |
|-------|------|---------|
| Appearance | `appearance.ts` | Theme, accent color, chart colors |
| Dashboard | `dashboard.ts` | Dashboard layout and preferences |
| Download | `download.ts` | Download task state |
| Log | `log.ts` | Log entries and filtering |
| Settings | `settings.ts` | General settings |
| Window State | `window-state.ts` | Window maximize/fullscreen state |

All Stores use the `persist` middleware, storing data in `localStorage`.

### Data Flow

```
User Action → React Component → Hook → Tauri invoke → Rust Command
                                  ↓
                            Zustand Store → React Component Update
```

---

## Theme System

### CSS Variables

The theme is based on CSS custom properties, defined in `app/globals.css`:

- Color variables (background, foreground, accent, etc.)
- Dark mode toggled via `.dark` class
- Custom accent color support
- 6 chart color themes

### Frameless Window

Desktop mode uses a custom titlebar:

- Drag region implemented via `app-region: drag`
- Interactive elements marked as `app-region: no-drag`
- Windows maximized state uses dynamic per-edge insets based on monitor/work-area metrics (8px fallback when metrics are unavailable)
- Window state shared across components via Zustand Store

---

## Internationalization

Implemented with `next-intl`:

- Translation files: `messages/en.json`, `messages/zh.json`
- 1640+ key-value pairs
- Used in components via `useTranslations()` Hook
- System tray supports multiple languages
