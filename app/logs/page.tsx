"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { LogPanel } from "@/components/log";
import { LogFileViewer } from "@/components/log/log-file-viewer";
import { LogDiagnosticsCard } from "@/components/log/log-diagnostics-card";
import { LogManagementCard } from "@/components/log/log-management-card";
import { LogStatsStrip } from "@/components/log/log-stats-strip";
import { LogFileListCard } from "@/components/log/log-file-list-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { useLocale } from "@/components/providers/locale-provider";
import { useLogStore } from "@/lib/stores/log";
import {
  useLogs,
  type LogCleanupPreviewSummary,
  type LogMutationSummary,
} from "@/hooks/logs/use-logs";
import { useKeyboardShortcuts } from "@/hooks/shared/use-keyboard-shortcuts";
import {
  buildLogsWorkspaceOverview,
  getLatestLogsWorkspaceAction,
  parseLogsWorkspaceRouteContext,
} from "@/lib/log-workspace";
import { isTauri } from "@/lib/tauri";
import type { LogCleanupOptions, LogCleanupPolicyInput } from "@/types/tauri";
import { formatBytes } from "@/lib/utils";
import { writeClipboard } from "@/lib/clipboard";
import { useSearchParams } from "next/navigation";
import {
  ScrollText,
  FolderOpen,
  FileText,
  RefreshCw,
  Settings2,
  Copy,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type MutationMode = "delete" | "cleanup";

interface MutationSummaryRecord {
  mode: MutationMode;
  summary: LogMutationSummary;
  at: number;
}

interface DeleteIntent {
  mode: "single" | "batch";
  fileNames: string[];
}

interface LogManagementUnavailableCardProps {
  title: string;
  description: string;
}

function LogManagementUnavailableCard({
  title,
  description,
}: LogManagementUnavailableCardProps) {
  return (
    <Card className="h-fit" data-testid="log-management-unavailable-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

export default function LogsPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const desktopRuntime = isTauri();
  const routeContextAppliedRef = useRef(false);
  const {
    logFiles,
    getLogStats,
    selectedLogFile,
    setSelectedLogFile,
    filter,
    setSearch,
    setFilter,
    setShowBookmarksOnly,
  } = useLogStore();
  const {
    crashReports,
    observability,
    latestDiagnosticAction,
    cleanupLogs,
    previewCleanupLogs,
    deleteLogFiles,
    deleteLogFile,
    clearLogs,
    loadLogFiles,
    loadCrashReports,
    getLogDirectory,
    clearLogFile,
    exportDiagnosticBundle,
  } = useLogs();
  const [logDir, setLogDir] = useState<string>("");
  const [cleanupPreview, setCleanupPreview] =
    useState<LogCleanupPreviewSummary | null>(null);
  const [isCleanupPreviewStale, setIsCleanupPreviewStale] = useState(false);
  const [lastMutationSummary, setLastMutationSummary] =
    useState<MutationSummaryRecord | null>(null);
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<
    "realtime" | "files" | "management"
  >("realtime");

  const stats = getLogStats();
  const currentSessionFileName = logFiles[0]?.name ?? null;

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

  const refreshLogsPage = useCallback(async () => {
    if (!desktopRuntime) return;

    setLoading(true);
    try {
      const [fileResult, dirResult] = await Promise.all([
        loadLogFiles(),
        getLogDirectory(),
        loadCrashReports(),
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
  }, [desktopRuntime, getLogDirectory, loadCrashReports, loadLogFiles, t]);

  useEffect(() => {
    refreshLogsPage();
  }, [refreshLogsPage]);

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

  useEffect(() => {
    if (routeContextAppliedRef.current) {
      return;
    }
    routeContextAppliedRef.current = true;

    const routeContext = parseLogsWorkspaceRouteContext(searchParams);
    if (!routeContext) {
      return;
    }

    if (routeContext.tab) {
      setActiveTab(routeContext.tab);
    }

    if (routeContext.search !== undefined) {
      setSearch(routeContext.search);
    }

    if (routeContext.levels && routeContext.levels.length > 0) {
      setFilter({ levels: routeContext.levels });
    }

    if (typeof routeContext.showBookmarksOnly === "boolean") {
      setShowBookmarksOnly(routeContext.showBookmarksOnly);
    }

    if (routeContext.selectedFile) {
      setSelectedLogFile(routeContext.selectedFile);
      if (!routeContext.tab) {
        setActiveTab("files");
      }
    }
  }, [
    searchParams,
    setFilter,
    setSearch,
    setSelectedLogFile,
    setShowBookmarksOnly,
  ]);

  // --- Handlers ---

  const handleOpenLogDir = async () => {
    if (!logDir || !desktopRuntime) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(logDir);
    } catch (error) {
      console.error("Failed to open log directory:", error);
      toast.error(t("logs.openDirError"));
    }
  };

  const handleRevealPath = useCallback(
    async (path: string) => {
      if (!desktopRuntime) return;
      try {
        const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
        await revealItemInDir(path);
      } catch (error) {
        console.error("Failed to reveal path:", error);
        toast.error(t("logs.openDirError"));
      }
    },
    [desktopRuntime, t],
  );

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

  const handleSelectFiles = useCallback((fileNames: string[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const name of fileNames) next.add(name);
      return next;
    });
  }, []);

  const handleDeselectFiles = useCallback((fileNames: string[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const name of fileNames) next.delete(name);
      return next;
    });
  }, []);

  const showMutationFeedback = useCallback(
    (summary: LogMutationSummary, mode: "delete" | "cleanup") => {
      const warnings = summary.warnings ?? [];
      const status = summary.status ?? "success";
      const reasonCode = summary.reasonCode ?? null;

      const reasonMessage =
        reasonCode === "current_session_protected"
          ? t("logs.reasonCurrentSessionProtected")
          : reasonCode === "log_file_not_found"
            ? t("logs.reasonLogFileNotFound")
            : reasonCode === "log_delete_failed"
              ? t("logs.reasonLogDeleteFailed")
              : reasonCode === "stale_policy_context"
                ? t("logs.reasonStalePolicyContext")
                : null;

      if (status === "failed") {
        toast.error(reasonMessage || warnings[0] || t("logs.deleteFailed"));
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
      } else if (summary.protectedCount > 0) {
        toast.info(
          t("logs.previewProtected", { count: summary.protectedCount }),
        );
      } else {
        toast.info(t("logs.cleanupNone"));
      }

      if (warnings.length > 0) {
        toast.info(t("logs.partialWarning", { count: warnings.length }));
      }
    },
    [t],
  );

  const buildFailedMutationSummary = useCallback(
    (message: string): LogMutationSummary => ({
      deletedCount: 0,
      freedBytes: 0,
      protectedCount: 0,
      skippedCount: 0,
      status: "failed",
      reasonCode: null,
      warnings: message ? [message] : [],
      policyFingerprint: null,
      maxRetentionDays: null,
      maxTotalSizeMb: null,
    }),
    [],
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
    const result = await exportDiagnosticBundle({
      t,
      workspaceSection: activeTab,
      selectedFile: selectedLogFile,
      filterContext: {
        levels: filter.levels.map((level) => level.toUpperCase()),
        target: filter.target,
        search: filter.search || undefined,
        useRegex: filter.useRegex,
        startTime: filter.startTime ?? undefined,
        endTime: filter.endTime ?? undefined,
        maxScanLines: filter.maxScanLines ?? undefined,
      },
    });

    if (!result.ok || !result.data) {
      return;
    }
  }, [activeTab, exportDiagnosticBundle, filter, selectedLogFile, t]);

  const handlePreviewCleanup = useCallback(
    async (policy?: LogCleanupPolicyInput) => {
      const result = await previewCleanupLogs(policy);
      if (!result.ok) {
        toast.error(result.error || t("logs.deleteFailed"));
        return result;
      }
      setCleanupPreview(result.data);
      return result;
    },
    [previewCleanupLogs, t],
  );

  const handleDeleteSelectedRequest = useCallback(() => {
    if (selectedFiles.size === 0) return;
    setDeleteIntent({
      mode: "batch",
      fileNames: Array.from(selectedFiles),
    });
  }, [selectedFiles]);

  const handleDeleteSingleRequest = useCallback((fileName: string) => {
    setDeleteIntent({
      mode: "single",
      fileNames: [fileName],
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteIntent) return;

    setDeleting(true);
    try {
      const result =
        deleteIntent.mode === "single"
          ? await deleteLogFile(deleteIntent.fileNames[0])
          : await deleteLogFiles(deleteIntent.fileNames);
      if (!result.ok) {
        const failureMessage = result.error || t("logs.deleteFailed");
        toast.error(failureMessage);
        setLastMutationSummary({
          mode: "delete",
          summary: buildFailedMutationSummary(failureMessage),
          at: Date.now(),
        });
        return;
      }
      showMutationFeedback(result.data, "delete");
      setLastMutationSummary({
        mode: "delete",
        summary: result.data,
        at: Date.now(),
      });
      if (deleteIntent.mode === "batch") {
        setSelectedFiles(new Set());
      }
      setDeleteIntent(null);
    } finally {
      setDeleting(false);
    }
  }, [
    buildFailedMutationSummary,
    deleteIntent,
    deleteLogFile,
    deleteLogFiles,
    showMutationFeedback,
    t,
  ]);

  const handleClearHistory = useCallback(async () => {
    const result = await clearLogFile();
    if (!result.ok) {
      const failureMessage = result.error || t("logs.deleteFailed");
      toast.error(failureMessage);
      setLastMutationSummary({
        mode: "cleanup",
        summary: buildFailedMutationSummary(failureMessage),
        at: Date.now(),
      });
      return;
    }
    setLastMutationSummary({
      mode: "cleanup",
      summary: result.data,
      at: Date.now(),
    });
    showMutationFeedback(result.data, "cleanup");
    setSelectedFiles(new Set());
    setCleanupPreview(null);
  }, [buildFailedMutationSummary, clearLogFile, showMutationFeedback, t]);

  const handleManagementRefresh = useCallback(() => {
    setCleanupPreview(null);
    void refreshLogsPage();
  }, [refreshLogsPage]);

  const handleManagementCleanup = useCallback(
    async (options: LogCleanupOptions) => {
      const result = await cleanupLogs(options);
      if (!result.ok) {
        setLastMutationSummary({
          mode: "cleanup",
          summary: buildFailedMutationSummary(result.error || t("logs.deleteFailed")),
          at: Date.now(),
        });
        return result;
      }

      setLastMutationSummary({
        mode: "cleanup",
        summary: result.data,
        at: Date.now(),
      });
      if (result.data.status !== "failed") {
        setCleanupPreview(null);
      }
      return result;
    },
    [buildFailedMutationSummary, cleanupLogs, t],
  );

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !deleting) {
        setDeleteIntent(null);
      }
    },
    [deleting],
  );

  // --- Computed values ---

  const activeDeleteCount = deleteIntent?.fileNames.length ?? 0;
  const deleteIncludesCurrentSession =
    (deleteIntent?.fileNames ?? []).includes(logFiles[0]?.name ?? "") ||
    deleteIntent?.mode === "batch";

  const latestWorkspaceAction = useMemo(
    () =>
      getLatestLogsWorkspaceAction({
        lastMutationSummary,
        latestDiagnosticAction,
        t,
        formatBytes,
      }),
    [lastMutationSummary, latestDiagnosticAction, t],
  );

  const workspaceOverview = useMemo(
    () =>
      buildLogsWorkspaceOverview({
        activeTab,
        fileCount: logFiles.length,
        totalSize,
        selectedLogFile,
        currentSessionFileName,
        observability,
        cleanupPreview,
        isCleanupPreviewStale,
        t,
        formatBytes,
      }),
    [
      activeTab,
      cleanupPreview,
      currentSessionFileName,
      isCleanupPreviewStale,
      logFiles.length,
      observability,
      selectedLogFile,
      t,
      totalSize,
    ],
  );

  // --- Contextual sidebar ---

  const contextualSections = useMemo(
    () => [
      {
        key: "diagnostics",
        render: () => (
          <LogDiagnosticsCard
            className="h-fit"
            isDesktopRuntime={desktopRuntime}
            observability={observability}
            crashReports={crashReports}
            latestDiagnosticAction={latestDiagnosticAction}
            onExportDiagnostic={handleExportDiagnostic}
            onRefreshCrashReports={refreshLogsPage}
            onCopyPath={handleCopyPath}
            onRevealPath={handleRevealPath}
          />
        ),
      },
      {
        key: "management",
        render: () =>
          desktopRuntime ? (
            <LogManagementCard
              className="h-fit"
              totalSize={totalSize}
              fileCount={logFiles.length}
              previewResult={cleanupPreview}
              onPreviewCleanup={handlePreviewCleanup}
              onCleanup={handleManagementCleanup}
              onRefresh={handleManagementRefresh}
              onPreviewStaleChange={setIsCleanupPreviewStale}
            />
          ) : (
            <LogManagementUnavailableCard
              title={t("logs.desktopOnly")}
              description={t("logs.managementDesktopOnlyDescription")}
            />
          ),
      },
    ],
    [
      cleanupPreview,
      crashReports,
      desktopRuntime,
      handleCopyPath,
      handleExportDiagnostic,
      handleManagementCleanup,
      handleManagementRefresh,
      handlePreviewCleanup,
      handleRevealPath,
      latestDiagnosticAction,
      logFiles.length,
      observability,
      refreshLogsPage,
      t,
      totalSize,
    ],
  );

  const renderContextualRail = useCallback(
    (variant: "desktop" | "mobile") => {
      const wrapperClassName =
        variant === "desktop"
          ? "hidden lg:flex lg:min-h-0 lg:flex-col lg:gap-4"
          : "flex flex-col gap-4";

      return (
        <div
          className={wrapperClassName}
          data-testid={
            variant === "desktop"
              ? "logs-contextual-rail"
              : "logs-contextual-stack"
          }
        >
          {contextualSections.map((section) => (
            <div
              key={section.key}
              data-testid={`logs-contextual-section-${section.key}`}
            >
              {section.render()}
            </div>
          ))}
        </div>
      );
    },
    [contextualSections],
  );

  // --- Render ---

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
                disabled={!desktopRuntime}
                className="h-8 sm:h-9"
              >
                <ShieldAlert className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {t("logs.exportFullDiagnostic")}
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

      {/* Stats strip */}
      <section
        data-testid="logs-workspace-overview"
        className="shrink-0 px-4 sm:px-6 pt-4"
      >
        <LogStatsStrip
          metrics={workspaceOverview.metrics}
          attention={workspaceOverview.attention}
          latestAction={latestWorkspaceAction}
          loading={loading}
        />
      </section>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "realtime" | "files" | "management")
        }
        className="flex-1 flex flex-col min-h-0"
      >
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
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <section
                role="status"
                aria-live="polite"
                className="shrink-0 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground/90">
                    {t("logs.realtime")}
                  </span>
                  <span className="tabular-nums">
                    {stats.total} {t("logs.entries")}
                  </span>
                </div>
              </section>
              <section className="min-h-0 flex-1" aria-label={t("logs.realtime")}>
                <LogPanel className="h-full" maxHeight="100%" showToolbar />
              </section>
            </div>
            {renderContextualRail("desktop")}
          </div>
        </TabsContent>

        {/* Log files tab */}
        <TabsContent
          value="files"
          data-testid="logs-files-tab-content"
          className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 min-h-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            <section
              role="status"
              aria-live="polite"
              className="shrink-0 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground/90">
                  {t("logs.logFiles")}
                </span>
                <span className="tabular-nums">
                  {logFiles.length} • {formatBytes(totalSize)}
                </span>
              </div>
            </section>

            <section className="min-h-0 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 h-full min-h-0">
                <LogFileListCard
                  logFiles={logFiles}
                  logDir={logDir}
                  loading={loading}
                  currentSessionFileName={currentSessionFileName}
                  selectedFiles={selectedFiles}
                  onToggleFileSelection={toggleFileSelection}
                  onSelectFiles={handleSelectFiles}
                  onDeselectFiles={handleDeselectFiles}
                  onViewFile={setSelectedLogFile}
                  onDeleteRequest={handleDeleteSingleRequest}
                  onDeleteSelectedRequest={handleDeleteSelectedRequest}
                  onClearHistory={handleClearHistory}
                  onCopyPath={handleCopyPath}
                />
                {renderContextualRail("desktop")}
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Management tab (mobile only, on desktop it's a sidebar) */}
        <TabsContent
          value="management"
          className="flex-1 mt-0 p-4 sm:p-6 pt-3 sm:pt-4 overflow-auto lg:hidden"
        >
          <div className="flex min-h-full flex-col gap-3">
            <section
              role="status"
              aria-live="polite"
              className="shrink-0 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground/90">
                  {t("logs.management")}
                </span>
                <span className="tabular-nums">
                  {logFiles.length} • {formatBytes(totalSize)}
                </span>
              </div>
            </section>
            <section className="min-h-0 flex-1">
              {renderContextualRail("mobile")}
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(deleteIntent)}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logs.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("logs.deleteConfirm", { count: activeDeleteCount })}
            </AlertDialogDescription>
            {deleteIncludesCurrentSession && (
              <p className="text-xs text-muted-foreground">
                {t("logs.currentSessionProtectedNotice")}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
