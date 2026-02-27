"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { getStateBadgeVariant } from "@/lib/downloads";
import type { DownloadTask } from "@/types/tauri";

interface DownloadTaskRowProps {
  task: DownloadTask;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onDetail: (task: DownloadTask) => void;
  t: (key: string) => string;
}

export function DownloadTaskRow({
  task,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onOpen,
  onReveal,
  onDetail,
  t,
}: DownloadTaskRowProps) {
  return (
    <TableRow>
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
          <Progress value={task.progress.percent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{task.progress.downloadedHuman}</span>
            <span>{task.progress.totalHuman ?? "—"}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>{task.progress.speedHuman || "—"}</TableCell>
      <TableCell>{formatEta(task.progress.etaHuman)}</TableCell>
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
}
