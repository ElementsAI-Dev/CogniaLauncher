"use client";

import { useCallback } from "react";
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
  Layers,
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

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  variant?: "default" | "secondary" | "outline";
  shortcut?: string;
}

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

  const primaryActions: QuickAction[] = [
    {
      id: "add-environment",
      label: t("dashboard.quickActions.addEnvironment"),
      icon: <Layers className="h-4 w-4" />,
      href: "/environments",
      variant: "default",
    },
    {
      id: "install-package",
      label: t("dashboard.quickActions.installPackage"),
      icon: <Package className="h-4 w-4" />,
      href: "/packages",
      variant: "secondary",
    },
    {
      id: "refresh-all",
      label: t("dashboard.quickActions.refreshAll"),
      icon: (
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      ),
      action: onRefreshAll,
      variant: "outline",
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: "clear-cache",
      label: t("dashboard.quickActions.clearCache"),
      icon: <Trash2 className="h-4 w-4" />,
      href: "/cache",
    },
    {
      id: "settings",
      label: t("dashboard.quickActions.openSettings"),
      icon: <Settings className="h-4 w-4" />,
      href: "/settings",
    },
    {
      id: "view-logs",
      label: t("dashboard.quickActions.viewLogs"),
      icon: <FileText className="h-4 w-4" />,
      href: "/logs",
    },
  ];

  const handleAction = useCallback(
    (action: QuickAction) => {
      if (action.action) {
        action.action();
      } else if (action.href) {
        router.push(action.href);
      }
    },
    [router],
  );

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t("dashboard.quickActions.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Actions */}
          {primaryActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "outline"}
              size="sm"
              onClick={() => handleAction(action)}
              disabled={action.id === "refresh-all" && isRefreshing}
              className="gap-2"
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          ))}

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
              {secondaryActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="gap-2"
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionsInlineProps {
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function QuickActionsInline({
  onRefreshAll,
  isRefreshing = false,
  className,
}: QuickActionsInlineProps) {
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
