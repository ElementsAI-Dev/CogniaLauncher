"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Pause,
  Play,
  X,
  Trash2,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { formatEta } from "@/lib/utils";
import { useDownloadStore } from "@/lib/stores/download";
import { getStateBadgeVariant } from "@/lib/downloads";
import type { DownloadTask } from "@/types/tauri";

interface DownloadTaskRowProps {
  task: DownloadTask;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onDetail: (task: DownloadTask) => void;
  t: (key: string) => string;
}

export const DownloadTaskRow = memo(function DownloadTaskRow({
  task,
  selected,
  onSelectedChange,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onOpen,
  onReveal,
  onDetail,
  t,
}: DownloadTaskRowProps) {
  // Use progressMap for real-time progress (avoids full tasks array re-render)
  const liveProgress = useDownloadStore((s) => s.progressMap[task.id]);
  const progress = liveProgress ?? task.progress;


  return (
    <TableRow>
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
          aria-label={`Select ${task.name}`}
        />
      </TableCell>
      <TableCell className="min-w-[220px]">
        <div className="space-y-1">
          <p
            className="font-medium truncate cursor-pointer hover:underline"
            title={task.name}
            onClick={() => onDetail(task)}
          >
            {task.name}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={task.url}>
            {task.url}
          </p>
          {task.error && (
            <p className="text-xs text-destructive">{task.error}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        {task.provider ? (
          <Badge variant="outline" className="font-normal">
            {task.provider}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={getStateBadgeVariant(task.state)}>
          {t(`downloads.state.${task.state}`)}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[200px]">
        <div className="space-y-2">
          <Progress value={progress.percent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.downloadedHuman}</span>
            <span>{progress.totalHuman ?? "—"}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>{progress.speedHuman || "—"}</TableCell>
      <TableCell>{formatEta(progress.etaHuman)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {task.state === "downloading" || task.state === "queued" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPause(task.id)}
                  aria-label={t("downloads.actions.pause")}
                  title={t("downloads.actions.pause")}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("downloads.actions.pause")}</TooltipContent>
            </Tooltip>
          ) : null}
          {task.state === "paused" || task.state === "failed" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onResume(task.id)}
                  aria-label={t("downloads.actions.resume")}
                  title={t("downloads.actions.resume")}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("downloads.actions.resume")}</TooltipContent>
            </Tooltip>
          ) : null}
          {task.state !== "completed" && task.state !== "cancelled" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onCancel(task.id)}
                  aria-label={t("downloads.actions.cancel")}
                  title={t("downloads.actions.cancel")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("downloads.actions.cancel")}</TooltipContent>
            </Tooltip>
          ) : null}
          {task.state === "completed" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onOpen(task.destination)}
                    aria-label={t("downloads.actions.open")}
                    title={t("downloads.actions.open")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("downloads.actions.open")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onReveal(task.destination)}
                    aria-label={t("downloads.actions.reveal")}
                    title={t("downloads.actions.reveal")}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("downloads.actions.reveal")}</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onRemove(task.id)}
                aria-label={t("downloads.actions.remove")}
                title={t("downloads.actions.remove")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("downloads.actions.remove")}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
});
