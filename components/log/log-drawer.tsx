"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { LogPanel } from "./log-panel";
import { useLogStore } from "@/lib/stores/log";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import { ScrollText } from "lucide-react";

interface LogDrawerProps {
  side?: "right" | "bottom";
}

export function LogDrawer({ side = "right" }: LogDrawerProps) {
  const { t } = useLocale();
  const { drawerOpen, closeDrawer, getLogStats } = useLogStore();
  const stats = getLogStats();

  return (
    <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side={side}
        className={cn(
          "flex min-h-0 flex-col gap-0 overflow-hidden p-0",
          side === "bottom"
            ? "h-[60vh]"
            : "w-125 sm:w-150 sm:max-w-none",
        )}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            <span>{t("logs.title")}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {stats.total} {t("logs.entries")}
            </Badge>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("logs.description")}
          </SheetDescription>
        </SheetHeader>

        <section className="min-h-0 flex-1 p-4" aria-label={t("logs.title")}>
          <LogPanel className="h-full" maxHeight="100%" />
        </section>
      </SheetContent>
    </Sheet>
  );
}
