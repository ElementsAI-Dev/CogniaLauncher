"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogPanel } from "./log-panel";
import { useLogStore } from "@/lib/stores/log";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import { buildLogsWorkspaceHref } from "@/lib/log-workspace";
import { ArrowUpRight, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

interface LogDrawerProps {
  side?: "right" | "bottom";
}

export function LogDrawer({ side = "right" }: LogDrawerProps) {
  const router = useRouter();
  const { t } = useLocale();
  const {
    drawerOpen,
    closeDrawer,
    getLogStats,
    filter,
    showBookmarksOnly,
  } = useLogStore();
  const stats = getLogStats();
  const workspaceHref = useMemo(
    () =>
      buildLogsWorkspaceHref({
        tab: "realtime",
        search: filter.search,
        levels: filter.levels,
        showBookmarksOnly,
      }),
    [filter.levels, filter.search, showBookmarksOnly],
  );
  const handleOpenWorkspace = useCallback(() => {
    closeDrawer();
    router.push(workspaceHref);
  }, [closeDrawer, router, workspaceHref]);

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
          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleOpenWorkspace}
            >
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
              {t("logs.openWorkspace")}
            </Button>
          </div>
        </SheetHeader>

        <section className="min-h-0 flex-1 p-4" aria-label={t("logs.title")}>
          <LogPanel className="h-full" maxHeight="100%" />
        </section>
      </SheetContent>
    </Sheet>
  );
}
