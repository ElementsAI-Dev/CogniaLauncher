# User Guide

This section provides detailed documentation for each feature module of CogniaLauncher.

## Feature Modules

- **[Dashboard](dashboard.md)** — Main interface, environment overview and quick actions
- **[Environment Management](environments.md)** — Manage runtime versions (Node.js, Python, Rust, etc.)
- **[Package Management](packages.md)** — Search, install, and update packages
- **[Provider System](providers.md)** — Learn about 51+ package manager integrations
- **[Cache Management](cache.md)** — Cache cleanup, verification, and monitoring
- **[Download Management](downloads.md)** — Download queue, speed limiting, and history
- **[WSL Management](wsl.md)** — Windows Subsystem for Linux management (Windows only)
- **[Settings & Themes](settings.md)** — Personalized configuration and appearance
- **[Command Palette](command-palette.md)** — Global quick search
- **[Logging System](logs.md)** — Application log viewing and analysis

## Desktop-First Route Notes

The app shell also includes desktop-first routes such as `/git`, `/envvar`, `/terminal`, and `/health`.
In Web mode, these routes are expected to show fallback guidance instead of desktop-only controls.
Keep related docs updates aligned with route behavior changes and E2E route coverage updates.
