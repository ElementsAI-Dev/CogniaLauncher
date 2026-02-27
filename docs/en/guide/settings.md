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

### Security Settings

- Allow HTTP (development only)
- Certificate verification
- Self-signed certificates

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
