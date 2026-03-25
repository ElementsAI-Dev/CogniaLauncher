"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  HardDrive,
  RefreshCw,
  Settings,
  FileText,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import type { DashboardPresentation } from "@/lib/stores/dashboard";

interface QuickActionsProps {
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  className?: string;
  presentation?: DashboardPresentation;
}

export function QuickActions({
  onRefreshAll,
  isRefreshing = false,
  className,
  presentation = { density: "comfortable", emphasis: "balanced" },
}: QuickActionsProps) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <Card
      className={cn(
        presentation.emphasis === "strong" && "border-primary/20 shadow-sm",
        className,
      )}
      data-density={presentation.density}
      data-emphasis={presentation.emphasis}
    >
      <CardHeader className={cn("pb-3", presentation.density === "compact" && "pb-2")}>
        <CardTitle className="text-base font-medium">
          {t("dashboard.quickActions.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.quickActions.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(presentation.density === "compact" && "pt-0")}>
        <div
          className={cn(
            "grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:gap-2.5",
            presentation.density === "compact" && "gap-1.5 xl:gap-2",
          )}
          role="group"
          aria-label={t("dashboard.quickActions.title")}
        >
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/environments")}
            className="w-full justify-start gap-2 xl:w-auto xl:justify-center"
          >
            <Plus className="h-4 w-4" />
            <span>{t("dashboard.quickActions.addEnvironment")}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/packages")}
            className="w-full justify-start gap-2 xl:w-auto xl:justify-center"
          >
            <Package className="h-4 w-4" />
            <span>{t("dashboard.quickActions.installPackage")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="w-full justify-start gap-2 xl:w-auto xl:justify-center"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span>{t("dashboard.quickActions.refreshAll")}</span>
          </Button>

          {/* Secondary Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 xl:w-auto xl:justify-center"
                aria-label={t("dashboard.quickActions.moreActions")}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>{t("dashboard.quickActions.moreActions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/cache")} className="gap-2">
                <HardDrive className="h-4 w-4" />
                {t("dashboard.quickActions.manageCache")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
                <Settings className="h-4 w-4" />
                {t("dashboard.quickActions.openSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/logs")} className="gap-2">
                <FileText className="h-4 w-4" />
                {t("dashboard.quickActions.viewLogs")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
