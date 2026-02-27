"use client";

import { GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TrayMenuItemId } from "@/lib/tauri";
import { useTrayMenu } from "@/hooks/use-tray-menu";

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
  const {
    allItems,
    enabledItems,
    loading,
    dragIndex,
    handleToggle,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleReset,
  } = useTrayMenu();

  if (loading) {
    return (
      <div className="px-1 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return (
    <div className="px-1 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">{t("settings.trayMenuCustomize")}</Label>
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
