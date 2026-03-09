"use client";

import { useEffect, useState } from "react";
import { CacheProviderIcon } from "@/components/provider-management/provider-icon";
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { formatBytes } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/constants/cache";
import type { ExternalCacheSectionProps } from "@/types/cache";
import { useExternalCache } from "@/hooks/use-external-cache";

export function ExternalCacheSection({
  useTrash,
  setUseTrash,
}: ExternalCacheSectionProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const {
    caches: externalCaches,
    loading,
    cleaning,
    cleanableCount,
    totalSize,
    grouped,
    orderedCategories,
    fetchExternalCaches,
    handleCleanSingle,
    handleCleanAll,
  } = useExternalCache({
    t,
    includePathInfos: false,
    autoFetch: false,
    useTrash,
    setUseTrash,
  });

  useEffect(() => {
    if (isOpen && externalCaches.length === 0) {
      void fetchExternalCaches();
    }
  }, [isOpen, externalCaches.length, fetchExternalCaches]);
  const cleaningAll = cleaning === "all";

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer" data-testid="external-cache-trigger">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <CardTitle className="text-base">
                  {t("cache.externalCaches")}
                </CardTitle>
                {externalCaches.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {formatBytes(totalSize)}
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
                {cleanableCount > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={cleaningAll || cleanableCount === 0}
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
                            count: cleanableCount,
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
            {loading && externalCaches.length === 0 ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : externalCaches.length === 0 ? (
              <Empty className="border-none py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Package />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {t("cache.noExternalCaches")}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-4">
                {orderedCategories.map((cat) => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground px-1">
                      {getCategoryLabel(cat, t)}
                    </h4>
                    {grouped[cat].map((cache) => (
                      <div
                        key={cache.provider}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <CacheProviderIcon
                            provider={cache.provider}
                            size={24}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{cache.displayName}</p>
                              {cache.probePending ? (
                                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : cache.isAvailable ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FolderOpen className="h-3 w-3" />
                              <span className="truncate">
                                {cache.probePending
                                  ? t("common.loading")
                                  : cache.cachePath || t("cache.managedByTool")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <Badge
                            variant={cache.size > 0 ? "default" : "secondary"}
                          >
                            {cache.probePending ? t("common.loading") : cache.sizeHuman}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  cache.probePending || !cache.canClean || cleaning === cache.provider
                                }
                                onClick={() =>
                                  handleCleanSingle(cache.provider)
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
