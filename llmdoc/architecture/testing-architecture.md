# Testing Architecture

## 1. Identity

- **What it is:** Jest-based testing framework with jsdom environment.
- **Purpose:** Validate frontend behavior through unit and integration tests.

## 2. Core Components

- `jest.config.ts` - Jest configuration with coverage thresholds and module mocking
- `jest.setup.ts` - Test environment setup
- `app/about/page.test.tsx` (AboutPage tests) - Page structure, version info, system info, actions, changelog, license
- `components/providers/locale-provider.test.tsx` (LocaleProvider) - i18n provider behavior
- `components/providers/theme-provider.test.tsx` (ThemeProvider) - Theme switching, accent colors, reduced motion
- `components/theme-toggle.test.tsx` (ThemeToggle) - Theme toggle dropdown interactions
- `lib/__tests__/errors.test.ts` (error utilities) - Error parsing, formatting, type detection
- `lib/__tests__/tauri.test.ts` (type validation) - Tauri type structure validation
- `lib/hooks/__tests__/use-keyboard-shortcuts.test.ts` (keyboard shortcuts) - Shortcut registration and execution
- `lib/hooks/__tests__/use-version-cache.test.ts` (version cache) - Cache expiry, invalidation
- `lib/hooks/__tests__/use-auto-version.test.ts` (auto version) - Version detection and switching
- `lib/hooks/__tests__/use-packages.test.ts` (package operations) - Package search, install, uninstall
- `lib/stores/__tests__/environment.test.ts` (environment store) - Environment state management
- `lib/stores/__tests__/packages.test.ts` (package store) - Package state management
- `lib/stores/appearance.test.ts` (appearance store) - Theme persistence and actions

## 3. Execution Flow

1. **Test Discovery:** Jest scans for `*.test.{ts,tsx}` and `__tests__/` directories per `jest.config.ts:210-213`
2. **Module Resolution:** Path aliases (`@/*`) mapped to root via `jest.config.ts:119`
3. **Mocking:** CSS and image imports mocked via `jest.config.ts:122-128`
4. **Setup:** `jest.setup.ts` configures Testing Library and globals
5. **Execution:** Tests run in jsdom environment per `jest.config.ts:201`
6. **Reporting:** Results output to console + JUnit XML (`coverage/junit.xml`) per `jest.config.ts:153-162`

## 4. Design Rationale

- **Co-location:** Tests placed next to source for easier maintenance
- **Coverage Thresholds:** Enforce minimum 60-70% coverage per `jest.config.ts:59-66`
- **Role-Based Queries:** Testing Library best practices for accessibility
- **Mock Isolation:** External dependencies (Tauri, next-themes) mocked for deterministic tests
