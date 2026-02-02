# Keyboard Shortcuts Reference

## 1. Core Summary

Hook-based keyboard shortcut system supporting Ctrl/Cmd modifiers with input field awareness and cross-platform key display.

## 2. Source of Truth

- **Primary Code:** `lib/hooks/use-keyboard-shortcuts.ts` - Shortcut registration and handling
- **Settings Shortcuts:** `lib/hooks/use-settings-shortcuts.ts` - Settings page specific shortcuts (Ctrl+S save)
- **Environment Shortcuts:** `lib/hooks/use-keyboard-shortcuts.ts:76-130` - Predefined environment shortcuts
- **Formatting:** `lib/hooks/use-keyboard-shortcuts.ts:135-153` - Cross-platform shortcut display
- **Tests:** `lib/hooks/__tests__/use-keyboard-shortcuts.test.ts` - Shortcut behavior tests

## 3. Shortcut Definitions

**General Shortcuts:**
- `Ctrl/Cmd + R` - Refresh environments
- `Ctrl/Cmd + N` - Add new environment
- `Ctrl/Cmd + K` or `/` - Focus search
- `Escape` - Close dialog/panel

**Settings Shortcuts:**
- `Ctrl/Cmd + S` - Save settings (works in inputs)
- `Ctrl/Cmd + R` - Reset settings (outside inputs)
- `Escape` - Cancel/close

## 4. Platform Behavior

- **Mac:** Displays ⌘ ⇧ ⌥ symbols
- **Windows/Linux:** Displays Ctrl+Shift+Alt text
- **Input Fields:** Shortcuts disabled except Ctrl+S (settings)
