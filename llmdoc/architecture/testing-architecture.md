# Testing Architecture

## 1. Identity

- **What it is:** Jest-based testing framework with jsdom environment.
- **Purpose:** Validate frontend behavior through unit and integration tests.

## 2. Core Components

- `jest.config.ts` - Jest 30.2.0 configuration with coverage thresholds and module mocking
- `jest.setup.ts` - Test environment setup
- `package.json` - Testing dependencies: @testing-library/react 16.3.2, jsdom 30.2.0, ts-jest 29.4.6

**Test Files (100+ total across frontend, 270+ Rust unit tests):**

**Hook Tests (18 files in `hooks/`):**
- `use-mobile.test.ts`, `use-unsaved-changes.test.ts`, `use-network.test.ts`, `use-version-cache.test.ts`
- `use-keyboard-shortcuts.test.ts`, `use-settings-shortcuts.test.ts`, `use-health-check.test.ts`
- `use-downloads.test.ts`, `use-logs.test.ts`, `use-settings.test.ts`, `use-environments.test.ts`
- `use-package-export.test.ts`, `use-profiles.test.ts`, `use-appearance-config-sync.test.ts`
- `use-auto-update.test.ts`, `use-tray-sync.test.ts`, `use-packages.test.ts`, `use-auto-version.test.ts`
- `use-about-data.test.ts`, `use-app-init.test.ts`, `use-asset-matcher.test.ts`, `normalize-package-id.test.ts`

**Store Tests (7 files in `lib/stores/__tests__/`):**
- `appearance.test.ts`, `download.test.ts`, `environment.test.ts`, `log.test.ts`
- `onboarding.test.ts`, `packages.test.ts`, `settings.test.ts`

**Component Tests (55+ files across `components/`):**
- `about/` (8 tests), `cache/` (6 tests), `dashboard/` (8 + 10 widget tests)
- `downloads/` (5 tests), `environments/` (10+ tests including detail pages)
- `wsl/` (15+ tests), `onboarding/` (2 tests), `settings/` (tests)
- `app-shell.test.tsx`, `app-sidebar.test.tsx`, `command-palette.test.tsx`

**Page Tests:** `app/page.test.tsx`, `app/about/page.test.tsx`, `app/cache/page.test.tsx`, `app/downloads/page.test.tsx`

**Rust Tests (270+ in `src-tauri/src/provider/`):**
- Output parsing, version detection, provider metadata across all 48 providers

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
