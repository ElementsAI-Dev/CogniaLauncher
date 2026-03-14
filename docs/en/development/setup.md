# Development Setup

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x+ | JavaScript runtime |
| pnpm | 8.x+ | Package manager |
| Rust | 1.70+ | Backend compilation (optional) |
| Git | 2.x+ | Version control |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd CogniaLauncher

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev          # Frontend only (Web mode)
pnpm tauri dev    # Frontend + Desktop (requires Rust)
```

---

## Project Structure

```text
CogniaLauncher/
├── app/                 # Next.js App Router routes
├── components/          # React components
│   └── ui/              # shadcn/ui base components
├── hooks/               # Custom React Hooks (51)
├── lib/                 # Utilities
│   ├── stores/          # Zustand Stores (9)
│   ├── theme/           # Theme system
│   ├── constants/       # Constants
│   └── tauri.ts         # Tauri API bindings
├── messages/            # i18n translations (en/zh)
├── types/               # TypeScript types
├── src-tauri/           # Rust backend
│   └── src/
│       ├── commands/    # Tauri commands (217+)
│       ├── provider/    # Providers (51+)
│       ├── core/        # Core logic
│       └── cache/       # Cache system
├── docs/                # Documentation (this site)
├── llmdoc/              # AI context documentation
└── openspec/            # Change specifications
```

---

## Development Commands

### Frontend

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Build production version |
| `pnpm lint` | Run ESLint |
| `pnpm lint --fix` | Auto-fix lint issues |
| `pnpm test` | Run Jest tests |
| `pnpm test:watch` | Watch mode tests |
| `pnpm test:coverage` | Test coverage |

### Backend

| Command | Description |
|---------|-------------|
| `cargo check` | Check Rust compilation |
| `cargo test` | Run Rust tests |
| `cargo clippy` | Run Rust linter |
| `pnpm tauri dev` | Start desktop dev mode |
| `pnpm tauri build` | Build desktop application |

### Desktop Debugging with CrabNebula DevTools

Use CrabNebula DevTools when you need to inspect Tauri command calls, emitted events, spans, or backend logs in a desktop debug build.

1. Install the standalone CrabNebula DevTools app from the official guide: <https://docs.crabnebula.dev/devtools/get-started/>.
2. Start CogniaLauncher in desktop debug mode with `pnpm tauri dev`.
3. Connect the running app from CrabNebula DevTools and inspect commands, events, logs, and spans there.

Notes:

- Desktop debug builds register `tauri-plugin-devtools` and do **not** initialize `tauri-plugin-log` in the same process.
- Production/release builds continue to use `tauri-plugin-log` for log files, WebView forwarding, and the in-app log management workflow.
- If the in-app log panel warns that the backend bridge is unavailable during debug work, that is expected; use CrabNebula DevTools for backend inspection.

---

## IDE Configuration

### VS Code Recommended Extensions

- **Tailwind CSS IntelliSense** — Style hints
- **ESLint** — Code quality
- **rust-analyzer** — Rust language support
- **Tauri** — Tauri development tools
- **Even Better TOML** — TOML file support

### Path Aliases

The project has the following path aliases configured (`tsconfig.json`):

```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

Usage: `import { Button } from "@/components/ui/button"`
