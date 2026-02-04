# How to Add Actions to the Command Palette

1. **Define Action:** Add your action to the appropriate group in `components/command-palette.tsx` (navigation, settings, or actions).

2. **Add Handler:** Implement the handler function that executes your action (navigation, store call, or async operation).

3. **Add Label:** Add localization keys to `messages/en.json` and `messages/zh.json` for your action label.

4. **Register Shortcut (Optional):** If adding a keyboard shortcut, register it in `useKeyboardShortcuts` in `components/command-palette.tsx:59-65`.

5. **Test:** Run `pnpm dev`, open palette with `Ctrl+K`, and verify your action appears and works correctly.

6. **Add Shortcut Hint:** If your action has a shortcut, display it using `CommandShortcut` component.
