# Command Palette Architecture

## 1. Identity

- **What it is:** A React component implementing a command palette with fuzzy search and keyboard navigation.
- **Purpose:** Enable efficient keyboard-driven workflow for power users.

## 2. Core Components

- `components/command-palette.tsx` (CommandPalette): Main palette component with search, navigation items, and action groups.
- `components/ui/command/`: shadcn/ui Command components (CommandDialog, CommandInput, CommandList, etc.).
- `lib/hooks/use-keyboard-shortcuts.ts` (useKeyboardShortcuts): Hook for registering keyboard shortcuts.
- `lib/stores/log.ts` (useLogStore): Log store integration for log drawer toggle action.
- `components/app-shell.tsx`: Shell component managing palette open state.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Activation:** User presses `Ctrl+K` → `useKeyboardShortcuts` in `components/command-palette.tsx:59-65` triggers open.
- **2. Search:** User types query → `CommandInput` filters items in real-time.
- **3. Selection:** User selects item → handler executes navigation or action in `components/command-palette.tsx:80-120`.
- **4. Navigation:** Navigation items use `router.push()` for page transitions.
- **5. Actions:** Action items call store methods (e.g., `toggleDrawer()` for logs).

## 4. Design Rationale

Command palette follows VS Code/Cursor pattern for familiar UX. Fuzzy search enables quick access without exact matching. Keyboard-only workflow improves efficiency for frequent users.
