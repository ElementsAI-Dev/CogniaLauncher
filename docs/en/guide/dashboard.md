# Dashboard

The dashboard is the main page of CogniaLauncher, providing a system status overview and quick action entry points.

---

## Features

### Environment Overview

The top of the dashboard displays installed runtime environment status:

- **Installed Environment Count** — Node.js, Python, Rust, etc.
- **Currently Active Versions** — Globally active versions
- **Available Updates** — Detected version updates

### Quick Actions

- One-click install common environments
- Quick version switching
- Open settings page

### Customizable Widgets

The dashboard supports widget customization:

- **Drag to Reorder** — Drag-and-drop reordering via `@dnd-kit`
- **Show/Hide** — Control widget visibility through the customize dialog
- **Persistence** — Layout preferences saved in Zustand Store

### System Status

- Provider availability checks
- Cache usage statistics
- Network connection status

---

## Related Components

| Component | Path | Description |
|-----------|------|-------------|
| DashboardPage | `app/page.tsx` | Dashboard page |
| EnvironmentList | `components/dashboard/environment-list.tsx` | Environment list |
| CustomizeDialog | `components/dashboard/customize-dialog.tsx` | Customize dialog |
| StatusCards | `components/dashboard/status-card.tsx` | Status cards |
| Widgets | `components/dashboard/widgets/` | Widget collection |

---

## State Management

Dashboard data is stored in `lib/stores/dashboard.ts` (Zustand):

- Widget order and visibility
- User preferences
- Cached statistics
