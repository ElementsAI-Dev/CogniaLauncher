"use client";

import Link from "next/link";
import { useState } from "react";
import { CacheProviderIcon } from "@/components/provider-management/provider-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  CheckCircle2,
  XCircle,
  FolderOpen,
  AlertTriangle,
  AlertCircle,
  Copy,
  HardDrive,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/constants/cache";
import { deriveExternalCacheMaintenanceMetadata } from "@/lib/cache/maintenance";
import { buildExternalCacheDetailHref } from "@/lib/cache/scopes";
import type { ExternalCacheSectionProps } from "@/types/cache";
import { useExternalCache } from "@/hooks/cache/use-external-cache";
import { useScanProgress } from "@/hooks/cache/use-scan-progress";
import type { ExternalCacheCleanResult } from "@/lib/tauri";
import { writeClipboard } from "@/lib/clipboard";

export function ExternalCacheSection({
  useTrash,
  setUseTrash,
}: ExternalCacheSectionProps) {
  const { t } = useLocale();
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultRows, setResultRows] = useState<ExternalCacheCleanResult[]>([]);
  const {
    caches: externalCaches,
    loading,
    readState,
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
    autoFetch: true,
    useTrash,
    setUseTrash,
  });

  const scanProgress = useScanProgress();
  const cleaningAll = cleaning === "all";

  const diagHintKeyByReason: Record<string, string> = {
    probe_timeout: "cache.externalDiag.probe_timeout",
    probe_failed: "cache.externalDiag.probe_failed",
    path_unreadable: "cache.externalDiag.path_unreadable",
    provider_unavailable: "cache.externalDiag.provider_unavailable",
    legacy_skipped: "cache.externalDiag.legacy_skipped",
  };

  const showResults = (title: string, rows: ExternalCacheCleanResult[]) => {
    setResultTitle(title);
    setResultRows(rows);
    setResultOpen(true);
  };

  const handleCleanSingleWithReport = async (provider: string) => {
    const result = await handleCleanSingle(provider);
    if (result && !result.success) {
      showResults(t("cache.externalCleanResultTitle"), [result]);
    }
  };

  const handleCleanAllWithReport = async () => {
    const results = await handleCleanAll();
    if (results.some((r) => !r.success)) {
      showResults(t("cache.externalCleanAllResultTitle"), results);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          <span>
            {t("cache.externalCaches")}:
            {" "}
            <span className="font-medium text-foreground">{externalCaches.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="h-4 w-4" />
          <span>
            {t("cache.totalSize")}:
            {" "}
            <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
          </span>
        </div>
        {cleanableCount > 0 && (
          <Badge variant="secondary">
            {t("cache.cleanable")}: {cleanableCount}
          </Badge>
        )}
      </div>

      {/* Scan progress */}
      {scanProgress.active && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-medium">
                {scanProgress.phase === "probing"
                  ? t("cache.scanPhaseProbing")
                  : t("cache.scanPhaseSizing")}
              </span>
              {scanProgress.currentProviderDisplay && (
                <span className="text-muted-foreground">
                  — {scanProgress.currentProviderDisplay}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground tabular-nums">
                {scanProgress.completedProviders}/{scanProgress.totalProviders}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {(scanProgress.elapsedMs / 1000).toFixed(1)}s
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={scanProgress.cancelScan}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${scanProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              scanProgress.startScan();
            }}
            disabled={loading || scanProgress.active}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${(loading || scanProgress.active) ? "animate-spin" : ""}`}
            />
            {t("common.refresh")}
          </Button>
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
                    onClick={handleCleanAllWithReport}
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

      {readState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{readState.error}</span>
            <Button variant="outline" size="sm" onClick={fetchExternalCaches}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t("common.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
              {grouped[cat].map((cache) => {
                const maintenance = deriveExternalCacheMaintenanceMetadata(cache);
                return (
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
                        <Badge variant="outline" className="text-[10px]">
                          {cache.isCustom ? t("cache.detail.customScope") : t("cache.detail.externalScope")}
                        </Badge>
                        {cache.probePending ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : cache.detectionState === "found" ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : cache.detectionState === "error" ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
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
                      {!cache.probePending && (cache.detectionReason || cache.detectionError) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {cache.detectionReason && (
                            <p className="truncate" title={cache.detectionReason}>
                              {diagHintKeyByReason[cache.detectionReason]
                                ? t(diagHintKeyByReason[cache.detectionReason])
                                : cache.detectionReason}
                            </p>
                          )}
                          {cache.detectionError && (
                            <p className="truncate text-destructive" title={cache.detectionError}>
                              {cache.detectionError}
                            </p>
                          )}
                        </div>
                      )}
                      {!cache.probePending && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t(maintenance.explanationKey)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge
                      variant={cache.size > 0 ? "default" : "secondary"}
                    >
                      {cache.probePending ? t("common.loading") : cache.sizeHuman}
                    </Badge>
                    <Link
                      href={buildExternalCacheDetailHref(
                        cache.provider,
                        cache.isCustom ? "custom" : "external",
                      )}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {t("cache.viewDetails")}
                    </Link>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            cache.probePending || !cache.canClean || cleaning === cache.provider
                          }
                          onClick={() =>
                            handleCleanSingleWithReport(cache.provider)
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
              )})}
            </div>
          ))}
        </div>
      )}

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{resultTitle}</DialogTitle>
            <DialogDescription>{t("cache.externalCleanResultDesc")}</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("cache.externalProvider")}</TableHead>
                  <TableHead>{t("cache.status")}</TableHead>
                  <TableHead>{t("cache.freedSize")}</TableHead>
                  <TableHead>{t("cache.error")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultRows.map((r) => (
                  <TableRow key={r.provider}>
                    <TableCell className="font-medium">
                      <Link
                        href={buildExternalCacheDetailHref(
                          r.provider,
                          externalCaches.find((cache) => cache.provider === r.provider)?.isCustom
                            ? "custom"
                            : "external",
                        )}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.success ? "default" : "destructive"}>
                        {r.success ? t("cache.success") : t("cache.failed")}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.freedHuman}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>{t("common.close")}</Button>
            <Button
              variant="outline"
              onClick={async () => {
                await writeClipboard(JSON.stringify(resultRows, null, 2));
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              {t("cache.copyJson")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
