"use client";

import { useEffect, useState, useCallback } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  isTauri,
  trayGetMenuConfig,
  traySetMenuConfig,
  trayGetAvailableMenuItems,
  trayResetMenuConfig,
  type TrayMenuItemId,
  type TrayMenuConfig,
} from "@/lib/tauri";

/** Human-readable labels for each menu item ID */
function getMenuItemLabel(id: TrayMenuItemId, t: (key: string) => string): string {
  const labelMap: Record<TrayMenuItemId, string> = {
    show_hide: t("settings.trayMenu.showHide"),
    quick_nav: t("settings.trayMenu.quickNav"),
    downloads: t("settings.trayMenu.downloads"),
    settings: t("settings.trayMenu.settings"),
    check_updates: t("settings.trayMenu.checkUpdates"),
    open_logs: t("settings.trayMenu.openLogs"),
    always_on_top: t("settings.trayMenu.alwaysOnTop"),
    autostart: t("settings.trayMenu.autostart"),
    quit: t("settings.trayMenu.quit"),
  };
  return labelMap[id] || id;
}

interface TrayMenuCustomizerProps {
  t: (key: string) => string;
}

export function TrayMenuCustomizer({ t }: TrayMenuCustomizerProps) {
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

  if (loading) {
    return (
      <div className="px-1 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="px-1 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t("settings.trayMenuCustomize")}</p>
          <p className="text-xs text-muted-foreground">
            {t("settings.trayMenuCustomizeDesc")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {t("common.reset")}
        </Button>
      </div>

      <div className="space-y-0.5 rounded-md border">
        {allItems.map((id) => {
          const isEnabled = enabledItems.includes(id);
          const enabledIndex = enabledItems.indexOf(id);
          const isQuit = id === "quit";

          return (
            <div
              key={id}
              draggable={isEnabled && !isQuit}
              onDragStart={() => isEnabled && handleDragStart(enabledIndex)}
              onDragOver={(e) =>
                isEnabled && handleDragOver(e, enabledIndex)
              }
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm",
                "transition-colors hover:bg-muted/50",
                dragIndex !== null &&
                  enabledIndex === dragIndex &&
                  "bg-muted",
                !isEnabled && "opacity-50",
              )}
            >
              <GripVertical
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground",
                  (!isEnabled || isQuit) && "invisible",
                )}
              />
              <span className="flex-1">{getMenuItemLabel(id, t)}</span>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(id, checked)}
                disabled={isQuit}
                className="scale-75"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
