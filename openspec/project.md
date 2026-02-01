# Project Context

## Purpose

CogniaLauncher is a cross-platform environment and package manager with a modern graphical interface. It provides unified management for development environments (Node.js, Python, Rust) and packages from multiple providers (npm, PyPI, apt, Homebrew, winget, GitHub Releases). Built with **Next.js 16**, **React 19**, and **Tauri 2.9** for native desktop performance on Windows, macOS, and Linux.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Desktop**: Tauri 2.9 (Rust-based)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with CSS variables and dark mode
- **Components**: shadcn/ui with Radix UI primitives
- **State Management**: Zustand
- **Icons**: Lucide React
- **Font**: Geist (optimized via next/font)
- **Testing**: Jest 30, Testing Library (React 16.x), jsdom
- **Package Manager**: pnpm

## Project Conventions

### Code Style

- **Linting**: ESLint with `eslint-config-next` (core-web-vitals + typescript); keep code warning-free
- **Components**: PascalCase for component names/exports; files in `components/ui/` mirror export names
- **Routes**: Next.js app files are lowercase (`page.tsx`, `layout.tsx`)
- **Variables/Functions**: camelCase; hooks prefixed with `use*`
- **Styling**: Tailwind utility classes preferred; avoid custom CSS when possible
- **Imports**: Use path alias `@/*` for root-relative imports (e.g., `@/components/ui/button`)

### Architecture Patterns

- **Routing**: Next.js App Router (`app/` directory)
- **Components**: Reusable UI in `components/ui/` following shadcn patterns
- **Utilities**: Shared helpers in `lib/` (e.g., `lib/utils.ts` with `cn()` helper)
- **Static Assets**: `public/` directory for images, SVGs, icons
- **Desktop Wrapper**: `src-tauri/` contains Rust code, Tauri config, and app icons
- **State**: Zustand for global state, React hooks for local/component state

### Testing Strategy

- **Test Runner**: Jest 30 with jsdom environment
- **Testing Library**: @testing-library/react for component testing
- **File Naming**: `*.test.ts` / `*.test.tsx` co-located next to source files
- **Coverage**: V8 provider; reports in `coverage/` (HTML, LCOV, JUnit, Clover)
- **CI/CD**: GitHub Actions runs lint → test:coverage → build on push/PR to main/develop
- **Best Practices**: Test behavior not implementation; prefer accessible queries (`getByRole`); use `userEvent` over `fireEvent`

### Git Workflow

- **Commits**: Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`)
- **Issue Linking**: Reference issues in footer (`Closes #123`)
- **PRs**: Include scope/intent, screenshots for UI changes, validation steps; must pass `pnpm lint`
- **Branches**: Feature branches off main; keep changes focused

## Domain Context

CogniaLauncher serves as a unified interface for managing development environments and packages across multiple ecosystems:

- **Environment Providers**: nvm (Node.js), pyenv (Python), rustup (Rust) - manage runtime versions with global/local switching
- **Package Providers**: npm, pnpm, uv, Cargo, Chocolatey, Scoop, winget, Homebrew, apt, vcpkg, Docker, PSGallery, GitHub Releases - search, install, update packages with global package listing
- **Core Features**: Cache management, configuration system, dependency resolution, update checking

## Important Constraints

- **Security**: Use `.env.local` for secrets; never commit `.env*` files; only expose safe values via `NEXT_PUBLIC_*`
- **Tauri Security**: Minimize capabilities in `src-tauri/tauri.conf.json`; avoid broad filesystem access
- **Build Output**: Next.js static export goes to `out/` directory; Tauri bundles read from `out/`
- **Node Version**: Requires Node.js 20.x or later
- **Rust**: Tauri desktop builds require Rust 1.70+ toolchain

## External Dependencies

- **UI Components**: Add via `pnpm dlx shadcn@latest add [component-name]`
- **Tauri Plugins**: Managed via `src-tauri/Cargo.toml`
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)
- **Optional**: Codecov integration for coverage reporting (requires `CODECOV_TOKEN` secret)
