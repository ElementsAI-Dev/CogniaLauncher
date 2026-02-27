# Command Palette

The command palette provides global quick search functionality for fast access to all CogniaLauncher features.

---

## How to Open

- **Keyboard Shortcut**: ++ctrl+k++ (macOS: ++cmd+k++)
- **Sidebar Button**: Click the search icon

---

## Features

### Page Navigation

Type a page name to quickly jump to it:

- Dashboard
- Environments
- Packages
- Cache
- Downloads
- Settings
- About

### Action Search

Search and execute common actions:

- Install environment version
- Search packages
- Clean cache
- Switch theme
- Open settings

### Search Filtering

- Fuzzy matching
- Grouped by category
- Keyboard navigation (up/down arrows)
- Enter key to execute selected item

---

## Implementation

The command palette is built on [cmdk](https://cmdk.paco.me/):

- `components/command-palette.tsx` — Main component
- Registered as a global keyboard listener in `app/layout.tsx`
- Supports custom action registration

---

## Adding New Actions

See the developer guide: [Adding Commands](../development/adding-commands.md)
