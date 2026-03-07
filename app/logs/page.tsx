"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { LogPanel } from "@/components/log";
import { LogFileViewer } from "@/components/log/log-file-viewer";
import { LogManagementCard } from "@/components/log/log-management-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { useLocale } from "@/components/providers/locale-provider";
import { useLogStore } from "@/lib/stores/log";
import { useLogs, type LogMutationSummary } from "@/hooks/use-logs";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { isTauri } from "@/lib/tauri";
import { formatBytes, formatDate } from "@/lib/utils";
import { formatSessionLabel } from "@/lib/log";
import { writeClipboard } from "@/lib/clipboard";
import {
  ScrollText,
  FolderOpen,
  FileText,
  RefreshCw,
  Trash2,
  Settings2,
  X,
  Copy,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE_PRESETS = [20, 50, 100] as const;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 500;

export default function LogsPage() {
  const { t } = useLocale();
  const { logFiles, getLogStats, selectedLogFile, setSelectedLogFile, filter } =
    useLogStore();
  const {
    cleanupLogs,
    previewCleanupLogs,
    deleteLogFiles,
    deleteLogFile,
    clearLogs,
    loadLogFiles,
    getLogDirectory,
    clearLogFile,
    exportLogFile,
  } = useLogs();
  const [logDir, setLogDir] = useState<string>("");
  const [cleanupPreview, setCleanupPreview] = useState<{
    deletedCount: number;
    freedBytes: number;
    protectedCount: number;
    status: "success" | "partial_success" | "failed";
    warnings: string[];
  } | null>(null);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "l",
        ctrlKey: true,
        action: () => clearLogs(),
        description: "Clear logs",
      },
      {
        key: "r",
        ctrlKey: true,
        action: () => refreshLogsPage(),
        description: "Refresh log files",
      },
    ],
  });
  const [loading, setLoading] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_PRESETS[0]);
  const [customPageSize, setCustomPageSize] = useState<string>(
    String(PAGE_SIZE_PRESETS[0]),
  );
  const stats = getLogStats();
  const totalPages = Math.max(1, Math.ceil(logFiles.length / pageSize));
  const pagedLogFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return logFiles.slice(startIndex, startIndex + pageSize);
  }, [currentPage, logFiles, pageSize]);

  const applyPageSize = useCallback((value: number) => {
    const normalized = Math.min(
      MAX_PAGE_SIZE,
      Math.max(MIN_PAGE_SIZE, Math.floor(value)),
    );
    setPageSize(normalized);
    setCustomPageSize(String(normalized));
  }, []);

  const refreshLogsPage = useCallback(async () => {
    if (!isTauri()) return;

    setLoading(true);
    try {
      const [fileResult, dirResult] = await Promise.all([
        loadLogFiles(),
        getLogDirectory(),
      ]);

      if (!fileResult.ok) {
        toast.error(fileResult.error || t("logs.loadError"));
        return;
      }

      if (dirResult.ok) {
        setLogDir(dirResult.data);
      } else {
        setLogDir("");
      }
    } catch (error) {
      console.error("Failed to load log files:", error);
      toast.error(t("logs.loadError"));
    } finally {
      setLoading(false);
    }
  }, [getLogDirectory, loadLogFiles, t]);

  useEffect(() => {
    refreshLogsPage();
  }, [refreshLogsPage]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const nextTotalSize = logFiles.reduce(
      (total, file) => total + file.size,
      0,
    );
    setTotalSize(nextTotalSize);
  }, [logFiles]);

  useEffect(() => {
    const availableFiles = new Set(logFiles.map((file) => file.name));

    setSelectedFiles((prev) => {
      const next = new Set(
        Array.from(prev).filter((fileName) => availableFiles.has(fileName)),
      );
      return next.size === prev.size ? prev : next;
    });

    if (selectedLogFile && !availableFiles.has(selectedLogFile)) {
      setSelectedLogFile(null);
    }
  }, [logFiles, selectedLogFile, setSelectedLogFile]);

  const handleOpenLogDir = async () => {
    if (!logDir || !isTauri()) return;

    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(logDir);
    } catch (error) {
      console.error("Failed to open log directory:", error);
      toast.error(t("logs.openDirError"));
    }
  };

  const handleCloseViewer = useCallback(
    () => setSelectedLogFile(null),
    [setSelectedLogFile],
  );

  const toggleFileSelection = useCallback((fileName: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  }, []);

  const showMutationFeedback = useCallback(
    (summary: LogMutationSummary, mode: "delete" | "cleanup") => {
      const warnings = summary.warnings ?? [];
      const status = summary.status ?? "success";

      if (status === "failed") {
        toast.error(warnings[0] || t("logs.deleteFailed"));
        return;
      }

      if (summary.deletedCount > 0) {
        if (mode === "cleanup") {
          toast.success(
            t("logs.cleanupSuccess", {
              count: summary.deletedCount,
              size: formatBytes(summary.freedBytes),
            }),
          );
        } else {
          toast.success(
            t("logs.deleteSuccess", { count: summary.deletedCount }),
          );
        }
      } else {
        toast.info(t("logs.cleanupNone"));
      }

      if (warnings.length > 0) {
        toast.info(t("logs.partialWarning", { count: warnings.length }));
      }
    },
    [t],
  );

  const handleCopyPath = useCallback(
    async (path: string) => {
      try {
        await writeClipboard(path);
        toast.success(t("logs.copyPathSuccess"));
      } catch {
        toast.error(t("logs.copyPathFailed"));
      }
    },
    [t],
  );

  const handleExportDiagnostic = useCallback(async () => {
    const result = await exportLogFile({
      levelFilter: filter.levels.map((level) => level.toUpperCase()),
      target: filter.target,
      search: filter.search || undefined,
      useRegex: filter.useRegex,
      startTime: filter.startTime ?? undefined,
      endTime: filter.endTime ?? undefined,
      format: "json",
      diagnosticMode: true,
      sanitizeSensitive: true,
    });

    if (!result.ok) {
      toast.error(result.error || t("logs.exportError"));
      return;
    }

    try {
      const blob = new Blob([result.data.content], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(t("logs.exportSuccess"));
      if (result.data.redactedCount > 0) {
        toast.info(
          t("logs.redactionApplied", { count: result.data.redactedCount }),
        );
      }
    } catch (error) {
      console.error("Failed to export diagnostic logs:", error);
      toast.error(t("logs.exportError"));
    }
  }, [exportLogFile, filter, t]);

  const handlePreviewCleanup = useCallback(async () => {
    const result = await previewCleanupLogs();
    if (!result.ok) {
      toast.error(result.error || t("logs.deleteFailed"));
      return result;
    }
    setCleanupPreview(result.data);
    return result;
  }, [previewCleanupLogs, t]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedFiles.size === 0) return;

    const result = await deleteLogFiles(Array.from(selectedFiles));
    if (!result.ok) {
      toast.error(result.error || t("logs.deleteFailed"));
      return;
    }
    showMutationFeedback(result.data, "delete");
    setSelectedFiles(new Set());
  }, [selectedFiles, deleteLogFiles, showMutationFeedback, t]);

  const handleDeleteSingle = useCallback(
    async (fileName: string) => {
      const result = await deleteLogFile(fileName);
      if (!result.ok) {
        toast.error(result.error || t("logs.deleteFailed"));
        return;
      }
      showMutationFeedback(result.data, "delete");
    },
    [deleteLogFile, showMutationFeedback, t],
  );

  const handleClearHistory = useCallback(async () => {
    const result = await clearLogFile();
    if (!result.ok) {
      toast.error(result.error || t("logs.deleteFailed"));
      return;
    }
    showMutationFeedback(result.data, "cleanup");
    setSelectedFiles(new Set());
    setCleanupPreview(null);
  }, [clearLogFile, showMutationFeedback, t]);

  const handleCustomPageSizeCommit = useCallback(() => {
    const parsed = Number.parseInt(customPageSize, 10);
    if (Number.isNaN(parsed)) {
      setCustomPageSize(String(pageSize));
      return;
    }
    setCurrentPage(1);
    applyPageSize(parsed);
  }, [applyPageSize, customPageSize, pageSize]);

  const handleManagementRefresh = useCallback(() => {
    setCleanupPreview(null);
    void refreshLogsPage();
  }, [refreshLogsPage]);

  const handleManagementCleanup = useCallback(async () => {
    const result = await cleanupLogs();
    if (result.ok && result.data.status !== "failed") {
      setCleanupPreview(null);
    }
    return result;
  }, [cleanupLogs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 sm:h-6 sm:w-6" />
              {t("logs.title")}
            </span>
          }
          description={t("logs.description")}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDiagnostic}
                className="h-8 sm:h-9"
              >
                <ShieldAlert className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {t("logs.exportDiagnostic")}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshLogsPage}
                disabled={loading}
                className="h-8 sm:h-9"
              >
                <RefreshCw
                  className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">{t("common.refresh")}</span>
              </Button>
              {logDir && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleCopyPath(logDir);
                    }}
                    className="h-8 sm:h-9"
                  >
                    <Copy className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {t("logs.copyDir")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLogDir}
                    className="h-8 sm:h-9"
                  >
                    <FolderOpen className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {t("logs.openDir")}
                    </span>
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="realtime" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-4">
          <TabsList className="h-10 p-1">
            <TabsTrigger value="realtime" className="gap-2 px-3 sm:px-4 h-8">
              <ScrollText className="h-4 w-4" />
              <span className="hidden xs:inline">{t("logs.realtime")}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {stats.total}
              </span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2 px-3 sm:px-4 h-8">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">{t("logs.files")}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {logFiles.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="management"
              className="gap-2 px-3 sm:px-4 h-8 lg:hidden"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden xs:inline">{t("logs.management")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Real-time logs tab */}
        <TabsContent
          value="realtime"
          className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 min-h-0"
        >
          <LogPanel className="h-full" maxHeight="100%" showToolbar />
        </TabsContent>

        {/* Log files tab */}
        <TabsContent
          value="files"
          data-testid="logs-files-tab-content"
          className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 min-h-0 overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-full min-h-0">
            {/* File list */}
            <Card className="flex flex-col min-h-0">
              <CardHeader className="shrink-0 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {t("logs.logFiles")}
                    </CardTitle>
                    {logDir && (
                      <CardDescription>
                        <code className="text-[11px] sm:text-xs bg-muted px-2 py-1 rounded break-all">
                          {logDir}
                        </code>
                      </CardDescription>
                    )}
                  </div>
                  {selectedFiles.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t("logs.deleteSelected")} ({selectedFiles.size})
                    </Button>
                  )}
                  {logFiles.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearHistory}
                      className="h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t("logs.clear")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pt-0">
                {!isTauri() ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                      <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground/70">
                      {t("logs.desktopOnly")}
                    </p>
                    <p className="text-xs sm:text-sm mt-2 text-center max-w-[280px]">
                      {t("logs.desktopOnlyDescription")}
                    </p>
                  </div>
                ) : logFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                      <FileText className="relative h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground/70">
                      {t("logs.noFiles")}
                    </p>
                  </div>
                ) : (
                  <>
                    <ScrollArea
                      data-testid="logs-files-list-scroll-area"
                      className="h-full min-h-0"
                    >
                      <div className="space-y-2 pr-4">
                        {pagedLogFiles.map((file) => {
                          const sessionLabel = formatSessionLabel(file.name);
                          const isCurrent = file.name === logFiles[0]?.name;
                          const isSelected = selectedFiles.has(file.name);
                          return (
                            <div
                              key={file.name}
                              data-testid="log-file-row"
                              className={`group flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-primary/5 border-primary/30"
                                  : "bg-card hover:bg-muted/30 hover:border-primary/20"
                              }`}
                              onClick={() => setSelectedLogFile(file.name)}
                            >
                              {!isCurrent && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    toggleFileSelection(file.name)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="shrink-0"
                                />
                              )}
                              <div className="shrink-0 p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                                <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">
                                    {sessionLabel ?? file.name}
                                  </p>
                                  {isCurrent && (
                                    <Badge
                                      variant="secondary"
                                      className="shrink-0 text-[10px] px-1.5 py-0"
                                    >
                                      {t("logs.currentSession")}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatBytes(file.size)} •{" "}
                                  {formatDate(file.modified)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLogFile(file.name);
                                }}
                                title={t("logs.viewFile")}
                              >
                                <FolderOpen className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCopyPath(file.path);
                                }}
                                title={t("logs.copyFilePath")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {!isCurrent && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeleteSingle(file.name);
                                  }}
                                  title={t("common.delete")}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("logs.pageSize")}
                        </span>
                        <div className="flex items-center gap-1">
                          {PAGE_SIZE_PRESETS.map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              size="sm"
                              variant={
                                pageSize === preset ? "secondary" : "outline"
                              }
                              className="h-7 px-2 text-[11px]"
                              onClick={() => {
                                setCurrentPage(1);
                                applyPageSize(preset);
                              }}
                            >
                              {preset}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          min={MIN_PAGE_SIZE}
                          max={MAX_PAGE_SIZE}
                          step={1}
                          value={customPageSize}
                          onChange={(event) =>
                            setCustomPageSize(event.target.value)
                          }
                          onBlur={handleCustomPageSizeCommit}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleCustomPageSizeCommit();
                            }
                          }}
                          aria-label={t("logs.pageSize")}
                          className="h-7 w-20 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("logs.pageInfo", {
                            current: currentPage,
                            total: totalPages,
                          })}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage <= 1}
                        >
                          {t("common.previous")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1),
                            )
                          }
                          disabled={currentPage >= totalPages}
                        >
                          {t("common.next")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Management sidebar */}
            {isTauri() && (
              <div className="hidden lg:block">
                <LogManagementCard
                  totalSize={totalSize}
                  fileCount={logFiles.length}
                  previewResult={cleanupPreview}
                  onPreviewCleanup={handlePreviewCleanup}
                  onCleanup={handleManagementCleanup}
                  onRefresh={handleManagementRefresh}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Management tab (mobile only, on desktop it's a sidebar) */}
        <TabsContent
          value="management"
          className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 overflow-auto lg:hidden"
        >
          {isTauri() && (
            <LogManagementCard
              totalSize={totalSize}
              fileCount={logFiles.length}
              previewResult={cleanupPreview}
              onPreviewCleanup={handlePreviewCleanup}
              onCleanup={handleManagementCleanup}
              onRefresh={handleManagementRefresh}
            />
          )}
        </TabsContent>
      </Tabs>

      <LogFileViewer
        open={Boolean(selectedLogFile)}
        fileName={selectedLogFile}
        onOpenChange={(open) => {
          if (!open) handleCloseViewer();
        }}
      />
    </div>
  );
}
