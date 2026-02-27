"use client";

import { useMemo } from "react";
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
  Gauge,
  History,
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
  onClearHistory: () => void;
  onRemoveRecord: (id: string) => void;
  t: (key: string) => string;
}

export function DownloadHistoryPanel({
  history,
  historyStats,
  historyQuery,
  onHistoryQueryChange,
  onClearHistory,
  onRemoveRecord,
  t,
}: DownloadHistoryPanelProps) {
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
                    onClick={onClearHistory}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onRemoveRecord(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("downloads.actions.remove")}</TooltipContent>
                      </Tooltip>
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
