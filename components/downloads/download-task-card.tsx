"use client";

import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ArrowDownToLine,
  Pause,
  Play,
  X,
  Trash2,
  FolderOpen,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEta } from "@/lib/utils";
import { useDownloadStore, type DownloadTask } from "@/lib/stores/download";

interface DownloadTaskCardProps {
  task: DownloadTask;
  selected: boolean;
  showCheckbox: boolean;
  onSelectedChange: (selected: boolean) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onRetry: (taskId: string) => void;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onDetail: (task: DownloadTask) => void;
  t: (key: string) => string;
}

const STATE_STYLES: Record<
  DownloadTask["state"],
  { icon: React.ElementType; iconColor: string; cardBg: string; borderColor: string }
> = {
  downloading: {
    icon: ArrowDownToLine,
    iconColor: "bg-blue-500 text-white",
    cardBg: "",
    borderColor: "border-blue-200 dark:border-blue-900",
  },
  paused: {
    icon: Pause,
    iconColor: "bg-amber-500 text-white",
    cardBg: "",
    borderColor: "border-amber-200 dark:border-amber-900",
  },
  queued: {
    icon: Clock,
    iconColor: "bg-muted text-muted-foreground",
    cardBg: "",
    borderColor: "",
  },
  completed: {
    icon: CheckCircle2,
    iconColor: "bg-green-500 text-white",
    cardBg: "bg-green-50/50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-900",
  },
  failed: {
    icon: AlertCircle,
    iconColor: "bg-red-500 text-white",
    cardBg: "bg-red-50/50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-900",
  },
  cancelled: {
    icon: X,
    iconColor: "bg-muted text-muted-foreground",
    cardBg: "",
    borderColor: "",
  },
  extracting: {
    icon: Loader2,
    iconColor: "bg-violet-500 text-white",
    cardBg: "",
    borderColor: "border-violet-200 dark:border-violet-900",
  },
};

export const DownloadTaskCard = memo(function DownloadTaskCard({
  task,
  selected,
  showCheckbox,
  onSelectedChange,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onRetry,
  onOpen,
  onReveal,
  onDetail,
  t,
}: DownloadTaskCardProps) {
  const liveProgress = useDownloadStore((s) => s.progressMap[task.id]);
  const progress = liveProgress ?? task.progress;
  const canRetry = task.state === "failed" && task.recoverable !== false;

  const style = STATE_STYLES[task.state] ?? STATE_STYLES.queued;
  const Icon = style.icon;
  const isPaused = task.state === "paused";
  const isActive = task.state === "downloading" || task.state === "extracting";
  const isTerminal = task.state === "completed" || task.state === "cancelled" || task.state === "failed";

  const handleCardClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest('[role="checkbox"]')) return;
      onDetail(task);
    },
    [onDetail, task]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardClick(e);
      }
    },
    [handleCardClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
        "hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        style.cardBg,
        style.borderColor,
        isPaused && "opacity-75",
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "flex-shrink-0 self-center transition-opacity",
          showCheckbox || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
          aria-label={`Select ${task.name}`}
        />
      </div>

      {/* State Icon */}
      <div
        className={cn(
          "flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-md",
          style.iconColor,
        )}
      >
        <Icon className={cn("h-4 w-4", task.state === "extracting" && "animate-spin")} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={task.name}>
              {task.name}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              {task.provider && (
                <>
                  <span>{task.provider}</span>
                  <span>·</span>
                </>
              )}
              {/* State-specific meta line */}
              {isActive && (
                <>
                  <span>{progress.downloadedHuman}</span>
                  {progress.totalHuman && (
                    <>
                      <span>/</span>
                      <span>{progress.totalHuman}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{progress.speedHuman || "0 B/s"}</span>
                  {progress.etaHuman && (
                    <>
                      <span>·</span>
                      <span>ETA {formatEta(progress.etaHuman)}</span>
                    </>
                  )}
                </>
              )}
              {isPaused && (
                <>
                  <span>{progress.downloadedHuman}</span>
                  {progress.totalHuman && (
                    <>
                      <span>/</span>
                      <span>{progress.totalHuman}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{t("downloads.state.paused")}</span>
                </>
              )}
              {task.state === "queued" && (
                <span>{progress.totalHuman ?? t("downloads.state.queued")}</span>
              )}
              {task.state === "completed" && (
                <>
                  <span>{progress.totalHuman ?? progress.downloadedHuman}</span>
                  {task.completedAt && (
                    <>
                      <span>·</span>
                      <span>{new Date(task.completedAt).toLocaleString()}</span>
                    </>
                  )}
                </>
              )}
              {task.state === "cancelled" && (
                <span>{t("downloads.state.cancelled")}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {task.state === "downloading" && (
              <ActionButton
                icon={Pause}
                label={t("downloads.actions.pause")}
                onClick={() => onPause(task.id)}
              />
            )}
            {(isPaused || task.state === "queued") && (
              <ActionButton
                icon={Play}
                label={t("downloads.actions.resume")}
                onClick={() => onResume(task.id)}
              />
            )}
            {canRetry && (
              <ActionButton
                icon={RotateCcw}
                label={t("downloads.actions.retry")}
                onClick={() => onRetry(task.id)}
                variant="destructive"
              />
            )}
            {!isTerminal && (
              <ActionButton
                icon={X}
                label={t("downloads.actions.cancel")}
                onClick={() => onCancel(task.id)}
              />
            )}
            {task.state === "completed" && (
              <>
                <ActionButton
                  icon={FolderOpen}
                  label={t("downloads.actions.reveal")}
                  onClick={() => onReveal(task.destination)}
                />
                <ActionButton
                  icon={ExternalLink}
                  label={t("downloads.actions.open")}
                  onClick={() => onOpen(task.destination)}
                />
              </>
            )}
            {isTerminal && (
              <ActionButton
                icon={Trash2}
                label={t("downloads.actions.remove")}
                onClick={() => onRemove(task.id)}
              />
            )}
          </div>
        </div>

        {/* Error message for failed downloads */}
        {task.state === "failed" && task.error && (
          <p className="text-xs text-destructive mt-1 truncate" title={task.error}>
            {task.error}
          </p>
        )}

        {/* Progress bar for active/paused/extracting states */}
        {(isActive || isPaused) && (
          <div className="mt-2 flex items-center gap-2">
            <Progress
              value={progress.percent}
              className={cn("h-1.5 flex-1", isPaused && "opacity-50")}
            />
            <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
              {progress.percent.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            variant === "destructive" && "text-destructive hover:text-destructive",
          )}
          onClick={onClick}
          aria-label={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
