# CogniaLauncher

A cross-platform environment and package manager with a modern graphical interface. Built with **Next.js 16**, **React 19**, and **Tauri 2.9** for native desktop performance.

[中文文档](./README_zh.md)

## Features

- 🔧 **Environment Management** - Manage Node.js (nvm), Python (pyenv), and Rust (rustup) versions with installation progress tracking
- 📦 **Package Management** - Search, install, and update packages from multiple providers
- 🔌 **Multi-Provider Support** - npm, pnpm, uv, Cargo, Chocolatey, Scoop, winget, Homebrew, apt, vcpkg, Docker, PSGallery, GitHub Releases
- 💾 **Cache Management** - SQLite + JSON dual-backend caching with cleanup tools
- ⚙️ **Configuration System** - Network settings, proxies, mirrors, security options
- 🖥️ **Cross-Platform** - Native desktop app for Windows, macOS, and Linux
- 🎨 **Modern UI** - Beautiful interface with custom title bar, built with shadcn/ui and Tailwind CSS v4
- 🌐 **Internationalization** - Multi-language support (English, Chinese) via next-intl
- 🔄 **Auto Update** - Built-in self-update system for the application
- 📊 **Batch Operations** - Perform bulk actions on environments and packages with progress tracking
- ⌨️ **Command Palette** - Quick access to all features via keyboard shortcuts
- 🧪 **Testing** - Comprehensive test suite with Jest 30 and Testing Library

## Prerequisites

Before you begin, ensure you have the following installed:

### For Web Development

- **Node.js** 20.x or later ([Download](https://nodejs.org/))
- **pnpm** 8.x or later (recommended) or npm/yarn

  ```bash
  npm install -g pnpm
  ```

### For Desktop Development (Additional Requirements)

- **Rust** 1.70 or later ([Install](https://www.rust-lang.org/tools/install))

  ```bash
  # Verify installation
  rustc --version
  cargo --version
  ```

- **System Dependencies** (varies by OS):
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd CogniaLauncher
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   ```

3. **Verify installation**

   ```bash
   # Check if Next.js is ready
   pnpm dev

   # Run tests
   pnpm test

   # Check if Tauri is ready (optional, for desktop development)
   pnpm tauri info
   ```

## Development

### Web Application Development

#### Start Development Server

```bash
pnpm dev
# or
npm run dev
```

This starts the Next.js development server at [http://localhost:3000](http://localhost:3000). The page auto-reloads when you edit files.

#### Key Development Files

- `app/page.tsx` - Dashboard with environment and package overview
- `app/environments/page.tsx` - Environment version management
- `app/packages/page.tsx` - Package search and installation
- `app/providers/page.tsx` - Provider configuration
- `app/cache/page.tsx` - Cache management interface
- `app/settings/page.tsx` - Application settings
- `app/about/page.tsx` - About page with system information
- `app/downloads/page.tsx` - Download management
- `app/wsl/page.tsx` - WSL distribution management (Windows)
- `app/logs/page.tsx` - Application logs viewer
- `components/ui/` - Reusable UI components (shadcn/ui)
- `lib/tauri.ts` - Tauri API bindings for Rust backend
- `lib/hooks/` - React hooks for state management
- `lib/stores/` - Zustand state stores with persistence

### Desktop Application Development

#### Start Tauri Development Mode

```bash
pnpm tauri dev
```

This command:

1. Starts the Next.js development server
2. Launches the Tauri desktop application
3. Enables hot-reload for both frontend and Rust code

#### Tauri Development Files

- `src-tauri/src/main.rs` - Main Rust application entry point
- `src-tauri/src/lib.rs` - Rust library code
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/Cargo.toml` - Rust dependencies

## Available Scripts

### Frontend Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js development server on port 3000 |
| `pnpm build` | Build Next.js app for production (outputs to `out/` directory) |
| `pnpm start` | Start Next.js production server (after `pnpm build`) |
| `pnpm lint` | Run ESLint to check code quality |
| `pnpm lint --fix` | Auto-fix ESLint issues |
| `pnpm test` | Run Jest unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |

### Tauri (Desktop) Scripts

| Command | Description |
|---------|-------------|
| `pnpm tauri dev` | Start Tauri development mode with hot-reload |
| `pnpm tauri build` | Build production desktop application |
| `pnpm tauri info` | Display Tauri environment information |
| `pnpm tauri icon` | Generate app icons from source image |
| `pnpm tauri --help` | Show all available Tauri commands |

### Adding UI Components (shadcn/ui)

```bash
# Add a new component (e.g., Card)
pnpm dlx shadcn@latest add card

# Add multiple components
pnpm dlx shadcn@latest add button card dialog
```

## Project Structure

```text
CogniaLauncher/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Dashboard overview
│   ├── environments/        # Environment management page
│   ├── packages/            # Package management page
│   ├── providers/           # Provider configuration page
│   ├── cache/               # Cache management page
│   ├── settings/            # Settings page
│   ├── about/               # About page with system info
│   ├── downloads/           # Download management page
│   ├── logs/                # Application logs viewer
│   ├── layout.tsx           # Root layout with sidebar
│   └── globals.css          # Global styles
├── components/              # React components
│   ├── dashboard/           # Dashboard-specific components
│   ├── environments/        # Environment cards and controls
│   ├── packages/            # Package list and search components
│   ├── downloads/           # Download management components
│   ├── log/                 # Log viewer components
│   ├── settings/            # Settings panel components
│   ├── layout/              # Sidebar and navigation
│   └── ui/                  # shadcn/ui components
├── lib/                     # Utilities and state
│   ├── hooks/               # React hooks (use-environments, use-packages, etc.)
│   ├── stores/              # Zustand stores with persistence
│   ├── theme/               # Theme configuration and utilities
│   ├── constants/           # Application constants
│   ├── tauri.ts             # Tauri API bindings
│   └── utils.ts             # Helper functions
├── messages/                 # i18n translation files
│   ├── en.json              # English translations
│   └── zh.json              # Chinese translations
├── src-tauri/               # Tauri/Rust backend
│   ├── src/
│   │   ├── commands/        # Tauri command handlers
│   │   ├── cache/           # SQLite + JSON cache management
│   │   ├── config/          # Configuration system
│   │   ├── core/            # Core environment/package/batch logic
│   │   ├── provider/        # Provider implementations (30+)
│   │   ├── platform/        # Platform abstraction layer
│   │   ├── resolver/        # Dependency resolution
│   │   └── lib.rs           # Main Tauri setup
│   ├── icons/               # Desktop app icons
│   └── tauri.conf.json      # Tauri configuration
├── llmdoc/                   # AI/LLM documentation
├── openspec/                # OpenSpec change management
├── jest.config.ts           # Jest test configuration
├── components.json          # shadcn/ui configuration
├── next.config.ts           # Next.js configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Node.js dependencies
```

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory for environment-specific variables:

```env
# Example environment variables
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=React Quick Starter

# Private variables (not exposed to browser)
DATABASE_URL=postgresql://...
API_SECRET_KEY=your-secret-key
```

**Important**:

- Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Never commit `.env.local` to version control
- Use `.env.example` to document required variables

### Tauri Configuration

Edit `src-tauri/tauri.conf.json` to customize your desktop app:

```json
{
  "productName": "CogniaLauncher",         // App name
  "version": "0.1.0",                      // App version
  "identifier": "com.cognia.launcher",     // Unique app identifier
  "build": {
    "frontendDist": "../out",              // Next.js build output
    "devUrl": "http://localhost:3000"      // Dev server URL
  },
  "app": {
    "windows": [{
      "title": "CogniaLauncher",           // Window title
      "width": 1024,                       // Default width
      "height": 768,                       // Default height
      "resizable": true,                   // Allow resizing
      "fullscreen": false                  // Start fullscreen
    }]
  }
}
```

### Path Aliases

Configured in `components.json` and `tsconfig.json`:

```typescript
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

Available aliases:

- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/ui` → `components/ui/`
- `@/hooks` → `hooks/`
- `@/utils` → `lib/utils.ts`

### Tailwind CSS Configuration

The project uses Tailwind CSS v4 with:

- CSS variables for theming (defined in `app/globals.css`)
- Dark mode support via `class` strategy
- Custom color palette using CSS variables
- shadcn/ui styling system

## Building for Production

### Build Web Application

```bash
# Build static export
pnpm build

# Output directory: out/
# Deploy the out/ directory to any static hosting service
```

The build creates a static export in the `out/` directory, optimized for production.

### Build Desktop Application

```bash
# Build for current platform
pnpm tauri build

# Output locations:
# - Windows: src-tauri/target/release/bundle/msi/
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/appimage/
```

Build options:

```bash
# Build for specific target
pnpm tauri build --target x86_64-pc-windows-msvc

# Build with debug symbols
pnpm tauri build --debug

# Build without bundling
pnpm tauri build --bundles none
```

## Deployment

### Web Deployment

#### Vercel (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import project on [Vercel](https://vercel.com/new)
3. Vercel auto-detects Next.js and deploys

#### Netlify

```bash
# Build command
pnpm build

# Publish directory
out
```

#### Static Hosting (Nginx, Apache, etc.)

1. Build the project: `pnpm build`
2. Upload the `out/` directory to your server
3. Configure server to serve static files

### Desktop Deployment

#### Windows

- Distribute the `.msi` installer from `src-tauri/target/release/bundle/msi/`
- Users run the installer to install the application

#### macOS

- Distribute the `.dmg` file from `src-tauri/target/release/bundle/dmg/`
- Users drag the app to Applications folder
- **Note**: For distribution outside the App Store, you need to sign the app with an Apple Developer certificate

#### Linux

- Distribute the `.AppImage` from `src-tauri/target/release/bundle/appimage/`
- Users make it executable and run: `chmod +x app.AppImage && ./app.AppImage`
- Alternative formats: `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL)

#### Code Signing (Recommended for Production)

- **Windows**: Use a code signing certificate
- **macOS**: Requires Apple Developer account and certificate
- **Linux**: Optional, but recommended for distribution

See [Tauri Distribution Guide](https://tauri.app/v1/guides/distribution/) for detailed instructions.

## Development Workflow

### Typical Development Cycle

1. **Start development server**

   ```bash
   pnpm dev  # For web development
   # or
   pnpm tauri dev  # For desktop development
   ```

2. **Make changes**
   - Edit files in `app/`, `components/`, or `lib/`
   - Changes auto-reload in the browser/desktop app

3. **Add new components**

   ```bash
   pnpm dlx shadcn@latest add [component-name]
   ```

4. **Lint your code**

   ```bash
   pnpm lint
   ```

5. **Build and test**

   ```bash
   pnpm build  # Test web build
   pnpm tauri build  # Test desktop build
   ```

### Best Practices

- **Code Style**: Follow ESLint rules (`pnpm lint`)
- **Testing**: Write tests for new features (`pnpm test`)
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Components**: Keep components small and reusable
- **State**: Use Zustand stores in `lib/stores/` for global state
- **Hooks**: Use custom hooks in `lib/hooks/` for Tauri API interactions
- **Backend**: Add new Rust commands in `src-tauri/src/commands/`
- **Styling**: Use Tailwind utility classes, avoid custom CSS when possible
- **i18n**: Add translations in `messages/en.json` and `messages/zh.json`

## Troubleshooting

### Common Issues

**Port 3000 already in use**

```bash
# Kill the process using port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

**Tauri build fails**

```bash
# Check Tauri environment
pnpm tauri info

# Update Rust
rustup update

# Clean build cache
cd src-tauri
cargo clean
```

**Module not found errors**

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Next.js GitHub](https://github.com/vercel/next.js) - Next.js repository

### Tauri Resources

- [Tauri Documentation](https://tauri.app/) - Official Tauri documentation
- [Tauri API Reference](https://tauri.app/v1/api/js/) - JavaScript API reference
- [Tauri GitHub](https://github.com/tauri-apps/tauri) - Tauri repository

### UI & Styling

- [shadcn/ui](https://ui.shadcn.com/) - Component library documentation
- [Tailwind CSS](https://tailwindcss.com/docs) - Tailwind CSS documentation
- [Radix UI](https://www.radix-ui.com/) - Radix UI primitives

### State Management

- [Zustand](https://zustand-demo.pmnd.rs/) - Zustand documentation

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions:

- Check the [Troubleshooting](#troubleshooting) section
- Review [Next.js Documentation](https://nextjs.org/docs)
- Review [Tauri Documentation](https://tauri.app/)
- Open an issue on GitHub
