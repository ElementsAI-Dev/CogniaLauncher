# Installation Guide

## Prerequisites

### Web Development

- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **pnpm** 8.x or higher (recommended)

```bash
npm install -g pnpm
```

### Desktop Application Development (Additional Requirements)

- **Rust** 1.70 or higher ([Install](https://www.rust-lang.org/tools/install))

```bash
# Verify installation
rustc --version
cargo --version
```

- **System dependencies** (by operating system):
    - **Windows**: Microsoft Visual Studio C++ Build Tools
    - **macOS**: Xcode Command Line Tools
    - **Linux**: See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

---

## Installation Steps

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd CogniaLauncher
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Verify Installation

```bash
# Check if Next.js is ready
pnpm dev

# Run tests
pnpm test

# Check if Tauri is ready (optional, requires Rust toolchain)
pnpm tauri info
```

---

## Available Scripts

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server (port 3000) |
| `pnpm build` | Build production version (output to `out/` directory) |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint code checks |
| `pnpm lint --fix` | Auto-fix ESLint issues |
| `pnpm test` | Run Jest unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |

### Tauri (Desktop) Scripts

| Command | Description |
|---------|-------------|
| `pnpm tauri dev` | Start Tauri dev mode (hot reload) |
| `pnpm tauri build` | Build desktop application |
| `pnpm tauri info` | Display Tauri environment info |
| `pnpm tauri icon` | Generate app icons from source image |

---

## Production Build

### Web Application

```bash
pnpm build
# Output directory: out/
# Deployable to any static hosting service
```

### Desktop Application

```bash
# Build for current platform
pnpm tauri build
```

Output locations:

| Platform | Path |
|----------|------|
| Windows | `src-tauri/target/release/bundle/msi/` |
| macOS | `src-tauri/target/release/bundle/dmg/` |
| Linux | `src-tauri/target/release/bundle/appimage/` |

Build options:

```bash
# Specify target platform
pnpm tauri build --target x86_64-pc-windows-msvc

# With debug info
pnpm tauri build --debug
```

---

## Adding UI Components

The project uses the shadcn/ui component library:

```bash
# Add a single component
pnpm dlx shadcn@latest add card

# Add multiple components
pnpm dlx shadcn@latest add button card dialog
```
