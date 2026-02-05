# Architecture of SSR-Safe Internationalization

## 1. Identity

- **What it is:** React 19 SSR-compatible internationalization system using `useSyncExternalStore`.
- **Purpose:** Provides hydration-safe locale management with cookie persistence.

## 2. Core Components

- `components/providers/locale-provider.tsx` (LocaleProvider, useLocale): i18n provider with SSR-safe locale state via `useSyncExternalStore`
- `lib/i18n.ts` (getLocaleFromCookie, setLocaleCookie): Cookie storage utilities for locale persistence
- `types/i18n.ts` (Locale, locales): Locale type definitions (en, zh)
- `components/providers/locale-provider.test.tsx`: SSR-safe locale provider tests

## 3. Execution Flow (LLM Retrieval Map)

- **Server Render:** `LocaleProvider` receives `initialLocale` prop → uses as server snapshot in `useSyncExternalStore` → prevents hydration mismatch
- **Client Hydration:** `useSyncExternalStore` subscribes to cookie changes via `subscribeToCookie()` → syncs with `getLocaleFromCookie()`
- **Locale Change:** `setLocale()` → `setLocaleCookie()` → `notifyCookieChange()` → triggers subscriber updates

## 4. Design Rationale

- **useSyncExternalStore:** React 19 recommended pattern for external state with SSR support
- **Server Snapshot:** The `initialLocale` prop ensures server and client render match exactly
- **Cookie Subscription:** External store pattern avoids internal state management issues during SSR
- **No Hydration Mismatch:** Server snapshot provides deterministic initial render on both server and client
