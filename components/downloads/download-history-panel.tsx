"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
  ArrowDownToLine,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FolderOpen,
  Gauge,
  History,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import { getStateBadgeVariant } from "@/lib/downloads";
import type { HistoryRecord, HistoryStats } from "@/lib/stores/download";

interface DownloadHistoryPanelProps {
  history: HistoryRecord[];
  historyStats: HistoryStats | null;
  historyQuery: string;
  onHistoryQueryChange: (query: string) => void;
  onClearHistory: (days?: number) => void | Promise<void>;
  onRemoveRecord: (id: string) => void | Promise<void>;
  onOpenRecord?: (record: HistoryRecord) => void | Promise<void>;
  onRevealRecord?: (record: HistoryRecord) => void | Promise<void>;
  onReuseRecord?: (record: HistoryRecord) => void | Promise<void>;
  destinationAvailability?: Record<string, boolean>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function DownloadHistoryPanel({
  history,
  historyStats,
  historyQuery,
  onHistoryQueryChange,
  onClearHistory,
  onRemoveRecord,
  onOpenRecord,
  onRevealRecord,
  onReuseRecord,
  destinationAvailability = {},
  t,
}: DownloadHistoryPanelProps) {
  const [retentionDays, setRetentionDays] = useState("");

  const historyStatsCards = useMemo(() => {
    if (!historyStats) return null;
    return [
      {
        label: t("downloads.historyPanel.totalDownloaded"),
        value: historyStats.totalBytesHuman,
        icon: <ArrowDownToLine className="h-4 w-4" />,
      },
      {
        label: t("downloads.historyPanel.averageSpeed"),
        value: historyStats.averageSpeedHuman,
        icon: <Gauge className="h-4 w-4" />,
      },
      {
        label: t("downloads.historyPanel.successRate"),
        value: `${historyStats.successRate}%`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: t("downloads.stats.total"),
        value: historyStats.totalCount,
        icon: <History className="h-4 w-4" />,
      },
    ];
  }, [historyStats, t]);

  const parsedRetentionDays = Number(retentionDays);
  const retentionDaysValid =
    retentionDays.trim().length > 0 &&
    Number.isFinite(parsedRetentionDays) &&
    parsedRetentionDays > 0;
  const clearOlderLabel = retentionDaysValid
    ? t("downloads.historyPanel.clearOlder", {
        days: Math.floor(parsedRetentionDays),
      })
    : t("downloads.historyPanel.clearOlder", { days: "…" });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>{t("downloads.historyPanel.title")}</CardTitle>
            <CardDescription>
              {t("downloads.historyPanel.search")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={historyQuery}
              onChange={(event) => onHistoryQueryChange(event.target.value)}
              placeholder={t("downloads.historyPanel.search")}
              className="w-56"
            />
            <Input
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
              placeholder={t("downloads.historyPanel.retentionDays")}
              className="w-40"
              inputMode="numeric"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={history.length === 0 || !retentionDaysValid}
              onClick={() => {
                if (!retentionDaysValid) return;
                void onClearHistory(Math.floor(parsedRetentionDays));
              }}
            >
              {clearOlderLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={history.length === 0}
              onClick={() => {
                const json = JSON.stringify(history, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `download-history-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {t("downloads.historyPanel.export")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={history.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("downloads.historyPanel.clear")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("downloads.historyPanel.clear")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("downloads.historyPanel.clearConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void onClearHistory(undefined);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("downloads.historyPanel.clear")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {historyStatsCards && (
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            {historyStatsCards.map((card) => (
              <Card key={card.label} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{card.icon}</span>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-semibold">{card.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm font-medium">{t("downloads.noHistory")}</p>
            <p className="text-xs">{t("downloads.noHistoryDesc")}</p>
          </div>
        ) : (
          <ScrollArea className="h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("downloads.name")}</TableHead>
                  <TableHead>{t("downloads.status")}</TableHead>
                  <TableHead>
                    {t("downloads.historyPanel.duration")}
                  </TableHead>
                  <TableHead>
                    {t("downloads.historyPanel.averageSpeed")}
                  </TableHead>
                  <TableHead>{t("downloads.progress.total")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <p
                          className="font-medium truncate"
                          title={record.filename}
                        >
                          {record.filename}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={record.url}
                        >
                          {record.url}
                        </p>
                        {record.error && (
                          <p className="text-xs text-destructive">
                            {record.error}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStateBadgeVariant(record.status)}>
                        {t(`downloads.state.${record.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        {record.durationHuman}
                      </div>
                    </TableCell>
                    <TableCell>{record.speedHuman}</TableCell>
                    <TableCell>{record.sizeHuman}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {record.status === "completed" &&
                          destinationAvailability[record.id] &&
                          onOpenRecord && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onOpenRecord(record)}
                                  aria-label={t("downloads.actions.open")}
                                  title={t("downloads.actions.open")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("downloads.actions.open")}</TooltipContent>
                            </Tooltip>
                          )}
                        {record.status === "completed" &&
                          destinationAvailability[record.id] &&
                          onRevealRecord && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onRevealRecord(record)}
                                  aria-label={t("downloads.actions.reveal")}
                                  title={t("downloads.actions.reveal")}
                                >
                                  <FolderOpen className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("downloads.actions.reveal")}</TooltipContent>
                            </Tooltip>
                          )}
                        {onReuseRecord && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onReuseRecord(record)}
                                aria-label={t("downloads.historyPanel.reuse")}
                                title={t("downloads.historyPanel.reuse")}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("downloads.historyPanel.reuse")}</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onRemoveRecord(record.id)}
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
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
