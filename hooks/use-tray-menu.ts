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
  priorityItems: TrayMenuItemId[];
  loading: boolean;
  dragIndex: number | null;
  handleToggle: (id: TrayMenuItemId, checked: boolean) => void;
  handlePriorityToggle: (id: TrayMenuItemId, checked: boolean) => void;
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
  const [priorityItems, setPriorityItems] = useState<TrayMenuItemId[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Load config on mount
  useEffect(() => {
    if (!isTauri()) return;

    Promise.all([trayGetAvailableMenuItems(), trayGetMenuConfig()])
      .then(([available, config]) => {
        setAllItems(available);
        setEnabledItems(config.items);
        setPriorityItems(config.priorityItems ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = useCallback(
    async (items: TrayMenuItemId[], priority: TrayMenuItemId[]) => {
      if (!isTauri()) return;
      const config: TrayMenuConfig = { items, priorityItems: priority };
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
          setPriorityItems((prevPriority) => {
            const updated = prevPriority.filter((item) => item !== id);
            saveConfig(next, updated);
            return updated;
          });
          return next;
        }
        saveConfig(next, priorityItems);
        return next;
      });
    },
    [priorityItems, saveConfig],
  );

  const handlePriorityToggle = useCallback(
    (id: TrayMenuItemId, checked: boolean) => {
      if (id === "quit" || !enabledItems.includes(id)) return;

      setPriorityItems((prev) => {
        const next = checked
          ? Array.from(new Set([...prev, id]))
          : prev.filter((item) => item !== id);
        saveConfig(enabledItems, next);
        return next;
      });
    },
    [enabledItems, saveConfig],
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
    saveConfig(enabledItems, priorityItems);
  }, [enabledItems, priorityItems, saveConfig]);

  const handleReset = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await trayResetMenuConfig();
      const config = await trayGetMenuConfig();
      setEnabledItems(config.items);
      setPriorityItems(config.priorityItems ?? []);
    } catch (error) {
      console.error("Failed to reset menu config:", error);
    }
  }, []);

  return {
    allItems,
    enabledItems,
    priorityItems,
    loading,
    dragIndex,
    handleToggle,
    handlePriorityToggle,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleReset,
  };
}
