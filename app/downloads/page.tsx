'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocale } from '@/components/providers/locale-provider';
import { useDownloads } from '@/hooks/use-downloads';
import { isTauri } from '@/lib/tauri';
import {
  AddDownloadDialog,
  GitHubDownloadDialog,
  GitLabDownloadDialog,
  DownloadToolbar,
  DownloadEmptyState,
  DownloadDetailDialog,
  DownloadTaskRow,
  DownloadSettingsCard,
  DownloadHistoryPanel,
  BatchImportDialog,
  SpeedChart,
  type StatusFilter,
  type SpeedUnit,
} from '@/components/downloads';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowDownToLine,
  RefreshCw,
  History,
  Github,
  Gitlab,
  ListPlus,
} from 'lucide-react';
import { EMPTY_QUEUE_STATS } from '@/lib/constants/downloads';
import {
  createHistoryDownloadDraft,
  runDownloadPreflightWithUi,
} from '@/lib/downloads';
import type { DownloadRequest, DownloadTask, HistoryRecord } from '@/lib/stores/download';

export default function DownloadsPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [gitlabDialogOpen, setGitlabDialogOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyResults, setHistoryResults] = useState<HistoryRecord[] | null>(null);
  const [speedLimitInput, setSpeedLimitInput] = useState('0');
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('B/s');
  const [maxConcurrentInput, setMaxConcurrentInput] = useState('4');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailTask, setDetailTask] = useState<DownloadTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [initialRequest, setInitialRequest] = useState<Partial<DownloadRequest> | null>(null);
  const [historyDestinationAvailability, setHistoryDestinationAvailability] = useState<
    Record<string, boolean>
  >({});

  const {
    tasks,
    stats,
    history,
    historyStats,
    speedLimit,
    maxConcurrent,
    isLoading,
    error,
    selectedTaskIds,
    addDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    removeDownload,
    pauseAll,
    resumeAll,
    cancelAll,
    clearFinished,
    retryFailed,
    setSpeedLimit,
    setMaxConcurrent,
    clipboardMonitor,
    setClipboardMonitor,
    openFile,
    revealFile,
    retryTask,
    setPriority,
    setTaskSpeedLimit,
    calculateChecksum,
    refreshTasks,
    refreshStats,
    refreshHistory,
    searchHistory,
    clearHistory,
    removeHistoryRecord,
    batchPause,
    batchResume,
    batchCancel,
    batchRemove,
    selectTask,
    deselectTask,
    deselectAllTasks,
    checkDiskSpace,
    verifyFile,
    extractArchive,
  } = useDownloads();

  const queueStats = stats ?? EMPTY_QUEUE_STATS;
  const extractingCount = useMemo(
    () => tasks.filter((task) => task.state === 'extracting').length,
    [tasks]
  );

  useEffect(() => {
    // Auto-select best unit when syncing from backend
    if (speedLimit >= 1024 * 1024) {
      setSpeedUnit('MB/s');
      setSpeedLimitInput(String(Math.round((speedLimit / (1024 * 1024)) * 100) / 100));
    } else if (speedLimit >= 1024) {
      setSpeedUnit('KB/s');
      setSpeedLimitInput(String(Math.round((speedLimit / 1024) * 100) / 100));
    } else {
      setSpeedUnit('B/s');
      setSpeedLimitInput(String(speedLimit));
    }
  }, [speedLimit]);

  useEffect(() => {
    setMaxConcurrentInput(String(maxConcurrent));
  }, [maxConcurrent]);

  useEffect(() => {
    if (activeTab === 'history') {
      refreshHistory();
    }
  }, [activeTab, refreshHistory]);

  useEffect(() => {
    if (!historyQuery.trim()) {
      setHistoryResults(null);
      return;
    }

    const handler = window.setTimeout(async () => {
      try {
        const results = await searchHistory(historyQuery.trim());
        setHistoryResults(results);
      } catch (err) {
        console.error('Failed to search history', err);
      }
    }, 300);

    return () => window.clearTimeout(handler);
  }, [historyQuery, searchHistory]);

  const activeHistory = historyResults ?? history;

  useEffect(() => {
    if (activeTab !== 'history' || !isDesktop) {
      setHistoryDestinationAvailability({});
      return;
    }

    let disposed = false;

    const loadAvailability = async () => {
      try {
        const fsModule = await import('@tauri-apps/plugin-fs').catch(() => null);
        if (!fsModule?.exists) {
          if (!disposed) {
            setHistoryDestinationAvailability({});
          }
          return;
        }

        const entries = await Promise.all(
          activeHistory.map(async (record) => [
            record.id,
            record.status === 'completed' ? await fsModule.exists(record.destination) : false,
          ] as const)
        );

        if (!disposed) {
          setHistoryDestinationAvailability(Object.fromEntries(entries));
        }
      } catch {
        if (!disposed) {
          setHistoryDestinationAvailability({});
        }
      }
    };

    void loadAvailability();

    return () => {
      disposed = true;
    };
  }, [activeHistory, activeTab, isDesktop]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search filter
    if (queueSearchQuery.trim()) {
      const query = queueSearchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.name.toLowerCase().includes(query) ||
          task.url.toLowerCase().includes(query) ||
          (task.provider && task.provider.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((task) => task.state === statusFilter);
    }

    return result;
  }, [tasks, queueSearchQuery, statusFilter]);

  const hasQueueFilters = queueSearchQuery !== '' || statusFilter !== 'all';

  const selectedCount = selectedTaskIds.size;
  const selectedVisibleCount = filteredTasks.filter((task) =>
    selectedTaskIds.has(task.id)
  ).length;
  const allVisibleSelected =
    filteredTasks.length > 0 && selectedVisibleCount === filteredTasks.length;

  const handleClearQueueFilters = useCallback(() => {
    setQueueSearchQuery('');
    setStatusFilter('all');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const url = e.dataTransfer.getData('text/uri-list')
      || e.dataTransfer.getData('text/plain')
      || e.dataTransfer.getData('text');

    if (url && /^https?:\/\//i.test(url.trim())) {
      setInitialRequest({ url: url.trim() });
      setAddDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleClipboardDownloadUrl = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail !== 'string' || !customEvent.detail.trim()) {
        return;
      }
      setInitialRequest({ url: customEvent.detail.trim() });
      setAddDialogOpen(true);
    };

    window.addEventListener(
      'clipboard-download-url',
      handleClipboardDownloadUrl as EventListener
    );
    return () => {
      window.removeEventListener(
        'clipboard-download-url',
        handleClipboardDownloadUrl as EventListener
      );
    };
  }, []);

  const handleAdd = useCallback(
    async (request: DownloadRequest) => {
      try {
        const pass = await runDownloadPreflightWithUi(
          {
            destinationPath: request.destination,
            checkDiskSpace,
          },
          {
            t,
            onInfo: (message) => toast(message),
            onError: (message) => toast.error(message),
          }
        );
        if (!pass) return;

        await addDownload(request);
        toast.success(t('downloads.toast.added'));
        await refreshTasks();
        await refreshStats();
      } catch (err) {
        toast.error(String(err));
      }
    },
    [addDownload, checkDiskSpace, refreshTasks, refreshStats, t]
  );

  const handlePauseAll = useCallback(async () => {
    const paused = await pauseAll();
    if (paused > 0) {
      toast.success(t('downloads.toast.paused'));
    }
  }, [pauseAll, t]);

  const handleResumeAll = useCallback(async () => {
    const resumed = await resumeAll();
    if (resumed > 0) {
      toast.success(t('downloads.toast.resumed'));
    }
  }, [resumeAll, t]);

  const handleCancelAll = useCallback(async () => {
    const cancelled = await cancelAll();
    if (cancelled > 0) {
      toast.success(t('downloads.toast.cancelled'));
    }
  }, [cancelAll, t]);

  const handleClearFinished = useCallback(async () => {
    const cleared = await clearFinished();
    if (cleared > 0) {
      toast.success(t('downloads.toast.cleared', { count: cleared }));
    }
  }, [clearFinished, t]);

  const handleRetryFailed = useCallback(async () => {
    const retried = await retryFailed();
    if (retried > 0) {
      toast.success(t('downloads.toast.started'));
    }
  }, [retryFailed, t]);

  const handleApplySettings = useCallback(async () => {
    const inputValue = Number(speedLimitInput);
    const concurrent = Number(maxConcurrentInput);

    if (!Number.isNaN(inputValue)) {
      // Convert from display unit to bytes
      const multiplier = speedUnit === 'MB/s' ? 1024 * 1024 : speedUnit === 'KB/s' ? 1024 : 1;
      const speedBytes = Math.round(inputValue * multiplier);
      await setSpeedLimit(speedBytes);
      toast.success(
        speedBytes > 0
          ? t('downloads.toast.speedLimitSet', { speed: `${inputValue} ${speedUnit}` })
          : t('downloads.toast.speedLimitRemoved')
      );
    }

    if (!Number.isNaN(concurrent)) {
      await setMaxConcurrent(Math.max(1, concurrent));
    }
  }, [maxConcurrentInput, setMaxConcurrent, setSpeedLimit, speedLimitInput, speedUnit, t]);

  const handleBatchPause = useCallback(async () => {
    if (selectedCount === 0) return;
    const count = await batchPause();
    await Promise.all([refreshTasks(), refreshStats()]);
    if (count > 0) {
      toast.success(t('downloads.toast.paused'));
    }
    deselectAllTasks();
  }, [batchPause, deselectAllTasks, refreshStats, refreshTasks, selectedCount, t]);

  const handleBatchResume = useCallback(async () => {
    if (selectedCount === 0) return;
    const count = await batchResume();
    await Promise.all([refreshTasks(), refreshStats()]);
    if (count > 0) {
      toast.success(t('downloads.toast.resumed'));
    }
    deselectAllTasks();
  }, [batchResume, deselectAllTasks, refreshStats, refreshTasks, selectedCount, t]);

  const handleBatchCancel = useCallback(async () => {
    if (selectedCount === 0) return;
    const count = await batchCancel();
    await Promise.all([refreshTasks(), refreshStats()]);
    if (count > 0) {
      toast.success(t('downloads.toast.cancelled'));
    }
    deselectAllTasks();
  }, [batchCancel, deselectAllTasks, refreshStats, refreshTasks, selectedCount, t]);

  const handleBatchRemove = useCallback(async () => {
    if (selectedCount === 0) return;
    const count = await batchRemove();
    if (count > 0) {
      toast.success(t('downloads.toast.cleared', { count }));
      await refreshStats();
    }
    deselectAllTasks();
  }, [batchRemove, deselectAllTasks, refreshStats, selectedCount, t]);

  const handleToggleSelectAllVisible = useCallback(
    (checked: boolean) => {
      if (checked) {
        filteredTasks.forEach((task) => {
          if (!selectedTaskIds.has(task.id)) {
            selectTask(task.id);
          }
        });
      } else {
        filteredTasks.forEach((task) => {
          if (selectedTaskIds.has(task.id)) {
            deselectTask(task.id);
          }
        });
      }
    },
    [deselectTask, filteredTasks, selectTask, selectedTaskIds]
  );

  return (
    <div
      className="p-6 space-y-6 relative"
      data-hint="downloads-concurrent"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="text-center">
            <ArrowDownToLine className="h-12 w-12 mx-auto mb-2 text-primary animate-bounce" />
            <p className="text-lg font-medium text-primary">{t('downloads.dropUrl')}</p>
          </div>
        </div>
      )}
      <PageHeader
        title={t('downloads.title')}
        description={t('downloads.description')}
        actions={(
          <>
            <Button
              size="sm"
              onClick={() => {
                setInitialRequest(null);
                setAddDialogOpen(true);
              }}
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              {t('downloads.addDownload')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBatchImportOpen(true)}>
              <ListPlus className="h-4 w-4 mr-2" />
              {t('downloads.batchImport')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGithubDialogOpen(true)}>
              <Github className="h-4 w-4 mr-2" />
              {t('downloads.fromGitHub')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGitlabDialogOpen(true)}>
              <Gitlab className="h-4 w-4 mr-2" />
              {t('downloads.fromGitLab')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refreshTasks();
                refreshStats();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
          </>
        )}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isDesktop && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('about.updateDesktopOnly')}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="queue" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            {t('downloads.queue')}
            <span className="text-xs text-muted-foreground">({tasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {t('downloads.historyTab')}
            <span className="text-xs text-muted-foreground">({history.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          <DownloadToolbar
            searchQuery={queueSearchQuery}
            onSearchChange={setQueueSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            selectedCount={selectedCount}
            onBatchPause={handleBatchPause}
            onBatchResume={handleBatchResume}
            onBatchCancel={handleBatchCancel}
            onBatchRemove={handleBatchRemove}
            onClearSelection={deselectAllTasks}
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
            onCancelAll={handleCancelAll}
            onClearFinished={handleClearFinished}
            onRetryFailed={handleRetryFailed}
            extractingCount={extractingCount}
            stats={queueStats}
            isLoading={isLoading}
            t={t}
          />

          <div
            data-testid="downloads-queue-layout"
            className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
          >
            <div className="space-y-6">
              <Card data-testid="downloads-queue-card">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{t('downloads.queue')}</CardTitle>
                      <CardDescription>
                        {t('downloads.progress.percent')}: {queueStats.overallProgress.toFixed(1)}%
                        {filteredTasks.length !== tasks.length && (
                          <span className="ml-2">({filteredTasks.length} / {tasks.length})</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredTasks.length === 0 ? (
                    <DownloadEmptyState
                      hasFilters={hasQueueFilters}
                      onClearFilters={handleClearQueueFilters}
                      t={t}
                    />
                  ) : (
                    <ScrollArea className="h-[420px] w-full">
                      <Table className="min-w-[920px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  allVisibleSelected
                                    ? true
                                    : selectedVisibleCount > 0
                                      ? 'indeterminate'
                                      : false
                                }
                                onCheckedChange={(checked) =>
                                  handleToggleSelectAllVisible(checked === true)
                                }
                                aria-label="Select all visible tasks"
                              />
                            </TableHead>
                            <TableHead>{t('downloads.name')}</TableHead>
                            <TableHead>{t('downloads.provider')}</TableHead>
                            <TableHead>{t('downloads.status')}</TableHead>
                            <TableHead>{t('downloads.progress.percent')}</TableHead>
                            <TableHead>{t('downloads.progress.speed')}</TableHead>
                            <TableHead>{t('downloads.progress.eta')}</TableHead>
                            <TableHead className="text-right">{t('common.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTasks.map((task) => (
                            <DownloadTaskRow
                              key={task.id}
                              task={task}
                              selected={selectedTaskIds.has(task.id)}
                              onSelectedChange={(selected) => {
                                if (selected) {
                                  selectTask(task.id);
                                } else {
                                  deselectTask(task.id);
                                }
                              }}
                              onPause={pauseDownload}
                              onResume={resumeDownload}
                              onCancel={cancelDownload}
                              onRemove={removeDownload}
                              onOpen={openFile}
                              onReveal={revealFile}
                              onDetail={(task) => {
                                setDetailTask(task);
                                setDetailOpen(true);
                              }}
                              t={t}
                            />
                          ))}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <SpeedChart t={t} />
            </div>

            <div
              data-testid="downloads-settings-region"
              className="xl:sticky xl:top-6 xl:self-start"
            >
              <DownloadSettingsCard
                speedLimitInput={speedLimitInput}
                onSpeedLimitChange={setSpeedLimitInput}
                speedUnit={speedUnit}
                onSpeedUnitChange={setSpeedUnit}
                maxConcurrentInput={maxConcurrentInput}
                onMaxConcurrentChange={setMaxConcurrentInput}
                onApply={handleApplySettings}
                disabled={!isDesktop}
                clipboardMonitor={clipboardMonitor}
                onClipboardMonitorChange={setClipboardMonitor}
                t={t}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <DownloadHistoryPanel
            history={activeHistory}
            historyStats={historyStats}
            historyQuery={historyQuery}
            onHistoryQueryChange={setHistoryQuery}
            onClearHistory={async (days) => void clearHistory(days)}
            onRemoveRecord={async (id) => void removeHistoryRecord(id)}
            onOpenRecord={async (record) => void openFile(record.destination)}
            onInstallRecord={async (record) => void openFile(record.destination)}
            onRevealRecord={async (record) => void revealFile(record.destination)}
            onExtractRecord={async (record) => {
              const destinationDir =
                record.destination.replace(/[\\/][^\\/]+$/, "") || record.destination;
              void extractArchive(record.destination, destinationDir);
            }}
            onReuseRecord={async (record) => {
              setInitialRequest(createHistoryDownloadDraft(record));
              setAddDialogOpen(true);
            }}
            destinationAvailability={historyDestinationAvailability}
            t={t}
          />
        </TabsContent>
      </Tabs>

      <AddDownloadDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setInitialRequest(null);
        }}
        onSubmit={handleAdd}
        initialRequest={initialRequest ?? undefined}
      />

      <GitHubDownloadDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        checkDiskSpace={checkDiskSpace}
        onDownloadStarted={() => {
          refreshTasks();
          refreshStats();
        }}
      />

      <GitLabDownloadDialog
        open={gitlabDialogOpen}
        onOpenChange={setGitlabDialogOpen}
        checkDiskSpace={checkDiskSpace}
        onDownloadStarted={() => {
          refreshTasks();
          refreshStats();
        }}
      />

      <DownloadDetailDialog
        task={detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRetry={retryTask}
        onSetPriority={setPriority}
        onOpenFile={openFile}
        onRevealFile={revealFile}
        onCalculateChecksum={calculateChecksum}
        onVerifyFile={verifyFile}
        onExtractArchive={extractArchive}
        onSetTaskSpeedLimit={setTaskSpeedLimit}
      />

      <BatchImportDialog
        open={batchImportOpen}
        onOpenChange={setBatchImportOpen}
        onSubmit={async (requests) => {
          let added = 0;
          const unknownSizeWarningRef = { current: false };

          for (const req of requests) {
            try {
              const pass = await runDownloadPreflightWithUi(
                {
                  destinationPath: req.destination,
                  checkDiskSpace,
                },
                {
                  t,
                  onInfo: (message) => toast(message),
                  onError: (message) => toast.error(message),
                  unknownSizeWarningRef,
                }
              );
              if (!pass) continue;

              await addDownload(req);
              added++;
            } catch (err) {
              console.error('Failed to add download:', err);
            }
          }
          if (added > 0) {
            toast.success(t('downloads.toast.batchAdded', { count: added }));
            await refreshTasks();
            await refreshStats();
          }
        }}
      />
    </div>
  );
}
