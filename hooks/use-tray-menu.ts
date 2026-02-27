'use client';

import { useEffect, useState, useCallback } from "react";
import {
  isTauri,
  trayGetMenuConfig,
  traySetMenuConfig,
  trayGetAvailableMenuItems,
  trayResetMenuConfig,
  type TrayMenuItemId,
  type TrayMenuConfig,
} from "@/lib/tauri";

export interface UseTrayMenuReturn {
  allItems: TrayMenuItemId[];
  enabledItems: TrayMenuItemId[];
  loading: boolean;
  dragIndex: number | null;
  handleToggle: (id: TrayMenuItemId, checked: boolean) => void;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, targetIndex: number) => void;
  handleDragEnd: () => void;
  handleReset: () => Promise<void>;
}

/**
 * Hook for tray menu configuration and drag-drop reordering
 * Extracted from components/settings/tray-menu-customizer.tsx
 */
export function useTrayMenu(): UseTrayMenuReturn {
  const [allItems, setAllItems] = useState<TrayMenuItemId[]>([]);
  const [enabledItems, setEnabledItems] = useState<TrayMenuItemId[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Load config on mount
  useEffect(() => {
    if (!isTauri()) return;

    Promise.all([trayGetAvailableMenuItems(), trayGetMenuConfig()])
      .then(([available, config]) => {
        setAllItems(available);
        setEnabledItems(config.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = useCallback(
    async (items: TrayMenuItemId[]) => {
      if (!isTauri()) return;
      const config: TrayMenuConfig = { items };
      try {
        await traySetMenuConfig(config);
      } catch (error) {
        console.error("Failed to save tray menu config:", error);
      }
    },
    [],
  );

  const handleToggle = useCallback(
    (id: TrayMenuItemId, checked: boolean) => {
      setEnabledItems((prev) => {
        let next: TrayMenuItemId[];
        if (checked) {
          // Add at the end
          next = [...prev, id];
        } else {
          // Remove (don't allow removing Quit)
          if (id === "quit") return prev;
          next = prev.filter((item) => item !== id);
        }
        saveConfig(next);
        return next;
      });
    },
    [saveConfig],
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === targetIndex) return;

      setEnabledItems((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(targetIndex, 0, moved);
        setDragIndex(targetIndex);
        return next;
      });
    },
    [dragIndex],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    // Save current order
    saveConfig(enabledItems);
  }, [enabledItems, saveConfig]);

  const handleReset = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await trayResetMenuConfig();
      const config = await trayGetMenuConfig();
      setEnabledItems(config.items);
    } catch (error) {
      console.error("Failed to reset menu config:", error);
    }
  }, []);

  return {
    allItems,
    enabledItems,
    loading,
    dragIndex,
    handleToggle,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleReset,
  };
}
