"use client";

import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SIDEBAR_ITEM_LABEL_KEYS,
  type PrimarySidebarItemId,
  type SecondarySidebarItemId,
} from "@/lib/sidebar/order";

interface SidebarOrderCustomizerProps {
  t: (key: string) => string;
  primaryOrder: PrimarySidebarItemId[];
  secondaryOrder: SecondarySidebarItemId[];
  onMovePrimary: (id: PrimarySidebarItemId, direction: "up" | "down") => void;
  onMoveSecondary: (id: SecondarySidebarItemId, direction: "up" | "down") => void;
  onReset: () => void;
}

function SidebarOrderGroup<T extends PrimarySidebarItemId | SecondarySidebarItemId>({
  title,
  itemOrder,
  onMove,
  t,
}: {
  title: string;
  itemOrder: T[];
  onMove: (id: T, direction: "up" | "down") => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-col gap-1 rounded-md border">
        {itemOrder.map((itemId, index) => (
          <div
            key={itemId}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span>{t(SIDEBAR_ITEM_LABEL_KEYS[itemId])}</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMove(itemId, "up")}
                disabled={index === 0}
                aria-label={t("settings.sidebarOrderMoveUp")}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMove(itemId, "down")}
                disabled={index === itemOrder.length - 1}
                aria-label={t("settings.sidebarOrderMoveDown")}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarOrderCustomizer({
  t,
  primaryOrder,
  secondaryOrder,
  onMovePrimary,
  onMoveSecondary,
  onReset,
}: SidebarOrderCustomizerProps) {
  return (
    <Card data-hint="settings-sidebar-order">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t("settings.sidebarOrderTitle")}</CardTitle>
            <CardDescription>{t("settings.sidebarOrderDesc")}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("settings.sidebarOrderReset")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SidebarOrderGroup
          title={t("settings.sidebarOrderMainGroup")}
          itemOrder={primaryOrder}
          onMove={onMovePrimary}
          t={t}
        />
        <Separator />
        <SidebarOrderGroup
          title={t("settings.sidebarOrderSettingsGroup")}
          itemOrder={secondaryOrder}
          onMove={onMoveSecondary}
          t={t}
        />
        <p className="text-xs text-muted-foreground">{t("settings.sidebarOrderScopeHint")}</p>
      </CardContent>
    </Card>
  );
}
