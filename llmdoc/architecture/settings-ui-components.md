# Architecture of Settings UI Components

## 1. Identity

- **What it is:** Modular settings page component architecture.
- **Purpose:** Reusable, accessible settings UI with organized sections.

## 2. Core Components

- `components/settings/appearance-settings.tsx` (AppearanceSettings): Theme, language, accent color, reduced motion controls.
- `components/settings/general-settings.tsx` (GeneralSettings): Basic application configuration.
- `components/settings/network-settings.tsx` (NetworkSettings): Network and proxy configuration.
- `components/settings/security-settings.tsx` (SecuritySettings): Security-related settings.
- `components/settings/mirrors-settings.tsx` (MirrorsSettings): Package mirror configuration.
- `components/settings/system-info.tsx` (SystemInfo): Platform information display.
- `components/settings/accent-color-picker.tsx` (AccentColorPicker): Visual color selection with tooltip previews.
- `components/settings/settings-skeleton.tsx` (SettingsSkeleton): Loading state placeholder.
- `components/settings/setting-item.tsx` (SettingItem): Reusable form control wrapper.

## 3. Execution Flow (LLM Retrieval Map)

- **Page Render:** `app/settings/page.tsx:41` initializes → fetches config via `useSettings()` hook.
- **Component Mount:** Individual settings sections (lines 332-374) receive `localConfig`, `errors`, `onValueChange`, `t` props.
- **User Input:** Form control change → `handleChange()` in `app/settings/page.tsx:78-84` → updates local state + validation.
- **Save Action:** `handleSave()` in `app/settings/page.tsx:104-146` → validates → batches Tauri calls → shows progress.
- **Import/Export:** `handleExport()` (line 159-175) and `handleImport()` (line 177-213) manage JSON config files.

## 4. Design Rationale

- **Separation of Concerns:** Each settings category is an isolated component.
- **Optimistic UI:** Local state updates before backend sync.
- **Keyboard Shortcuts:** `use-settings-shortcuts.ts` enables Ctrl+S save, ESC discard.
- **Import/Export:** JSON-based settings backup with version field.
