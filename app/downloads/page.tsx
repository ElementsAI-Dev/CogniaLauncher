'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocale } from '@/components/providers/locale-provider';
import { useDownloads } from '@/hooks/downloads/use-downloads';
import { isTauri } from '@/lib/tauri';
import {
  AddDownloadDialog,
  GitHubDownloadDialog,
  GitLabDownloadDialog,
  DownloadEmptyState,
  DownloadDetailDialog,
  BatchImportDialog,
  SpeedChart,
} from '@/components/downloads';
import { DownloadToolbar, type StatusFilter } from '@/components/downloads/download-toolbar';
import { DownloadTaskCard } from '@/components/downloads/download-task-card';
import { DownloadStatsStrip } from '@/components/downloads/download-stats-strip';
import { DownloadSettingsPanel } from '@/components/downloads/download-settings-panel';
import type { SpeedUnit } from '@/components/downloads/download-settings-card';
import { DashboardSectionLabel } from '@/components/dashboard/dashboard-primitives';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowDownToLine,
  RefreshCw,
  Github,
  Gitlab,
  ListPlus,
} from 'lucide-react';
import { EMPTY_QUEUE_STATS } from '@/lib/constants/downloads';
import { createTaskDownloadDraft, runDownloadPreflightWithUi } from '@/lib/downloads';
import { useDownloadStore } from '@/lib/stores/download';
import type { DownloadRequest, DownloadTask } from '@/lib/stores/download';

/** Group key → display order and state matcher. */
const STATE_GROUPS = [
  { key: 'downloading', states: ['downloading', 'extracting'] as const },
  { key: 'paused', states: ['paused'] as const },
  { key: 'queued', states: ['queued'] as const },
  { key: 'completed', states: ['completed'] as const },
  { key: 'failed', states: ['failed'] as const },
  { key: 'cancelled', states: ['cancelled'] as const },
] as const;

export default function DownloadsPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [gitlabDialogOpen, setGitlabDialogOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<DownloadTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDestinationAvailable, setDetailDestinationAvailable] = useState(false);
  const [initialRequest, setInitialRequest] = useState<Partial<DownloadRequest> | null>(null);

  // Settings states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speedLimitInput, setSpeedLimitInput] = useState('0');
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('B/s');
  const [maxConcurrentInput, setMaxConcurrentInput] = useState('4');

  // Filter states
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);

  const {
    tasks,
    stats,
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
    batchPause,
    batchResume,
    batchCancel,
    batchRemove,
    selectTask,
    deselectTask,
    deselectAllTasks,
    checkDiskSpace,
    checkDestinationAvailability,
    verifyFile,
    extractArchive,
  } = useDownloads({ enableRuntime: false });

  const queueStats = stats ?? EMPTY_QUEUE_STATS;

  // Current speed from store for stats strip
  const speedHistory = useDownloadStore((s) => s.speedHistory);
  const currentSpeed = speedHistory.length > 0 ? speedHistory[speedHistory.length - 1] : 0;

  // Sync settings from backend
  useEffect(() => {
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

  // Computed counts for toolbar
  const activeCount = useMemo(
    () =>
      tasks.filter(
        (t) => t.state === 'downloading' || t.state === 'extracting' || t.state === 'paused'
      ).length,
    [tasks]
  );

  const doneCount = useMemo(
    () => tasks.filter((t) => t.state === 'completed' || t.state === 'cancelled').length,
    [tasks]
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (queueSearchQuery.trim()) {
      const query = queueSearchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.name.toLowerCase().includes(query) ||
          task.url.toLowerCase().includes(query) ||
          (task.provider && task.provider.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((task) => {
        switch (statusFilter) {
          case 'active':
            return task.state === 'downloading' || task.state === 'extracting' || task.state === 'paused';
          case 'queued':
            return task.state === 'queued';
          case 'done':
            return task.state === 'completed' || task.state === 'cancelled';
          case 'failed':
            return task.state === 'failed';
          default:
            return true;
        }
      });
    }

    return result;
  }, [tasks, queueSearchQuery, statusFilter]);

  // Group filtered tasks by state
  const groupedSections = useMemo(() => {
    return STATE_GROUPS.map((group) => ({
      key: group.key,
      label: t(`downloads.state.${group.key}`),
      tasks: filteredTasks.filter((task) =>
        (group.states as readonly string[]).includes(task.state)
      ),
    })).filter((section) => section.tasks.length > 0);
  }, [filteredTasks, t]);

  const hasQueueFilters = queueSearchQuery !== '' || statusFilter !== 'all';
  const selectedCount = selectedTaskIds.size;
  const showCheckbox = selectedCount > 0;

  // Stable callbacks for card props (avoid inline closures that defeat memo)
  const handleSelectChange = useCallback(
    (taskId: string, selected: boolean) => {
      if (selected) selectTask(taskId);
      else deselectTask(taskId);
    },
    [selectTask, deselectTask]
  );

  const handleOpenDetail = useCallback(
    (task: DownloadTask) => {
      setDetailTask(task);
      setDetailOpen(true);
    },
    []
  );

  const handleReuseTask = useCallback((task: DownloadTask) => {
    setDetailOpen(false);
    setInitialRequest(createTaskDownloadDraft(task));
    setAddDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!detailOpen || !detailTask || detailTask.state !== 'completed' || !isDesktop) {
      setDetailDestinationAvailable(false);
      return;
    }

    let cancelled = false;
    void checkDestinationAvailability(detailTask.destination)
      .then((available) => {
        if (!cancelled) {
          setDetailDestinationAvailable(Boolean(available));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkDestinationAvailability, detailOpen, detailTask, isDesktop]);

  const handleClearQueueFilters = useCallback(() => {
    setQueueSearchQuery('');
    setStatusFilter('all');
  }, []);

  // Drag & drop handlers
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

    const url =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text');

    if (url && /^https?:\/\//i.test(url.trim())) {
      setInitialRequest({ url: url.trim() });
      setAddDialogOpen(true);
    }
  }, []);

  // Clipboard URL listener
  useEffect(() => {
    const handleClipboardDownloadUrl = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail !== 'string' || !customEvent.detail.trim()) return;
      setInitialRequest({ url: customEvent.detail.trim() });
      setAddDialogOpen(true);
    };

    window.addEventListener('clipboard-download-url', handleClipboardDownloadUrl as EventListener);
    return () => {
      window.removeEventListener(
        'clipboard-download-url',
        handleClipboardDownloadUrl as EventListener
      );
    };
  }, []);

  // Handlers
  const handleAdd = useCallback(
    async (request: DownloadRequest) => {
      try {
        const pass = await runDownloadPreflightWithUi(
          { destinationPath: request.destination, checkDiskSpace },
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
    await pauseAll();
  }, [pauseAll]);

  const handleResumeAll = useCallback(async () => {
    await resumeAll();
  }, [resumeAll]);

  const handleCancelAll = useCallback(async () => {
    await cancelAll();
  }, [cancelAll]);

  const handleClearFinished = useCallback(async () => {
    const cleared = await clearFinished();
    if (cleared > 0) {
      toast.success(t('downloads.toast.cleared', { count: cleared }));
    }
  }, [clearFinished, t]);

  const handleRetryFailed = useCallback(async () => {
    await retryFailed();
  }, [retryFailed]);

  const handleApplySettings = useCallback(async () => {
    const inputValue = Number(speedLimitInput);
    const concurrent = Number(maxConcurrentInput);

    if (!Number.isNaN(inputValue)) {
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
    await batchPause();
    await Promise.all([refreshTasks(), refreshStats()]);
    deselectAllTasks();
  }, [batchPause, deselectAllTasks, refreshStats, refreshTasks, selectedCount]);

  const handleBatchResume = useCallback(async () => {
    if (selectedCount === 0) return;
    await batchResume();
    await Promise.all([refreshTasks(), refreshStats()]);
    deselectAllTasks();
  }, [batchResume, deselectAllTasks, refreshStats, refreshTasks, selectedCount]);

  const handleBatchCancel = useCallback(async () => {
    if (selectedCount === 0) return;
    await batchCancel();
    await Promise.all([refreshTasks(), refreshStats()]);
    deselectAllTasks();
  }, [batchCancel, deselectAllTasks, refreshStats, refreshTasks, selectedCount]);

  const handleBatchRemove = useCallback(async () => {
    if (selectedCount === 0) return;
    const count = await batchRemove();
    if (count > 0) {
      toast.success(t('downloads.toast.cleared', { count }));
      await refreshStats();
    }
    deselectAllTasks();
  }, [batchRemove, deselectAllTasks, refreshStats, selectedCount, t]);

  return (
    <div
      className="p-6 space-y-6 relative"
      data-hint="downloads-concurrent"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="text-center">
            <ArrowDownToLine className="h-12 w-12 mx-auto mb-2 text-primary animate-bounce" />
            <p className="text-lg font-medium text-primary">{t('downloads.dropUrl')}</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={t('downloads.title')}
        description={t('downloads.description')}
        actions={
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
        }
      />

      {/* Error alerts */}
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

      {/* Stats Strip */}
      <DownloadStatsStrip stats={queueStats} historyStats={historyStats} currentSpeed={currentSpeed} t={t} />

      {/* Toolbar */}
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
        settingsOpen={settingsOpen}
        onSettingsToggle={() => setSettingsOpen((prev) => !prev)}
        activeCount={activeCount}
        doneCount={doneCount}
        stats={queueStats}
        isLoading={isLoading}
        t={t}
      />

      {/* Collapsible Settings Panel */}
      <DownloadSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
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

      {/* Grouped Card List */}
      {filteredTasks.length === 0 ? (
        <DownloadEmptyState
          hasFilters={hasQueueFilters}
          onClearFilters={handleClearQueueFilters}
          t={t}
        />
      ) : (
        <div className="space-y-6">
          {groupedSections.map((section) => (
            <div key={section.key}>
              <DashboardSectionLabel className="uppercase tracking-wider">
                {section.label} ({section.tasks.length})
              </DashboardSectionLabel>
              <div className="space-y-2">
                {section.tasks.map((task) => (
                  <DownloadTaskCard
                    key={task.id}
                    task={task}
                    selected={selectedTaskIds.has(task.id)}
                    showCheckbox={showCheckbox}
                    onSelectedChange={(selected) => handleSelectChange(task.id, selected)}
                    onPause={pauseDownload}
                    onResume={resumeDownload}
                    onCancel={cancelDownload}
                    onRemove={removeDownload}
                    onRetry={retryTask}
                    onOpen={openFile}
                    onReveal={revealFile}
                    onDetail={handleOpenDetail}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Speed Chart */}
      <SpeedChart t={t} />

      {/* Dialogs */}
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
        destinationAvailable={detailDestinationAvailable}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRetry={retryTask}
        onSetPriority={setPriority}
        onReuseTask={handleReuseTask}
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
                { destinationPath: req.destination, checkDiskSpace },
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
