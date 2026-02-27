'use client';

import { useEffect, useState, useCallback } from "react";
import type { AppSettings } from "@/lib/stores/settings";
import type { TrayClickBehavior } from "@/lib/tauri";
import {
  isTauri,
  trayIsAutostartEnabled,
  trayEnableAutostart,
  trayDisableAutostart,
  traySetClickBehavior,
  traySetMinimizeToTray,
  traySetStartMinimized,
} from "@/lib/tauri";

export interface UseTrayAutostartOptions {
  appSettings: AppSettings;
  onValueChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
}

export interface UseTrayAutostartReturn {
  autostartEnabled: boolean;
  autostartLoading: boolean;
  handleMinimizeToTrayChange: (checked: boolean) => Promise<void>;
  handleStartMinimizedChange: (checked: boolean) => Promise<void>;
  handleAutostartChange: (checked: boolean) => Promise<void>;
  handleClickBehaviorChange: (value: string) => Promise<void>;
}

/**
 * Hook for tray autostart and behavior settings
 * Extracted from components/settings/tray-settings.tsx
 */
export function useTrayAutostart({
  onValueChange,
}: UseTrayAutostartOptions): UseTrayAutostartReturn {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);

  // Sync autostart state from backend on mount
  useEffect(() => {
    if (!isTauri()) return;

    trayIsAutostartEnabled().then(setAutostartEnabled).catch(console.error);
  }, []);

  const handleMinimizeToTrayChange = useCallback(
    async (checked: boolean) => {
      onValueChange("minimizeToTray", checked);
      if (isTauri()) {
        traySetMinimizeToTray(checked).catch(console.error);
      }
    },
    [onValueChange],
  );

  const handleStartMinimizedChange = useCallback(
    async (checked: boolean) => {
      onValueChange("startMinimized", checked);
      if (isTauri()) {
        traySetStartMinimized(checked).catch(console.error);
      }
    },
    [onValueChange],
  );

  const handleAutostartChange = useCallback(
    async (checked: boolean) => {
      if (!isTauri()) return;

      setAutostartLoading(true);
      try {
        if (checked) {
          await trayEnableAutostart();
        } else {
          await trayDisableAutostart();
        }
        setAutostartEnabled(checked);
        onValueChange("autostart", checked);
      } catch (error) {
        console.error("Failed to toggle autostart:", error);
      } finally {
        setAutostartLoading(false);
      }
    },
    [onValueChange],
  );

  const handleClickBehaviorChange = useCallback(
    async (value: string) => {
      if (!isTauri()) return;

      try {
        await traySetClickBehavior(value as TrayClickBehavior);
        onValueChange("trayClickBehavior", value as TrayClickBehavior);
      } catch (error) {
        console.error("Failed to set click behavior:", error);
      }
    },
    [onValueChange],
  );

  return {
    autostartEnabled,
    autostartLoading,
    handleMinimizeToTrayChange,
    handleStartMinimizedChange,
    handleAutostartChange,
    handleClickBehaviorChange,
  };
}
