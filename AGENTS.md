# Agent Rules

- Do NOT add project structure trees, dependency inventories, or stack summaries to this file.
- Do NOT guess commands. Read project config/script files and run defined commands from there.
- Do NOT start edits before codebase discovery; use `ace-tool` first when available, otherwise use `rg`.
- Do NOT jump to web research first; check local code/config first, then use `exa`/`fetch`/`deepwiki`/`perplexity-ask` only when local context is insufficient.
- Do NOT modify files before reading neighboring implementation patterns.
- Do NOT finish a change without running at least one affected validation command (lint/test/build subset).
- Do NOT use `npm`, `yarn`, or `bun`; use `pnpm` for Node package/task commands.
- Do NOT scaffold or migrate to Vite/CRA/Electron; this project is Next.js App Router + Tauri.
- Do NOT swap Tailwind out for other styling systems unless explicitly requested.
- Do NOT expose non-`NEXT_PUBLIC_*` environment variables in client code.
- Do NOT commit `.env*` files.
- Do NOT widen Tauri capabilities without an explicit requirement.
