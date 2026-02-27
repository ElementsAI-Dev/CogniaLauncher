# CogniaLauncher

**Cross-platform Environment & Package Manager** — Manage development environments and packages with a modern graphical interface.

Built with **Next.js 16** + **React 19** + **Tauri 2.9**, delivering native desktop performance.

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🔧 **Environment Management** | Manage runtime versions for Node.js, Python, Rust, Java, Kotlin, Go, Ruby, PHP, Deno, and more |
| 📦 **Package Management** | Search, install, and update packages from 55 Providers |
| 💾 **Cache Management** | SQLite + JSON dual-backend caching with cleanup, verification, and repair |
| 📥 **Download Management** | Queued downloads with speed limiting, concurrency control, resume support, and history |
| 🖥️ **WSL Management** | Windows Subsystem for Linux management with import/export, disk mounting, and config editing |
| ⌨️ **Command Palette** | Global quick search for fast access to all features |
| 📊 **Batch Operations** | Batch install/uninstall/update with progress tracking and dependency resolution |
| 🔍 **Custom Detection** | User-defined version detection rules with 9 extraction strategies |
| 🏥 **Health Check** | Environment and system diagnostics with fix suggestions |
| 📸 **Config Snapshots** | Environment configuration profile management |
| 🎨 **Modern UI** | shadcn/ui + Tailwind CSS v4 with multi-theme and accent color support |
| 🌐 **Internationalization** | Bilingual support (Chinese & English) |
| 🔄 **Auto Update** | Built-in application self-update system |
| 🧪 **Test Coverage** | Jest 30 + Testing Library complete test suite |

---

## Tech Stack

### Frontend

- **Next.js 16** — App Router, static export
- **React 19** — Latest React features
- **Tailwind CSS v4** — Utility-first styling
- **shadcn/ui** — High-quality UI components
- **Zustand 5** — Lightweight state management (persisted)
- **next-intl** — Internationalization
- **Recharts** — Data visualization
- **cmdk** — Command palette

### Backend

- **Tauri 2.9** — Native desktop framework
- **Rust** — High-performance backend logic
- **SQLite** — Cache and state storage
- **55 Providers** — Extensible package source system

### Development Tools

- **Jest 30** — Unit testing
- **Testing Library** — Component testing
- **ESLint** — Code quality
- **GitHub Actions** — CI/CD

---

## Supported Platforms

| Platform | Architecture | Install Format |
|----------|-------------|----------------|
| Windows | x64 | MSI, NSIS |
| macOS | x64, ARM64 | DMG |
| Linux | x86_64 | AppImage, .deb |

---

## Quick Navigation

- **[Installation Guide](getting-started/installation.md)** — Install CogniaLauncher from scratch
- **[Quick Start](getting-started/quick-start.md)** — Experience core features in 5 minutes
- **[Configuration](getting-started/configuration.md)** — Customize application settings
- **[User Guide](guide/dashboard.md)** — Detailed feature tutorials
- **[Architecture](architecture/overview.md)** — System architecture and design philosophy
- **[Developer Guide](development/setup.md)** — Contribute to the project
- **[API Reference](reference/commands.md)** — Complete API and command reference
- **[Provider List](reference/providers-list.md)** — Detailed info on 55 Providers

---

## Project Stats

| Metric | Value |
|--------|-------|
| Providers | 55 |
| Tauri Commands | 288 |
| React Hooks | 30 |
| Zustand Stores | 9 |
| i18n Keys | 1640+ |
| Supported Languages | 10+ runtime environments |
| Test Coverage | Jest 30 + Testing Library |
