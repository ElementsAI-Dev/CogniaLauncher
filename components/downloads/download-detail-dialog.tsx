"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/components/providers/locale-provider";
import { toast } from "sonner";
import { writeClipboard } from "@/lib/clipboard";
import {
  Copy,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Archive,
  Shield,
  Loader2,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Pause,
  Download,
  Ban,
} from "lucide-react";
import type { DownloadTask, VerifyResult } from "@/types/tauri";
import { formatEta } from "@/lib/utils";
import {
  getStateBadgeVariant,
  findClosestPriority,
  normalizeDownloadFailure,
} from "@/lib/downloads";
import { PRIORITY_OPTIONS } from "@/lib/constants/downloads";
import { useDownloadStore } from "@/lib/stores/download";

interface DownloadDetailDialogProps {
  task: DownloadTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (taskId: string) => Promise<void>;
  onSetPriority?: (taskId: string, priority: number) => Promise<void>;
  onOpenFile?: (path: string) => Promise<void>;
  onRevealFile?: (path: string) => Promise<void>;
  onCalculateChecksum?: (path: string) => Promise<string>;
  onVerifyFile?: (
    path: string,
    expectedChecksum: string,
  ) => Promise<VerifyResult>;
  onExtractArchive?: (
    archivePath: string,
    destPath: string,
  ) => Promise<string[]>;
  onSetTaskSpeedLimit?: (
    taskId: string,
    bytesPerSecond: number,
  ) => Promise<void>;
}

function getStateIcon(state: DownloadTask["state"]) {
  switch (state) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "paused":
      return <Pause className="h-4 w-4 text-yellow-500" />;
    case "downloading":
      return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
    case "cancelled":
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function DownloadDetailDialog({
  task,
  open,
  onOpenChange,
  onRetry,
  onSetPriority,
  onOpenFile,
  onRevealFile,
  onCalculateChecksum,
  onVerifyFile,
  onExtractArchive,
  onSetTaskSpeedLimit,
}: DownloadDetailDialogProps) {
  const { t } = useLocale();
  const liveTask = useDownloadStore((state) =>
    task ? (state.tasks.find((item) => item.id === task.id) ?? null) : null,
  );
  const liveProgress = useDownloadStore((state) =>
    task ? state.progressMap[task.id] : undefined,
  );
  const resolvedTask = liveTask ?? task;
  const [checksumResult, setChecksumResult] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<string[] | null>(null);
  const [taskSpeedLimitInput, setTaskSpeedLimitInput] = useState("");
  const [isApplyingTaskSpeedLimit, setIsApplyingTaskSpeedLimit] =
    useState(false);

  useEffect(() => {
    if (!resolvedTask) {
      setTaskSpeedLimitInput("");
      return;
    }
    const speedLimit = resolvedTask.speedLimit ?? 0;
    setTaskSpeedLimitInput(String(speedLimit));
  }, [resolvedTask]);

  const isTerminal =
    resolvedTask?.state === "failed" ||
    resolvedTask?.state === "cancelled" ||
    resolvedTask?.state === "completed";

  const progress = liveProgress ?? resolvedTask?.progress;

  const failureInfo = resolvedTask
    ? normalizeDownloadFailure({
        state: resolvedTask.state,
        error: resolvedTask.error,
        recoverable: resolvedTask.recoverable,
      })
    : null;

  const canRetry =
    !!resolvedTask &&
    ((resolvedTask.state === "failed" && !!failureInfo?.retryable) ||
      resolvedTask.state === "cancelled");

  const handleCopyUrl = useCallback(async () => {
    if (!resolvedTask) return;
    await writeClipboard(resolvedTask.url);
    toast.success(t("downloads.detail.urlCopied"));
  }, [resolvedTask, t]);

  const handleCopyDestination = useCallback(async () => {
    if (!resolvedTask) return;
    await writeClipboard(resolvedTask.destination);
    toast.success(t("downloads.detail.urlCopied"));
  }, [resolvedTask, t]);

  const handleRetry = useCallback(async () => {
    if (!resolvedTask || !onRetry || !canRetry) return;
    try {
      await onRetry(resolvedTask.id);
      toast.success(t("downloads.toast.started"));
    } catch (err) {
      toast.error(String(err));
    }
  }, [resolvedTask, onRetry, t, canRetry]);

  const handlePriorityChange = useCallback(
    async (value: string) => {
      if (!resolvedTask || !onSetPriority) return;
      try {
        await onSetPriority(resolvedTask.id, Number(value));
        toast.success(t("downloads.actions.setPriority"));
      } catch (err) {
        toast.error(String(err));
      }
    },
    [resolvedTask, onSetPriority, t],
  );

  const handleCalculateChecksum = useCallback(async () => {
    if (!resolvedTask || !onCalculateChecksum) return;
    setIsCalculating(true);
    setChecksumResult(null);
    try {
      const checksum = await onCalculateChecksum(resolvedTask.destination);
      setChecksumResult(checksum);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsCalculating(false);
    }
  }, [resolvedTask, onCalculateChecksum]);

  const handleVerifyFile = useCallback(async () => {
    if (!resolvedTask || !onVerifyFile || !resolvedTask.expectedChecksum)
      return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const result = await onVerifyFile(
        resolvedTask.destination,
        resolvedTask.expectedChecksum,
      );
      setVerifyResult(result);
      if (result.valid) {
        toast.success(t("downloads.detail.verifySuccess"));
      } else {
        toast.error(result.error ?? t("downloads.errors.checksumMismatch"));
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsVerifying(false);
    }
  }, [resolvedTask, onVerifyFile, t]);

  const handleExtractArchive = useCallback(async () => {
    if (!resolvedTask || !onExtractArchive) return;
    setIsExtracting(true);
    setExtractedFiles(null);
    try {
      const destinationDir =
        resolvedTask.destination.replace(/[\\/][^\\/]+$/, "") ||
        resolvedTask.destination;
      const files = await onExtractArchive(
        resolvedTask.destination,
        destinationDir,
      );
      setExtractedFiles(files);
      toast.success(t("downloads.toast.extracted"));
    } catch (err) {
      toast.error(
        t("downloads.errors.extractFailed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setIsExtracting(false);
    }
  }, [resolvedTask, onExtractArchive, t]);

  const handleApplyTaskSpeedLimit = useCallback(async () => {
    if (!resolvedTask || !onSetTaskSpeedLimit) return;
    const parsed = Number(taskSpeedLimitInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setIsApplyingTaskSpeedLimit(true);
    try {
      await onSetTaskSpeedLimit(resolvedTask.id, Math.floor(parsed));
      toast.success(t("downloads.detail.taskSpeedLimitSaved"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsApplyingTaskSpeedLimit(false);
    }
  }, [resolvedTask, onSetTaskSpeedLimit, taskSpeedLimitInput, t]);

  if (!resolvedTask || !progress) return null;

  const metadataEntries = Object.entries(resolvedTask.metadata ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStateIcon(resolvedTask.state)}
            <span className="truncate">{resolvedTask.name}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant={getStateBadgeVariant(resolvedTask.state)}>
              {t(`downloads.state.${resolvedTask.state}`)}
            </Badge>
            {resolvedTask.provider && (
              <Badge variant="outline" className="font-normal">
                {resolvedTask.provider}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress */}
          {(resolvedTask.state === "downloading" ||
            resolvedTask.state === "queued" ||
            resolvedTask.state === "extracting") && (
            <div className="space-y-2">
              <Progress value={progress.percent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {progress.downloadedHuman} / {progress.totalHuman ?? "—"}
                </span>
                <span>
                  {progress.speedHuman} · {formatEta(progress.etaHuman)}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {resolvedTask.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-medium">
                {t(
                  `downloads.failureClass.${failureInfo?.failureClass ?? "network_error"}`,
                )}
              </div>
              <div className="text-xs mt-1">
                {failureInfo?.retryable
                  ? t("downloads.failureGuidance.retryable")
                  : t("downloads.failureGuidance.notRetryable")}
              </div>
              <div className="text-xs mt-2">{resolvedTask.error}</div>
            </div>
          )}

          <Separator />

          {/* Info Grid */}
          <div className="grid gap-3 text-sm">
            <InfoRow label={t("downloads.detail.url")}>
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="truncate font-mono text-xs"
                  title={resolvedTask.url}
                >
                  {resolvedTask.url}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={handleCopyUrl}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </InfoRow>

            <InfoRow label={t("downloads.detail.destination")}>
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="truncate font-mono text-xs"
                  title={resolvedTask.destination}
                >
                  {resolvedTask.destination}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={handleCopyDestination}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </InfoRow>

            <InfoRow label={t("downloads.detail.priority")}>
              <div className="flex items-center gap-2">
                <Select
                  value={findClosestPriority(resolvedTask.priority)}
                  onValueChange={handlePriorityChange}
                  disabled={!onSetPriority}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(
                          `downloads.priority${opt.label.charAt(0).toUpperCase()}${opt.label.slice(1)}`,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </InfoRow>

            <InfoRow label={t("downloads.detail.retries")}>
              {resolvedTask.retries}
            </InfoRow>

            {resolvedTask.expectedChecksum && (
              <InfoRow label={t("downloads.detail.checksum")}>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="font-mono text-xs truncate"
                    title={resolvedTask.expectedChecksum}
                  >
                    {resolvedTask.expectedChecksum}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => {
                      writeClipboard(resolvedTask.expectedChecksum!).then(
                        () => {
                          toast.success(t("downloads.detail.checksumCopied"));
                        },
                      );
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </InfoRow>
            )}

            {resolvedTask.serverFilename && (
              <InfoRow label={t("downloads.detail.serverFilename")}>
                <span className="text-xs" title={resolvedTask.serverFilename}>
                  {resolvedTask.serverFilename}
                </span>
              </InfoRow>
            )}

            <InfoRow label={t("downloads.detail.supportsResume")}>
              <Badge
                variant={resolvedTask.supportsResume ? "default" : "secondary"}
                className="text-xs"
              >
                {resolvedTask.supportsResume ? t("common.yes") : t("common.no")}
              </Badge>
            </InfoRow>

            {onSetTaskSpeedLimit && (
              <InfoRow label={t("downloads.detail.taskSpeedLimit")}>
                <div className="flex items-center gap-2">
                  <Input
                    value={taskSpeedLimitInput}
                    onChange={(event) =>
                      setTaskSpeedLimitInput(event.target.value)
                    }
                    className="h-7 w-32 text-xs"
                    inputMode="numeric"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={handleApplyTaskSpeedLimit}
                    disabled={isApplyingTaskSpeedLimit}
                  >
                    {t("common.save")}
                  </Button>
                </div>
              </InfoRow>
            )}

            <Separator />

            {/* Timestamps */}
            <InfoRow label={t("downloads.detail.timestamps")}>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  {t("common.created")}:{" "}
                  {new Date(resolvedTask.createdAt).toLocaleString()}
                </div>
                {resolvedTask.startedAt && (
                  <div>
                    {t("common.started")}:{" "}
                    {new Date(resolvedTask.startedAt).toLocaleString()}
                  </div>
                )}
                {resolvedTask.completedAt && (
                  <div>
                    {t("common.completed")}:{" "}
                    {new Date(resolvedTask.completedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </InfoRow>
          </div>

          {/* Metadata */}
          {metadataEntries.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("downloads.detail.metadata")}
                </p>
                <div className="grid gap-1 text-xs">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {key}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isTerminal &&
              resolvedTask.state !== "completed" &&
              onRetry &&
              canRetry && (
                <Button size="sm" onClick={handleRetry}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  {t("downloads.actions.retryTask")}
                </Button>
              )}

            {resolvedTask.state === "completed" && onOpenFile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenFile(resolvedTask.destination)}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                {t("downloads.actions.open")}
              </Button>
            )}

            {resolvedTask.state === "completed" && onRevealFile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRevealFile(resolvedTask.destination)}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                {t("downloads.actions.reveal")}
              </Button>
            )}

            {resolvedTask.state === "completed" && onCalculateChecksum && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCalculateChecksum}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Shield className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t("downloads.detail.calculateChecksum")}
              </Button>
            )}

            {resolvedTask.state === "completed" &&
              onVerifyFile &&
              resolvedTask.expectedChecksum && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyFile}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {t("downloads.detail.verifyFile")}
                </Button>
              )}

            {resolvedTask.state === "completed" && onExtractArchive && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExtractArchive}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t("downloads.actions.extract")}
              </Button>
            )}
          </div>

          {/* Checksum Result */}
          {checksumResult && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">SHA256</p>
              <p className="font-mono text-xs break-all select-all">
                {checksumResult}
              </p>
            </div>
          )}

          {verifyResult && (
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("downloads.detail.verifyResult")}
              </p>
              <p className="text-xs">
                {t("downloads.detail.verifyValid")}:{" "}
                <span
                  className={
                    verifyResult.valid ? "text-green-600" : "text-destructive"
                  }
                >
                  {verifyResult.valid ? t("common.yes") : t("common.no")}
                </span>
              </p>
              <p className="text-xs break-all">
                {t("downloads.detail.checksum")}:{" "}
                {verifyResult.expectedChecksum}
              </p>
              {verifyResult.actualChecksum && (
                <p className="text-xs break-all">
                  {t("downloads.detail.actualChecksum")}:{" "}
                  {verifyResult.actualChecksum}
                </p>
              )}
              {verifyResult.error && (
                <p className="text-xs text-destructive">{verifyResult.error}</p>
              )}
            </div>
          )}

          {extractedFiles && (
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("downloads.actions.extract")}
              </p>
              <p className="text-xs">
                {t("downloads.detail.extractedFiles", {
                  count: extractedFiles.length,
                })}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
