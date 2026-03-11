'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
  isTauri,
  trayGetMenuConfig,
  traySetMenuConfig,
  trayGetAvailableMenuItems,
  trayResetMenuConfig,
  type TrayMenuItemId,
  type TrayMenuConfig,
} from "@/lib/tauri";

const QUIT_ITEM: TrayMenuItemId = "quit";

function dedupeItems(items: TrayMenuItemId[]): TrayMenuItemId[] {
  return Array.from(new Set(items));
}

function normalizeAllItems(items: TrayMenuItemId[]): TrayMenuItemId[] {
  const normalized = dedupeItems(items);
  if (!normalized.includes(QUIT_ITEM)) {
    normalized.push(QUIT_ITEM);
  }
  return normalized;
}

function normalizePriorityItems(
  priorityItems: TrayMenuItemId[],
  enabledItems: TrayMenuItemId[],
): TrayMenuItemId[] {
  const allowed = new Set(enabledItems.filter((item) => item !== QUIT_ITEM));
  const normalized: TrayMenuItemId[] = [];

  for (const item of priorityItems) {
    if (item === QUIT_ITEM) continue;
    if (allowed.has(item) && !normalized.includes(item)) {
      normalized.push(item);
    }
  }

  return normalized;
}

function normalizeEnabledItems(
  enabledItems: TrayMenuItemId[],
  priorityItems: TrayMenuItemId[],
  allItems: TrayMenuItemId[],
): TrayMenuItemId[] {
  const allowed = new Set(allItems);
  const uniqueEnabled = dedupeItems(enabledItems).filter(
    (item) => item !== QUIT_ITEM && allowed.has(item),
  );
  const normalizedPriority = normalizePriorityItems(priorityItems, [
    ...uniqueEnabled,
    QUIT_ITEM,
  ]);
  const prioritySet = new Set(normalizedPriority);
  const normalItems = uniqueEnabled.filter((item) => !prioritySet.has(item));

  return [...normalizedPriority, ...normalItems, QUIT_ITEM];
}

function normalizeConfig(
  enabledItems: TrayMenuItemId[],
  priorityItems: TrayMenuItemId[],
  allItems: TrayMenuItemId[],
): TrayMenuConfig {
  const items = normalizeEnabledItems(enabledItems, priorityItems, allItems);
  const normalizedPriority = normalizePriorityItems(priorityItems, items);
  return {
    items,
    priorityItems: normalizedPriority,
  };
}

export interface UseTrayMenuReturn {
  allItems: TrayMenuItemId[];
  enabledItems: TrayMenuItemId[];
  priorityItems: TrayMenuItemId[];
  priorityEnabledItems: TrayMenuItemId[];
  normalEnabledItems: TrayMenuItemId[];
  requiredEnabledItems: TrayMenuItemId[];
  disabledItems: TrayMenuItemId[];
  loading: boolean;
  handleToggle: (id: TrayMenuItemId, checked: boolean) => void;
  handlePriorityToggle: (id: TrayMenuItemId, checked: boolean) => void;
  handlePriorityReorder: (
    activeId: TrayMenuItemId,
    overId: TrayMenuItemId,
  ) => void;
  handleNormalReorder: (
    activeId: TrayMenuItemId,
    overId: TrayMenuItemId,
  ) => void;
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

  // Load config on mount
  useEffect(() => {
    if (!isTauri()) return;

    Promise.all([trayGetAvailableMenuItems(), trayGetMenuConfig()])
      .then(([available, config]) => {
        const normalizedAll = normalizeAllItems(available);
        const normalizedConfig = normalizeConfig(
          config.items,
          config.priorityItems ?? [],
          normalizedAll,
        );
        setAllItems(normalizedAll);
        setEnabledItems(normalizedConfig.items);
        setPriorityItems(normalizedConfig.priorityItems);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const applyLocalConfig = useCallback(
    (items: TrayMenuItemId[], priority: TrayMenuItemId[]) => {
      const normalized = normalizeConfig(items, priority, allItems);
      setEnabledItems(normalized.items);
      setPriorityItems(normalized.priorityItems);
      return normalized;
    },
    [allItems],
  );

  const saveConfig = useCallback(async (items: TrayMenuItemId[], priority: TrayMenuItemId[]) => {
    if (!isTauri()) return;
    const normalized = normalizeConfig(items, priority, allItems);
    try {
      await traySetMenuConfig(normalized);
    } catch (error) {
      console.error("Failed to save tray menu config:", error);
    }
  }, [allItems]);

  const handleToggle = useCallback(
    (id: TrayMenuItemId, checked: boolean) => {
      if (!checked && id === QUIT_ITEM) {
        return;
      }

      const nextEnabled = checked
        ? [...enabledItems, id]
        : enabledItems.filter((item) => item !== id);
      const nextPriority = checked
        ? priorityItems
        : priorityItems.filter((item) => item !== id);
      const normalized = applyLocalConfig(nextEnabled, nextPriority);
      void saveConfig(normalized.items, normalized.priorityItems);
    },
    [enabledItems, priorityItems, applyLocalConfig, saveConfig],
  );

  const handlePriorityToggle = useCallback(
    (id: TrayMenuItemId, checked: boolean) => {
      if (id === QUIT_ITEM || !enabledItems.includes(id)) return;

      const nextPriority = checked
        ? [...priorityItems, id]
        : priorityItems.filter((item) => item !== id);
      const normalized = applyLocalConfig(enabledItems, nextPriority);
      void saveConfig(normalized.items, normalized.priorityItems);
    },
    [enabledItems, priorityItems, applyLocalConfig, saveConfig],
  );

  const priorityEnabledItems = useMemo(() => {
    return normalizePriorityItems(priorityItems, enabledItems);
  }, [priorityItems, enabledItems]);

  const normalEnabledItems = useMemo(() => {
    const prioritySet = new Set(priorityEnabledItems);
    return enabledItems.filter(
      (item) => item !== QUIT_ITEM && !prioritySet.has(item),
    );
  }, [enabledItems, priorityEnabledItems]);

  const requiredEnabledItems = useMemo(
    () => enabledItems.filter((item) => item === QUIT_ITEM),
    [enabledItems],
  );

  const disabledItems = useMemo(() => {
    return allItems.filter(
      (item) => item !== QUIT_ITEM && !enabledItems.includes(item),
    );
  }, [allItems, enabledItems]);

  const handlePriorityReorder = useCallback(
    (activeId: TrayMenuItemId, overId: TrayMenuItemId) => {
      if (activeId === overId) return;
      const oldIndex = priorityEnabledItems.indexOf(activeId);
      const newIndex = priorityEnabledItems.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const nextPriority = arrayMove(priorityEnabledItems, oldIndex, newIndex);
      const normalized = applyLocalConfig(enabledItems, nextPriority);
      void saveConfig(normalized.items, normalized.priorityItems);
    },
    [priorityEnabledItems, enabledItems, applyLocalConfig, saveConfig],
  );

  const handleNormalReorder = useCallback(
    (activeId: TrayMenuItemId, overId: TrayMenuItemId) => {
      if (activeId === overId) return;
      const oldIndex = normalEnabledItems.indexOf(activeId);
      const newIndex = normalEnabledItems.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reorderedNormal = arrayMove(normalEnabledItems, oldIndex, newIndex);
      const nextEnabled = [
        ...priorityEnabledItems,
        ...reorderedNormal,
        ...requiredEnabledItems,
      ];
      const normalized = applyLocalConfig(nextEnabled, priorityEnabledItems);
      void saveConfig(normalized.items, normalized.priorityItems);
    },
    [
      normalEnabledItems,
      priorityEnabledItems,
      requiredEnabledItems,
      applyLocalConfig,
      saveConfig,
    ],
  );

  const handleReset = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await trayResetMenuConfig();
      const [available, config] = await Promise.all([
        trayGetAvailableMenuItems(),
        trayGetMenuConfig(),
      ]);
      const normalizedAll = normalizeAllItems(available);
      const normalizedConfig = normalizeConfig(
        config.items,
        config.priorityItems ?? [],
        normalizedAll,
      );
      setAllItems(normalizedAll);
      setEnabledItems(normalizedConfig.items);
      setPriorityItems(normalizedConfig.priorityItems);
    } catch (error) {
      console.error("Failed to reset menu config:", error);
    }
  }, []);

  return {
    allItems,
    enabledItems,
    priorityItems,
    priorityEnabledItems,
    normalEnabledItems,
    requiredEnabledItems,
    disabledItems,
    loading,
    handleToggle,
    handlePriorityToggle,
    handlePriorityReorder,
    handleNormalReorder,
    handleReset,
  };
}
