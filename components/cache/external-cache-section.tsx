"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/components/providers/locale-provider";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Package,
  Trash2,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { isTauri } from "@/lib/tauri";
import type { ExternalCacheInfo } from "@/lib/tauri";
import * as tauri from "@/lib/tauri";
import { formatBytes } from "@/lib/utils";

interface ExternalCacheSectionProps {
  useTrash: boolean;
  setUseTrash: (value: boolean) => void;
}

export function ExternalCacheSection({
  useTrash,
  setUseTrash,
}: ExternalCacheSectionProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [cleaningAll, setCleaningAll] = useState(false);
  const [externalCaches, setExternalCaches] = useState<ExternalCacheInfo[]>([]);

  const fetchExternalCaches = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const caches = await tauri.discoverExternalCaches();
      setExternalCaches(caches);
    } catch (err) {
      console.error("Failed to discover external caches:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && externalCaches.length === 0) {
      fetchExternalCaches();
    }
  }, [isOpen, externalCaches.length, fetchExternalCaches]);

  const handleCleanCache = async (provider: string) => {
    if (!isTauri()) return;
    setCleaning(provider);
    try {
      const result = await tauri.cleanExternalCache(provider, useTrash);
      if (result.success) {
        toast.success(
          t("cache.externalCleanSuccess", {
            provider: result.displayName,
            size: result.freedHuman,
          }),
        );
      } else {
        toast.error(
          t("cache.externalCleanFailed", {
            provider: result.displayName,
            error: result.error ?? "Unknown error",
          }),
        );
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`${t("cache.externalCleanFailed")}: ${err}`);
    } finally {
      setCleaning(null);
    }
  };

  const handleCleanAll = async () => {
    if (!isTauri()) return;
    setCleaningAll(true);
    try {
      const results = await tauri.cleanAllExternalCaches(useTrash);
      const successCount = results.filter((r) => r.success).length;
      const totalFreed = results.reduce((acc, r) => acc + r.freedBytes, 0);
      const freedHuman = formatBytes(totalFreed);

      if (successCount === results.length) {
        toast.success(
          t("cache.externalCleanAllSuccess", {
            count: successCount,
            size: freedHuman,
          }),
        );
      } else {
        toast.warning(
          t("cache.externalCleanAllPartial", {
            success: successCount,
            total: results.length,
          }),
        );
      }
      await fetchExternalCaches();
    } catch (err) {
      toast.error(`${t("cache.externalCleanAllFailed")}: ${err}`);
    } finally {
      setCleaningAll(false);
    }
  };

  const totalExternalSize = externalCaches.reduce((acc, c) => acc + c.size, 0);
  const canCleanCount = externalCaches.filter((c) => c.canClean).length;

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "npm":
      case "pnpm":
      case "yarn":
        return "📦";
      case "pip":
      case "uv":
        return "🐍";
      case "cargo":
        return "🦀";
      case "go":
        return "🐹";
      case "bundler":
        return "💎";
      case "brew":
        return "🍺";
      case "dotnet":
        return "🔷";
      case "composer":
        return "🎼";
      case "poetry":
        return "📜";
      case "conda":
        return "🐍";
      case "deno":
        return "🦕";
      case "bun":
        return "🥟";
      case "gradle":
        return "🐘";
      case "maven":
        return "☕";
      case "gem":
        return "💎";
      case "rustup":
        return "🦀";
      case "scoop":
        return "🥄";
      case "chocolatey":
        return "🍫";
      case "windows_temp":
        return "🗑️";
      case "windows_thumbnail":
        return "🖼️";
      case "macos_cache":
        return "🍎";
      case "macos_logs":
        return "📋";
      case "linux_cache":
        return "🐧";
      case "docker":
        return "🐳";
      case "podman":
        return "🦭";
      case "flutter":
        return "💙";
      case "cocoapods":
        return "🫛";
      case "cypress":
        return "🌲";
      case "electron":
        return "⚡";
      case "vcpkg":
        return "📐";
      case "sbt":
        return "⚙️";
      default:
        return "📁";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "system":
        return t("cache.categorySystem");
      case "devtools":
        return t("cache.categoryDevtools");
      case "package_manager":
        return t("cache.categoryPackageManager");
      default:
        return category;
    }
  };

  const groupedCaches = externalCaches.reduce<Record<string, ExternalCacheInfo[]>>(
    (acc, cache) => {
      const cat = cache.category || "package_manager";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cache);
      return acc;
    },
    {},
  );

  const categoryOrder = ["system", "package_manager", "devtools"];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle className="text-base">
                  {t("cache.externalCaches")}
                </CardTitle>
                {externalCaches.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {formatBytes(totalExternalSize)}
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </CollapsibleTrigger>
          <CardDescription>{t("cache.externalCachesDesc")}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="external-trash"
                    checked={useTrash}
                    onCheckedChange={setUseTrash}
                  />
                  <Label htmlFor="external-trash" className="text-sm">
                    {t("cache.moveToTrash")}
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchExternalCaches}
                      disabled={loading}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                      />
                      {t("common.refresh")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.refresh")}</TooltipContent>
                </Tooltip>
                {canCleanCount > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={cleaningAll || canCleanCount === 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {cleaningAll
                          ? t("cache.clearing")
                          : t("cache.cleanAll")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("cache.externalCleanAllTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("cache.externalCleanAllDesc", {
                            count: canCleanCount,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t("common.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCleanAll}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("cache.cleanAll")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Cache list grouped by category */}
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : externalCaches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("cache.noExternalCaches")}
              </p>
            ) : (
              <div className="space-y-4">
                {categoryOrder
                  .filter((cat) => groupedCaches[cat]?.length > 0)
                  .map((cat) => (
                    <div key={cat} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground px-1">
                        {getCategoryLabel(cat)}
                      </h4>
                      {groupedCaches[cat].map((cache) => (
                        <div
                          key={cache.provider}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xl">
                              {getProviderIcon(cache.provider)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {cache.displayName}
                                </p>
                                {cache.isAvailable ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FolderOpen className="h-3 w-3" />
                                <span className="truncate">
                                  {cache.cachePath || t("cache.managedByTool")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <Badge
                              variant={cache.size > 0 ? "default" : "secondary"}
                            >
                              {cache.sizeHuman}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !cache.canClean ||
                                    cleaning === cache.provider
                                  }
                                  onClick={() =>
                                    handleCleanCache(cache.provider)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  {cleaning === cache.provider
                                    ? t("cache.clearing")
                                    : t("cache.clean")}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("cache.clean")}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
