"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  Copy,
  ExternalLink,
  FolderOpen,
  RefreshCw,
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
import type { DownloadTask } from "@/types/tauri";
import { formatEta } from "@/lib/utils";

interface DownloadDetailDialogProps {
  task: DownloadTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (taskId: string) => Promise<void>;
  onSetPriority?: (taskId: string, priority: number) => Promise<void>;
  onOpenFile?: (path: string) => Promise<void>;
  onRevealFile?: (path: string) => Promise<void>;
  onCalculateChecksum?: (path: string) => Promise<string>;
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

function getStateBadgeVariant(state: DownloadTask["state"]) {
  switch (state) {
    case "completed":
      return "default" as const;
    case "failed":
    case "cancelled":
      return "destructive" as const;
    case "paused":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

const PRIORITY_OPTIONS = [
  { value: "10", label: "critical" },
  { value: "8", label: "high" },
  { value: "5", label: "normal" },
  { value: "1", label: "low" },
];

function findClosestPriority(priority: number): string {
  const sorted = PRIORITY_OPTIONS.map((o) => ({
    ...o,
    diff: Math.abs(Number(o.value) - priority),
  })).sort((a, b) => a.diff - b.diff);
  return sorted[0].value;
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
}: DownloadDetailDialogProps) {
  const { t } = useLocale();
  const [checksumResult, setChecksumResult] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const isTerminal =
    task?.state === "failed" ||
    task?.state === "cancelled" ||
    task?.state === "completed";

  const handleCopyUrl = useCallback(() => {
    if (!task) return;
    navigator.clipboard.writeText(task.url).then(() => {
      toast.success(t("downloads.detail.urlCopied"));
    });
  }, [task, t]);

  const handleCopyDestination = useCallback(() => {
    if (!task) return;
    navigator.clipboard.writeText(task.destination).then(() => {
      toast.success(t("downloads.detail.urlCopied"));
    });
  }, [task, t]);

  const handleRetry = useCallback(async () => {
    if (!task || !onRetry) return;
    try {
      await onRetry(task.id);
      toast.success(t("downloads.toast.started"));
    } catch (err) {
      toast.error(String(err));
    }
  }, [task, onRetry, t]);

  const handlePriorityChange = useCallback(
    async (value: string) => {
      if (!task || !onSetPriority) return;
      try {
        await onSetPriority(task.id, Number(value));
        toast.success(t("downloads.actions.setPriority"));
      } catch (err) {
        toast.error(String(err));
      }
    },
    [task, onSetPriority, t]
  );

  const handleCalculateChecksum = useCallback(async () => {
    if (!task || !onCalculateChecksum) return;
    setIsCalculating(true);
    setChecksumResult(null);
    try {
      const checksum = await onCalculateChecksum(task.destination);
      setChecksumResult(checksum);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsCalculating(false);
    }
  }, [task, onCalculateChecksum]);

  if (!task) return null;

  const metadataEntries = Object.entries(task.metadata ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStateIcon(task.state)}
            <span className="truncate">{task.name}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant={getStateBadgeVariant(task.state)}>
              {t(`downloads.state.${task.state}`)}
            </Badge>
            {task.provider && (
              <Badge variant="outline" className="font-normal">
                {task.provider}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress */}
          {(task.state === "downloading" || task.state === "queued") && (
            <div className="space-y-2">
              <Progress value={task.progress.percent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {task.progress.downloadedHuman} / {task.progress.totalHuman ?? "—"}
                </span>
                <span>
                  {task.progress.speedHuman} · {formatEta(task.progress.etaHuman)}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {task.error}
            </div>
          )}

          <Separator />

          {/* Info Grid */}
          <div className="grid gap-3 text-sm">
            <InfoRow label={t("downloads.detail.url")}>
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate font-mono text-xs" title={task.url}>
                  {task.url}
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
                <span className="truncate font-mono text-xs" title={task.destination}>
                  {task.destination}
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
                  value={findClosestPriority(task.priority)}
                  onValueChange={handlePriorityChange}
                  disabled={!onSetPriority}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(`downloads.priority${opt.label.charAt(0).toUpperCase()}${opt.label.slice(1)}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </InfoRow>

            <InfoRow label={t("downloads.detail.retries")}>
              {task.retries} / {task.retries + 3}
            </InfoRow>

            {task.expectedChecksum && (
              <InfoRow label={t("downloads.detail.checksum")}>
                <span className="font-mono text-xs truncate" title={task.expectedChecksum}>
                  {task.expectedChecksum}
                </span>
              </InfoRow>
            )}

            <InfoRow label={t("downloads.detail.supportsResume")}>
              <Badge variant={task.supportsResume ? "default" : "secondary"} className="text-xs">
                {task.supportsResume ? t("common.yes") : t("common.no")}
              </Badge>
            </InfoRow>

            <Separator />

            {/* Timestamps */}
            <InfoRow label={t("downloads.detail.timestamps")}>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>{t("common.created")}: {new Date(task.createdAt).toLocaleString()}</div>
                {task.startedAt && (
                  <div>{t("common.started")}: {new Date(task.startedAt).toLocaleString()}</div>
                )}
                {task.completedAt && (
                  <div>{t("common.completed")}: {new Date(task.completedAt).toLocaleString()}</div>
                )}
              </div>
            </InfoRow>
          </div>

          {/* Metadata */}
          {metadataEntries.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("downloads.detail.metadata")}</p>
                <div className="grid gap-1 text-xs">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {key}
                      </Badge>
                      <span className="text-muted-foreground truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isTerminal && task.state !== "completed" && onRetry && (
              <Button size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t("downloads.actions.retryTask")}
              </Button>
            )}

            {task.state === "completed" && onOpenFile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenFile(task.destination)}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                {t("downloads.actions.open")}
              </Button>
            )}

            {task.state === "completed" && onRevealFile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRevealFile(task.destination)}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                {t("downloads.actions.reveal")}
              </Button>
            )}

            {task.state === "completed" && onCalculateChecksum && (
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
          </div>

          {/* Checksum Result */}
          {checksumResult && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">SHA256</p>
              <p className="font-mono text-xs break-all select-all">{checksumResult}</p>
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
