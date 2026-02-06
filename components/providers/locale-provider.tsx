"use client";

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  ReactNode,
} from "react";
import {
  type Locale,
  defaultLocale,
  getLocaleFromCookie,
  setLocaleCookie,
} from "@/lib/i18n";

type MessageValue = string | Record<string, string | Record<string, string>>;
type Messages = Record<string, Record<string, MessageValue>>;

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  messages: {
    en: Messages;
    zh: Messages;
  };
}

// Cookie store for useSyncExternalStore
let listeners: Array<() => void> = [];
function subscribeToCookie(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
function notifyCookieChange() {
  listeners.forEach((l) => l());
}

export function LocaleProvider({
  children,
  initialLocale,
  messages,
}: LocaleProviderProps) {
  const serverLocale = initialLocale || defaultLocale;

  // useSyncExternalStore ensures SSR matches client by using serverLocale as server snapshot
  const locale = useSyncExternalStore(
    subscribeToCookie,
    getLocaleFromCookie,
    () => serverLocale, // Server snapshot - prevents hydration mismatch
  );

  const currentMessages = messages[locale] || messages.en;

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleCookie(newLocale);
    notifyCookieChange();
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".");
      let value: unknown = currentMessages;

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }

      if (typeof value !== "string") {
        return key;
      }

      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
          return params[paramKey]?.toString() || `{${paramKey}}`;
        });
      }

      return value;
    },
    [currentMessages],
  );

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t, messages: currentMessages }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
