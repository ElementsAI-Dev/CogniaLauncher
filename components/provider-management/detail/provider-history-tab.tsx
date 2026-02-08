"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { InstallHistoryEntry } from "@/types/tauri";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const uniqueActions = useMemo(
    () => Array.from(new Set(installHistory.map((e) => e.action))),
    [installHistory],
  );

  const filtered = useMemo(() => {
    let result = installHistory;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.version && e.version.toLowerCase().includes(q)),
      );
    }
    if (actionFilter !== "all") {
      result = result.filter((e) => e.action.toLowerCase() === actionFilter);
    }
    if (resultFilter === "success") {
      result = result.filter((e) => e.success);
    } else if (resultFilter === "failed") {
      result = result.filter((e) => !e.success);
    }
    return result;
  }, [installHistory, searchQuery, actionFilter, resultFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        {installHistory.length > 0 && (
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("providerDetail.searchHistory")}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("providerDetail.filterByAction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("providerDetail.allActions")}</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a.toLowerCase()}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("providerDetail.filterByResult")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("providerDetail.allResults")}</SelectItem>
                <SelectItem value="success">{t("providerDetail.success")}</SelectItem>
                <SelectItem value="failed">{t("providerDetail.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>{t("providerDetail.noSearchResults")}</p>
          </div>
        ) : (
          <>
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
                  {paginated.map((entry) => (
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
                          <div className="space-y-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="flex items-center gap-1 text-red-600 hover:underline"
                                  onClick={() => setExpandedError(expandedError === entry.id ? null : entry.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span className="text-xs">
                                    {t("providerDetail.failed")}
                                  </span>
                                  {entry.error_message && (
                                    <AlertCircle className="h-3 w-3 ml-1" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {entry.error_message
                                  ? t("providerDetail.errorDetails")
                                  : t("providerDetail.failed")}
                              </TooltipContent>
                            </Tooltip>
                            {expandedError === entry.id && entry.error_message && (
                              <p className="text-xs text-red-500 font-mono bg-red-50 dark:bg-red-950 rounded p-2 max-w-[300px] break-all">
                                {entry.error_message}
                              </p>
                            )}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  {t("providerDetail.page", { current: safePage, total: totalPages })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
