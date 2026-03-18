'use client';

import { useEffect, useState, useCallback } from "react";
import type { AppSettings } from "@/lib/stores/settings";
import type {
  TrayClickBehavior,
  TrayNotificationEvent,
  TrayNotificationLevel,
  TrayQuickAction,
} from "@/lib/tauri";
import {
  isTauri,
  trayIsAutostartEnabled,
  trayEnableAutostart,
  trayDisableAutostart,
  traySetClickBehavior,
  traySetQuickAction,
  trayGetAvailableQuickActions,
  traySetShowNotifications,
  traySetNotificationLevel,
  traySetNotificationEvents,
  trayGetAvailableNotificationEvents,
  listenTrayNotificationEventsChanged,
  trayGetState,
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
  quickAction: TrayQuickAction;
  availableQuickActions: TrayQuickAction[];
  handleQuickActionChange: (value: string) => Promise<void>;
  handleShowNotificationsChange: (checked: boolean) => Promise<void>;
  handleNotificationLevelChange: (value: string) => Promise<void>;
  notificationEvents: TrayNotificationEvent[];
  availableNotificationEvents: TrayNotificationEvent[];
  handleNotificationEventToggle: (
    event: TrayNotificationEvent,
    enabled: boolean,
  ) => Promise<void>;
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
  const [quickAction, setQuickAction] =
    useState<TrayQuickAction>("check_updates");
  const [availableQuickActions, setAvailableQuickActions] = useState<
    TrayQuickAction[]
  >([
    "open_settings",
    "open_downloads",
    "check_updates",
    "open_logs",
    "open_command_palette",
    "open_quick_search",
    "toggle_logs",
    "manage_plugins",
    "install_plugin",
    "create_plugin",
    "go_dashboard",
    "go_toolbox",
    "report_bug",
  ]);
  const [notificationEvents, setNotificationEvents] = useState<
    TrayNotificationEvent[]
  >(["updates", "downloads", "errors", "system"]);
  const [availableNotificationEvents, setAvailableNotificationEvents] =
    useState<TrayNotificationEvent[]>([
      "updates",
      "downloads",
      "errors",
      "system",
    ]);

  // Sync autostart state from backend on mount
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenEvents: (() => void) | undefined;

    trayIsAutostartEnabled().then(setAutostartEnabled).catch(console.error);
    Promise.all([
      trayGetState(),
      trayGetAvailableQuickActions(),
      trayGetAvailableNotificationEvents(),
    ])
      .then(([state, quickActions, notificationEventOptions]) => {
        setQuickAction(state.quickAction);
        setNotificationEvents(state.notificationEvents);
        setAvailableQuickActions(quickActions);
        setAvailableNotificationEvents(notificationEventOptions);
      })
      .catch(console.error);

    listenTrayNotificationEventsChanged((events) => {
      setNotificationEvents(events);
    })
      .then((fn) => {
        unlistenEvents = fn;
      })
      .catch(console.error);

    return () => {
      unlistenEvents?.();
    };
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

  const handleShowNotificationsChange = useCallback(
    async (checked: boolean) => {
      onValueChange("showNotifications", checked);
      if (!isTauri()) return;

      try {
        await traySetShowNotifications(checked);
      } catch (error) {
        console.error("Failed to set tray notifications visibility:", error);
      }
    },
    [onValueChange],
  );

  const handleQuickActionChange = useCallback(async (value: string) => {
    if (!isTauri()) return;

    try {
      const action = value as TrayQuickAction;
      await traySetQuickAction(action);
      setQuickAction(action);
    } catch (error) {
      console.error("Failed to set tray quick action:", error);
    }
  }, []);

  const handleNotificationLevelChange = useCallback(
    async (value: string) => {
      if (!isTauri()) return;

      try {
        await traySetNotificationLevel(value as TrayNotificationLevel);
        onValueChange("trayNotificationLevel", value as TrayNotificationLevel);
      } catch (error) {
        console.error("Failed to set tray notification level:", error);
      }
    },
    [onValueChange],
  );

  const handleNotificationEventToggle = useCallback(
    async (event: TrayNotificationEvent, enabled: boolean) => {
      if (!isTauri()) return;

      try {
        const next = enabled
          ? Array.from(new Set([...notificationEvents, event]))
          : notificationEvents.filter((item) => item !== event);
        await traySetNotificationEvents(next);
        setNotificationEvents(next);
      } catch (error) {
        console.error("Failed to set tray notification events:", error);
      }
    },
    [notificationEvents],
  );

  return {
    autostartEnabled,
    autostartLoading,
    handleMinimizeToTrayChange,
    handleStartMinimizedChange,
    handleAutostartChange,
    handleClickBehaviorChange,
    quickAction,
    availableQuickActions,
    handleQuickActionChange,
    handleShowNotificationsChange,
    handleNotificationLevelChange,
    notificationEvents,
    availableNotificationEvents,
    handleNotificationEventToggle,
  };
}
