# Testing Architecture

## 1. Identity

- **What it is:** Jest-based testing framework with jsdom environment.
- **Purpose:** Validate frontend behavior through unit and integration tests.

## 2. Core Components

- `jest.config.ts` - Jest 30.2.0 configuration with coverage thresholds and module mocking
- `jest.setup.ts` - Test environment setup
- `package.json` - Testing dependencies: @testing-library/react 16.3.2, jsdom 30.2.0, ts-jest 29.4.6

**Test Files (14 total):**
- `hooks/use-mobile.test.ts` - Mobile breakpoint detection hook
- `hooks/use-unsaved-changes.test.ts` - Unsaved changes tracking hook
- `hooks/use-network.test.ts` - Network status monitoring hook
- `hooks/use-version-cache.test.ts` - Version caching with expiry hook
- `hooks/use-keyboard-shortcuts.test.ts` - Keyboard shortcut registration hook
- `hooks/use-settings-shortcuts.test.ts` - Settings navigation shortcuts hook
- `hooks/use-health-check.test.ts` - Health check operations hook
- `hooks/use-downloads.test.ts` - Download management hook
- `hooks/use-logs.test.ts` - Log viewing hook
- `hooks/use-settings.test.ts` - Settings management hook
- `hooks/use-environments.test.ts` - Environment operations hook
- `hooks/use-package-export.test.ts` - Package export functionality hook
- `hooks/use-profiles.test.ts` - Profile management hook
- `hooks/use-appearance-config-sync.test.ts` - Appearance config synchronization hook
- `hooks/use-auto-update.test.ts` - Auto-update mechanism hook
- `hooks/use-tray-sync.test.ts` - System tray state synchronization hook
- `hooks/use-packages.test.ts` - Package operations hook
- `hooks/use-auto-version.test.ts` - Auto version detection hook

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
