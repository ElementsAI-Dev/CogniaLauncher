# Quick Start

This guide helps you experience CogniaLauncher's core features in 5 minutes.

---

## Launch the Application

### Web Mode

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

### Desktop Mode

```bash
pnpm tauri dev
```

This command starts both the Next.js dev server and the Tauri desktop window.

---

## Core Features Tour

### 1. Dashboard

The dashboard is the first page you see after launch, providing:

- **Environment Overview** — Installed runtime environments and versions
- **Quick Actions** — Shortcuts to common features
- **System Status** — Provider availability, cache usage
- **Customizable Widgets** — Drag to reorder, show/hide

### 2. Environment Management

Navigate to the **Environments** page:

- View installed Node.js, Python, Rust, and other environments
- Install new versions (with progress tracking and cancel support)
- Switch global/project-level versions
- Version alias resolution (e.g., `lts`, `latest`, `stable`)

### 3. Package Management

Navigate to the **Packages** page:

- Search packages across 51+ Providers
- One-click install/uninstall
- View package details (versions, dependencies, license)
- Batch operation support

### 4. Command Palette

Press ++ctrl+k++ (macOS: ++cmd+k++) to open the command palette:

- Search all features and pages
- Quick navigation
- Execute common operations

---

## Project Structure Overview

```text
CogniaLauncher/
├── app/                      # Next.js App Router (page routes)
├── components/               # React components
│   ├── ui/                   # shadcn/ui base components
│   ├── dashboard/            # Dashboard components
│   ├── settings/             # Settings components
│   └── ...                   # Other feature components
├── hooks/                    # React Hooks (51)
├── lib/                      # Utilities and state management
│   ├── stores/               # Zustand Stores (9)
│   ├── theme/                # Theme system
│   ├── constants/            # Constants
│   └── tauri.ts              # Tauri API bindings
├── messages/                 # i18n translation files
├── src-tauri/                # Tauri/Rust backend
│   ├── src/commands/         # Tauri commands (217+)
│   ├── src/provider/         # Provider implementations (51+)
│   ├── src/core/             # Core business logic
│   └── src/cache/            # Cache system
├── types/                    # TypeScript type definitions
└── docs/                     # Documentation (this site)
```

---

## Next Steps

- **[Configuration](configuration.md)** — Customize network, proxy, mirror sources, etc.
- **[User Guide](../guide/dashboard.md)** — Deep dive into each feature module
- **[Provider List](../reference/providers-list.md)** — View all supported package managers
