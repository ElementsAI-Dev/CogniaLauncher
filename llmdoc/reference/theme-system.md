# Theme System Reference

## 1. Core Summary

Dynamic theme system with light/dark modes, accent colors, reduced motion support, and persistent storage via Zustand.

## 2. Source of Truth

- **Primary Store:** `lib/stores/appearance.ts` - Theme state with persistence
- **Color Definitions:** `lib/theme/colors.ts` - Accent color palettes (oklch)
- **Provider:** `components/providers/theme-provider.tsx` - Theme context wrapper
- **Toggle:** `components/theme-toggle.tsx` - Theme switcher UI
- **Types:** `lib/theme/types.ts` - TypeScript definitions
- **Tests:** `components/providers/theme-provider.test.tsx`, `lib/stores/appearance.test.ts`

## 3. Accent Colors

Available colors: `zinc`, `blue`, `green`, `purple`, `orange`, `rose`
Default: `blue`
Storage: `localStorage` key `cognia-appearance` per `lib/stores/appearance.ts:37`

## 4. Theme Modes

Modes: `light`, `dark`, `system`
Implementation: next-themes library
CSS variables applied to document root per `lib/theme/colors.ts:123-140`

## 5. Accessibility Features

- Reduced motion: Adds `.no-transitions` class when enabled per `components/providers/theme-provider.tsx`
- Accent colors: Perceptually uniform oklch color space
- High contrast: Primary and foreground color pairs defined per mode
