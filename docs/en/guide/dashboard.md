# Dashboard

The dashboard is the main page of CogniaLauncher, providing system status visibility and a fully customizable homepage layout.

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

### Complete Layout Customization

Homepage customization is split into two coordinated entry points:

- **Header Edit Mode** — Enables in-grid controls for drag reorder, resize, hide/show, and remove.
- **Customize Dialog** — Manages widget catalog, category filtering, add actions, and reset-to-default.

Behavior guarantees:

- **Single source widget policy** — All add/remove/visibility operations use the same widget registry policy (`allowMultiple`, `required`, `defaultVisible`).
- **Policy-aware add actions** — Widgets that reach instance limit are shown as unavailable in the dialog.
- **Deterministic reset** — Reset always restores the canonical default widget set and order.
- **Persistence and migration safety** — Stored layouts are normalized on restore/migration (invalid size, duplicate IDs, unknown widgets, malformed payload fallback).

### Homepage Overview and Feedback

The homepage now exposes a workspace status strip above the widget grid:

- **Overview readiness summary** — Quickly shows whether environment, package, and system sections are ready, still loading, or need attention.
- **Partial readiness** — Widgets with ready data stay usable while other sections continue loading.
- **Actionable degraded states** — Affected widgets surface local retry or deep-link actions instead of relying only on a page-level error banner.

Key widget behavior:

- **Welcome / Workspace Ready** — New users see setup steps; configured users see a compact "workspace ready" card with direct links back to environments, packages, and settings.
- **Environment / Package lists** — Empty states now provide direct setup actions, and load or error states keep recovery actions close to the affected widget.
- **Health / Updates / System Info** — Each widget can now prompt for the next step (run check, check now, retry) when no data or degraded data is available.

### Default Layout Upgrades

- **Fresh and reset layouts** — New users and reset-to-default flows get the newest canonical homepage ordering, with overview and actions ahead of diagnostics and detail widgets.
- **Existing custom layouts stay intact** — Updating CogniaLauncher does not silently replace a previously customized homepage. The new canonical layout applies only to fresh layouts or explicit reset.

### System Status

- Provider availability checks
- Cache usage statistics
- Network connection status

---

## Related Components

| Component | Path | Description |
|-----------|------|-------------|
| DashboardPage | `app/page.tsx` | Dashboard page and header interaction flow |
| WidgetGrid | `components/dashboard/widget-grid.tsx` | Widget grid rendering and edit operations |
| WidgetWrapper | `components/dashboard/widget-wrapper.tsx` | Per-widget edit toolbar |
| CustomizeDialog | `components/dashboard/customize-dialog.tsx` | Widget catalog and reset controls |
| Widgets | `components/dashboard/widgets/` | Widget collection |

---

## State Management

Dashboard layout data is stored in `lib/stores/dashboard.ts` (Zustand):

- Widget order, size, and visibility
- Widget instance-policy helpers shared by store and UI
- Persisted layout migration and normalization
