# Settings and Theme APIs Reference

## 1. Core Summary

The settings system exposes Zustand stores, React hooks, and Tauri commands for configuration management. The theme system provides utilities for accent color manipulation and theme mode switching.

## 2. Source of Truth

- **Settings Store:** `lib/stores/settings.ts` - Application configuration state with cache, platform info.
- **Appearance Store:** `lib/stores/appearance.ts` - Theme mode, accent color, reduced motion state.
- **Settings Hook:** `lib/hooks/use-settings.ts` - React hook with Tauri command bindings (fetchConfig, updateConfigValue, resetConfig).
- **Theme Types:** `lib/theme/types.ts` - TypeScript types for ThemeMode, AccentColor, ColorScheme.
- **Theme Colors:** `lib/theme/colors.ts` - Accent color definitions and apply/remove functions.
- **Settings UI:** `components/settings/` - All settings page components.
- **Theme Provider:** `components/providers/theme-provider.tsx` - Manages accent color application and reduced motion.
- **Settings Page:** `app/settings/page.tsx` - Main settings page with import/export, validation, keyboard shortcuts.
- **Tauri Commands:** `src-tauri/src/commands/config.rs` - Backend config commands (config_list, config_set, config_reset).
