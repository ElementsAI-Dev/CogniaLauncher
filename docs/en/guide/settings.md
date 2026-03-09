# Settings & Themes

CogniaLauncher provides rich settings options and theme customization features.

---

## Settings Page

Access the settings page via the gear icon at the bottom of the sidebar. Settings are grouped by category:

### General Settings

- Language switching (Chinese/English)
- Parallel download count
- Version resolution strategy
- Metadata cache TTL
- Auto-update metadata

### Network Settings

- Request timeout
- Failure retry count
- HTTP/HTTPS proxy

### Path Settings

- CogniaLauncher data directory
- Cache directory
- Environment installation directory
- Folder picker support (Tauri mode)

### Cache Settings

- Max cache size
- Cache expiration days
- Auto-clean toggle and threshold
- Cache monitor interval
- External cache monitoring

### Appearance Settings

- Theme mode (light/dark/follow system)
- Accent color
- Chart color theme (6 schemes)
- Interface density and border radius
- Reduced motion, native window effects, and background image tuning
- Appearance preset workbench (save, rename, apply, delete presets)

### Security Settings

- Allow HTTP (development only)
- Certificate verification
- Self-signed certificates

### Onboarding Controls

The Settings page includes an **Onboarding & Tour** card for first-run experience management:

- Resume a paused setup session from the last active step
- Re-run onboarding from mode selection (quick/detailed)
- Start the guided tour independently after setup
- View onboarding status (completed / skipped / paused / resumable)
- Manage contextual bubble hints (reset, dismiss all, enable/disable)

### Save, Import, and Reset Reliability

The settings center now uses explicit baseline/draft/save snapshots so local edits remain stable during background refreshes.

- If backend config refreshes while you have unsaved edits, CogniaLauncher keeps your draft and shows a conflict hint
- Import now runs in four steps: parse, validate, diff preview, then explicit confirm
- Save tracks per-key results and keeps failed keys in draft for **Retry Failed Items**
- Section reset only resets that section's keys, while global reset synchronizes config, app settings, and appearance state

### Terminal Config Workflow Reliability

The Terminal page now uses stricter safety and refresh rules for shell config and profile management.

- Switching tabs or changing shell/config targets now prompts before discarding unsaved config editor drafts
- Profile import now uses a pre-validation + summary confirmation step (valid/conflict/invalid counts) before applying
- Import conflict strategy is explicit: choose **Merge** or **Replace** before execution
- Proxy, environment-variable, and PowerShell tab data refresh only when related resources are marked stale

---

## Theme System

### Color Scheme

Based on CSS variables, defined in `app/globals.css`.

Supported theme modes:

- **Light Mode** — Bright background
- **Dark Mode** — Dark background
- **Follow System** — Auto-match operating system theme

### Accent Color

Choose different accent color schemes to personalize the interface.

### Customization Workbench

The Appearance section now includes a **Customization Workbench**:

- Select and apply a saved preset in one click
- Save current appearance as a new preset
- Rename or delete non-default presets
- Reset only appearance-related fields without touching other pending settings changes

Preset application updates all appearance-controlled fields consistently (theme, accent color, chart theme, radius, density, reduced motion, background options, window effect).

### Preset Migration Compatibility

When upgrading from older versions without preset metadata, CogniaLauncher auto-creates a compatible default preset from the existing appearance values.  
Legacy import payloads that do not contain preset data are still accepted and will also synthesize a default preset automatically.

### Chart Color Theme

Data visualization charts support 6 color schemes:

| Theme | Description |
|-------|-------------|
| default | Default colors |
| vibrant | Vivid colors |
| pastel | Soft colors |
| ocean | Ocean blue colors |
| sunset | Sunset warm colors |
| monochrome | Single-color scheme |

---

## Settings Search

The settings page has built-in search:

- Filter settings by keyword
- Supports Chinese and English search
- Auto-scrolls to matching settings area
- IntersectionObserver tracks the current active section

---

## Keyboard Shortcuts

The settings page supports keyboard shortcuts. See [Keyboard Shortcuts Reference](../reference/keyboard-shortcuts.md).

---

## System Information

The bottom of the settings page displays system information:

- Operating system version
- CPU architecture
- Memory size
- CogniaLauncher data directory
- System uptime

---

## State Management

Settings data is stored across multiple Zustand Stores:

| Store | Purpose |
|-------|---------|
| `appearance.ts` | Theme, accent color, chart color theme |
| `settings.ts` | General settings |
| `window-state.ts` | Window state |

All Stores use the `persist` middleware for localStorage persistence.
