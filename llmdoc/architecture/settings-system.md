# Architecture of Settings System

## 1. Identity

- **What it is:** Application configuration management architecture.
- **Purpose:** Centralized state management for all application settings.

## 2. Core Components

- `lib/stores/settings.ts` (useSettingsStore): Manages config, cache info, platform info, loading/error states.
- `lib/stores/appearance.ts` (useAppearanceStore): Manages theme mode, accent color, reduced motion preferences.
- `lib/hooks/use-settings.ts` (useSettings): React hook providing Tauri command bindings for settings operations.
- `lib/theme/types.ts`: TypeScript types for theme configuration.
- `lib/theme/colors.ts` (applyAccentColor, removeAccentColor): Accent color utilities using oklch.

## 3. Execution Flow (LLM Retrieval Map)

- **Settings Load:** `app/settings/page.tsx:54-60` calls `fetchConfig()` → `lib/hooks/use-settings.ts:11-28` → Tauri `configList()`.
- **Settings Update:** User input → `handleChange()` in `app/settings/page.tsx:78-84` → `updateConfigValue()` in `lib/hooks/use-settings.ts:30-39` → Tauri `configSet()`.
- **Theme Change:** `components/providers/theme-provider.tsx:12-40` watches `resolvedTheme` and `accentColor` → calls `applyAccentColor()` in `lib/theme/colors.ts:123-140`.
- **Reduced Motion:** `ThemeProvider` component in `components/providers/theme-provider.tsx:28-37` applies `.no-transitions` class to root.

## 4. Design Rationale

- **Dual Store Pattern:** Separates appearance (client-only) from settings (backend-synced).
- **oklch Color Space:** Perceptual uniformity for consistent accent colors across light/dark modes.
- **Zustand Persist:** Automatic localStorage sync without manual serialization.
