# How to Add an Accent Color

1. **Update types** in `lib/theme/types.ts:3` by adding the new color to the `AccentColor` type union.

2. **Add color definitions** to `lib/theme/colors.ts:7-116` with light/dark mode oklch values for primary, primary-foreground, sidebar-primary, sidebar-primary-foreground, ring, chart-1.

3. **Add label** to `lib/theme/types.ts:29-36` in `ACCENT_COLOR_LABELS` record.

4. **Add CSS class** to `lib/theme/types.ts:38-45` in `ACCENT_COLOR_CSS_CLASSES` record.

5. **Update picker** in `components/settings/accent-color-picker.tsx:9` by adding the new color to `accentColorOptions` array.

6. **Add translations** to `messages/en.json` and `messages/zh.json` for the color label.

7. **Verify** by testing color selection in settings page and confirming it persists across page reloads.
