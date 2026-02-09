"use client";

import { ReactNode, useEffect, useState } from "react";

interface DeferredProvidersProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Defers rendering of children until after the first paint.
 * This prevents heavy providers (LogProvider, TrayProvider) and their hooks
 * from blocking the initial render and causing the app to freeze on startup.
 *
 * Uses requestIdleCallback (with setTimeout fallback) to schedule mounting
 * during browser idle time, ensuring the splash screen renders first.
 */
export function DeferredProviders({ children, fallback = null }: DeferredProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback to defer until browser is idle,
    // with setTimeout fallback for environments without it
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setMounted(true), { timeout: 200 });
      return () => window.cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => setMounted(true), 16);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!mounted) return <>{fallback}</>;

  return <>{children}</>;
}
