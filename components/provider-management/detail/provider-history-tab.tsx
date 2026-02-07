"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  ArrowUpCircle,
  RotateCcw,
} from "lucide-react";
import type { InstallHistoryEntry } from "@/types/tauri";
import { cn } from "@/lib/utils";

interface ProviderHistoryTabProps {
  installHistory: InstallHistoryEntry[];
  loadingHistory: boolean;
  onRefreshHistory: () => Promise<unknown>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function getActionIcon(action: string) {
  switch (action.toLowerCase()) {
    case "install":
      return <Download className="h-3.5 w-3.5" />;
    case "uninstall":
    case "remove":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "update":
    case "upgrade":
      return <ArrowUpCircle className="h-3.5 w-3.5" />;
    case "rollback":
      return <RotateCcw className="h-3.5 w-3.5" />;
    default:
      return <History className="h-3.5 w-3.5" />;
  }
}

function getActionColor(action: string) {
  switch (action.toLowerCase()) {
    case "install":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "uninstall":
    case "remove":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "update":
    case "upgrade":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "rollback":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function ProviderHistoryTab({
  installHistory,
  loadingHistory,
  onRefreshHistory,
  t,
}: ProviderHistoryTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("providerDetail.history")}
              {installHistory.length > 0 && (
                <Badge variant="secondary">{installHistory.length}</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("providerDetail.historyDesc")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefreshHistory()}
            disabled={loadingHistory}
          >
            {loadingHistory ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("providers.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingHistory && installHistory.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : installHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>{t("providerDetail.noHistory")}</p>
            <p className="text-xs mt-1">{t("providerDetail.noHistoryDesc")}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("providerDetail.action")}</TableHead>
                  <TableHead>{t("providerDetail.packageName")}</TableHead>
                  <TableHead>{t("providerDetail.version")}</TableHead>
                  <TableHead>{t("providerDetail.result")}</TableHead>
                  <TableHead>{t("providerDetail.timestamp")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "gap-1 text-xs",
                          getActionColor(entry.action),
                        )}
                      >
                        {getActionIcon(entry.action)}
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {entry.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {entry.version || "-"}
                    </TableCell>
                    <TableCell>
                      {entry.success ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">
                            {t("providerDetail.success")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs" title={entry.error_message || undefined}>
                            {t("providerDetail.failed")}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
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
