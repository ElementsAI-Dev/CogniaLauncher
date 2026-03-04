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
  Trash2,
  RefreshCw,
  Settings,
  FileText,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function QuickActions({
  onRefreshAll,
  isRefreshing = false,
  className,
}: QuickActionsProps) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.quickActions.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboard.quickActions.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/environments")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("dashboard.quickActions.addEnvironment")}
            </span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/packages")}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("dashboard.quickActions.installPackage")}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">
              {t("dashboard.quickActions.refreshAll")}
            </span>
          </Button>

          {/* Secondary Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">
                  {t("dashboard.quickActions.moreActions")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/cache")} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {t("dashboard.quickActions.clearCache")}
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
