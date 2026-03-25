"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  getDesktopAction,
  type DesktopActionId,
} from "@/lib/desktop-actions";
import { cn } from "@/lib/utils";
import type { TrayMenuItemId } from "@/lib/tauri";
import { useTrayMenu } from "@/hooks/use-tray-menu";

/** Human-readable labels for each menu item ID */
function getMenuItemLabel(id: TrayMenuItemId, t: (key: string) => string): string {
  const labelMap: Partial<Record<TrayMenuItemId, string>> = {
    show_hide: t("settings.trayMenu.showHide"),
    quick_nav: t("settings.trayMenu.quickNav"),
    downloads: t("settings.trayMenu.downloads"),
    settings: t("settings.trayMenu.settings"),
    check_updates: t("settings.trayMenu.checkUpdates"),
    toggle_notifications: t("settings.trayMenu.toggleNotifications"),
    open_logs: t("settings.trayMenu.openLogs"),
    always_on_top: t("settings.trayMenu.alwaysOnTop"),
    autostart: t("settings.trayMenu.autostart"),
    quit: t("settings.trayMenu.quit"),
  };

  const explicitLabel = labelMap[id];
  if (explicitLabel) {
    return explicitLabel;
  }

  try {
    return t(getDesktopAction(id as DesktopActionId).titleKey);
  } catch {
    return id;
  }
}

interface TrayMenuCustomizerProps {
  t: (key: string) => string;
}

interface SortableMenuItemProps {
  id: TrayMenuItemId;
  isPriority: boolean;
  canDrag: boolean;
  canTogglePriority: boolean;
  label: string;
  t: (key: string) => string;
  onPriorityToggle: (id: TrayMenuItemId, checked: boolean) => void;
  onToggleEnabled: (id: TrayMenuItemId, checked: boolean) => void;
}

export function SortableMenuItem({
  id,
  isPriority,
  canDrag,
  canTogglePriority,
  label,
  t,
  onPriorityToggle,
  onToggleEnabled,
}: SortableMenuItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isQuit = id === "quit";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-muted/50",
        isDragging && "rounded-sm bg-muted",
      )}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center",
          canDrag ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-default",
        )}
        disabled={!canDrag}
        aria-label={t("settings.trayMenu.dragHint")}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
      >
        <GripVertical
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground",
            !canDrag && "invisible",
          )}
        />
      </button>
      <span className="flex-1">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onPriorityToggle(id, !isPriority)}
        disabled={!canTogglePriority || isQuit}
        className={cn("size-6", isPriority && "text-amber-500")}
        aria-label={t("settings.trayMenu.priority")}
        title={t("settings.trayMenu.priority")}
      >
        <Star className={cn("h-3.5 w-3.5", isPriority && "fill-current")} />
      </Button>
      <Switch
        checked
        onCheckedChange={(checked) => onToggleEnabled(id, checked)}
        disabled={isQuit}
        className="scale-75"
      />
    </div>
  );
}

interface DisabledMenuItemProps {
  id: TrayMenuItemId;
  label: string;
  t: (key: string) => string;
  onToggleEnabled: (id: TrayMenuItemId, checked: boolean) => void;
}

export function DisabledMenuItem({ id, label, t, onToggleEnabled }: DisabledMenuItemProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <GripVertical className="h-3.5 w-3.5 shrink-0 invisible" />
      </span>
      <span className="flex-1">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="size-6"
        aria-label={t("settings.trayMenu.priority")}
      >
        <Star className="h-3.5 w-3.5" />
      </Button>
      <Switch
        checked={false}
        onCheckedChange={(checked) => onToggleEnabled(id, checked)}
        className="scale-75"
      />
    </div>
  );
}

interface StaticEnabledMenuItemProps {
  id: TrayMenuItemId;
  label: string;
  t: (key: string) => string;
  onToggleEnabled: (id: TrayMenuItemId, checked: boolean) => void;
}

export function StaticEnabledMenuItem({
  id,
  label,
  t,
  onToggleEnabled,
}: StaticEnabledMenuItemProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-muted/50">
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground invisible" />
      </span>
      <span className="flex-1">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="size-6"
        aria-label={t("settings.trayMenu.priority")}
      >
        <Star className="h-3.5 w-3.5" />
      </Button>
      <Switch
        checked
        onCheckedChange={(checked) => onToggleEnabled(id, checked)}
        disabled
        className="scale-75"
      />
    </div>
  );
}

export function TrayMenuCustomizer({ t }: TrayMenuCustomizerProps) {
  const {
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
  } = useTrayMenu();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handlePriorityDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    handlePriorityReorder(
      String(active.id) as TrayMenuItemId,
      String(over.id) as TrayMenuItemId,
    );
  };

  const handleNormalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    handleNormalReorder(
      String(active.id) as TrayMenuItemId,
      String(over.id) as TrayMenuItemId,
    );
  };

  if (loading) {
    return (
      <div className="px-1 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-1 py-3">
      <div className="flex items-center justify-between">
        <div id="tray-menu-customize">
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

      <div className="flex flex-col gap-2 rounded-md border p-1">
        <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
          {t("settings.trayMenuSections.priority")}
        </div>
        {priorityEnabledItems.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePriorityDragEnd}
          >
            <SortableContext
              items={priorityEnabledItems}
              strategy={verticalListSortingStrategy}
            >
              {priorityEnabledItems.map((id) => (
                <SortableMenuItem
                  key={id}
                  id={id}
                  isPriority
                  canDrag
                  canTogglePriority
                  label={getMenuItemLabel(id, t)}
                  t={t}
                  onPriorityToggle={handlePriorityToggle}
                  onToggleEnabled={handleToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("settings.trayMenuSections.priorityEmpty")}
          </p>
        )}

        <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
          {t("settings.trayMenuSections.enabled")}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleNormalDragEnd}
        >
          <SortableContext
            items={normalEnabledItems}
            strategy={verticalListSortingStrategy}
          >
            {normalEnabledItems.map((id) => (
              <SortableMenuItem
                key={id}
                id={id}
                isPriority={false}
                canDrag
                canTogglePriority
                label={getMenuItemLabel(id, t)}
                t={t}
                onPriorityToggle={handlePriorityToggle}
                onToggleEnabled={handleToggle}
              />
            ))}
          </SortableContext>
        </DndContext>
        {requiredEnabledItems.map((id) => (
          <StaticEnabledMenuItem
            key={id}
            id={id}
            label={getMenuItemLabel(id, t)}
            t={t}
            onToggleEnabled={handleToggle}
          />
        ))}

        <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
          {t("settings.trayMenuSections.disabled")}
        </div>
        {disabledItems.length > 0 ? (
          disabledItems.map((id) => (
            <DisabledMenuItem
              key={id}
              id={id}
              label={getMenuItemLabel(id, t)}
              t={t}
              onToggleEnabled={handleToggle}
            />
          ))
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("settings.trayMenuSections.disabledEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}
