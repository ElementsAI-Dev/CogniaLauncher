# React Hooks Reference

CogniaLauncher includes 30 custom React Hooks that encapsulate business logic and Tauri API calls.

---

## Core Hooks

| Hook | File | Purpose |
|------|------|------|
| `useAppInit` | `use-app-init.ts` | App initialization (Provider registration, settings loading) |
| `useAboutData` | `use-about-data.ts` | About page data (version, build info) |
| `useNetwork` | `use-network.ts` | Network status monitoring |

## Environment Management

| Hook | File | Purpose |
|------|------|------|
| `useEnvironments` | `use-environments.ts` | Environment list and version management |
| `useLaunch` | `use-launch.ts` | Program launch and environment activation |
| `useAutoVersion` | `use-auto-version.ts` | Auto version detection and switching |
| `useVersionCache` | `use-version-cache.ts` | Version list caching |
| `useRustup` | `use-rustup.ts` | Rustup toolchain/component/target management |

## Package Management

| Hook | File | Purpose |
|------|------|------|
| `usePackages` | `use-packages.ts` | Package search and management |
| `usePackageExport` | `use-package-export.ts` | Package list export |
| `useProviderDetail` | `use-provider-detail.ts` | Provider details and configuration |

## Download Management

| Hook | File | Purpose |
|------|------|------|
| `useDownloads` | `use-downloads.ts` | Download task management |
| `useGithubDownloads` | `use-github-downloads.ts` | GitHub Release downloads |
| `useGitlabDownloads` | `use-gitlab-downloads.ts` | GitLab Release downloads |
| `useAssetMatcher` | `use-asset-matcher.ts` | Download asset matching |

## Settings & Appearance

| Hook | File | Purpose |
|------|------|------|
| `useSettings` | `use-settings.ts` | Settings read/write |
| `useSettingsSearch` | `use-settings-search.ts` | Settings search and section tracking |
| `useSettingsShortcuts` | `use-settings-shortcuts.ts` | Settings page shortcuts |
| `useAppearanceConfigSync` | `use-appearance-config-sync.ts` | Appearance settings sync with backend |

## WSL

| Hook | File | Purpose |
|------|------|------|
| `useWsl` | `use-wsl.ts` | WSL management operations |

## Logs

| Hook | File | Purpose |
|------|------|------|
| `useLogs` | `use-logs.ts` | Log viewing and management |

## System Features

| Hook | File | Purpose |
|------|------|------|
| `useHealthCheck` | `use-health-check.ts` | Health check |
| `useProfiles` | `use-profiles.ts` | Config snapshots |
| `useShim` | `use-shim.ts` | Shim/PATH management |
| `useAutoUpdate` | `use-auto-update.ts` | App auto-update |
| `useOnboarding` | `use-onboarding.ts` | Onboarding wizard |

## UI Utilities

| Hook | File | Purpose |
|------|------|------|
| `useKeyboardShortcuts` | `use-keyboard-shortcuts.ts` | Global keyboard shortcuts |
| `useMobile` | `use-mobile.ts` | Mobile/responsive detection |
| `useTraySync` | `use-tray-sync.ts` | System tray state sync |
| `useUnsavedChanges` | `use-unsaved-changes.ts` | Unsaved changes prompt |

---

## Usage

```tsx
import { useEnvironments } from "@/hooks/use-environments";

function EnvironmentPage() {
  const {
    environments,
    loading,
    install,
    uninstall,
    setGlobalVersion,
  } = useEnvironments();

  // Use data and methods returned by the Hook
}
```

All Hooks internally use the `isTauri()` guard to ensure Tauri APIs are not called in Web mode.
