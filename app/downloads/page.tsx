'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/providers/locale-provider';
import { useDownloads } from '@/hooks/use-downloads';
import { isTauri } from '@/lib/tauri';
import {
  AddDownloadDialog,
  GitHubDownloadDialog,
  GitLabDownloadDialog,
  DownloadToolbar,
  DownloadEmptyState,
  type StatusFilter,
} from '@/components/downloads';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowDownToLine,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  Timer,
  Gauge,
  History,
  Github,
  Archive,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { formatEta } from '@/lib/utils';
import type { DownloadRequest, DownloadTask, HistoryRecord } from '@/lib/stores/download';

const EMPTY_STATS = {
  totalTasks: 0,
  queued: 0,
  downloading: 0,
  paused: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  totalBytes: 0,
  downloadedBytes: 0,
  totalHuman: '0 B',
  downloadedHuman: '0 B',
  overallProgress: 0,
};

function getStateBadgeVariant(state: DownloadTask['state']) {
  switch (state) {
    case 'completed':
      return 'default';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    case 'paused':
      return 'secondary';
    default:
      return 'outline';
  }
}

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
  const [maxConcurrentInput, setMaxConcurrentInput] = useState('4');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const {
    tasks,
    stats,
    history,
    historyStats,
    speedLimit,
    maxConcurrent,
    isLoading,
    error,
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
    openFile,
    revealFile,
    refreshTasks,
    refreshStats,
    refreshHistory,
    searchHistory,
    clearHistory,
    removeHistoryRecord,
  } = useDownloads();

  const queueStats = stats ?? EMPTY_STATS;

  useEffect(() => {
    setSpeedLimitInput(String(speedLimit));
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

  const handleClearQueueFilters = useCallback(() => {
    setQueueSearchQuery('');
    setStatusFilter('all');
  }, []);

  const handleAdd = useCallback(
    async (request: DownloadRequest) => {
      try {
        await addDownload(request);
        toast.success(t('downloads.toast.added'));
        await refreshTasks();
        await refreshStats();
      } catch (err) {
        toast.error(String(err));
      }
    },
    [addDownload, refreshTasks, refreshStats, t]
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
    const speed = Number(speedLimitInput);
    const concurrent = Number(maxConcurrentInput);

    if (!Number.isNaN(speed)) {
      await setSpeedLimit(speed);
      toast.success(
        speed > 0
          ? t('downloads.toast.speedLimitSet', { speed: `${speed} B/s` })
          : t('downloads.toast.speedLimitRemoved')
      );
    }

    if (!Number.isNaN(concurrent)) {
      await setMaxConcurrent(Math.max(1, concurrent));
    }
  }, [maxConcurrentInput, setMaxConcurrent, setSpeedLimit, speedLimitInput, t]);

  const historyStatsCard = useMemo(() => {
    if (!historyStats) return null;
    return [
      {
        label: t('downloads.historyPanel.totalDownloaded'),
        value: historyStats.totalBytesHuman,
        icon: <ArrowDownToLine className="h-4 w-4" />,
      },
      {
        label: t('downloads.historyPanel.averageSpeed'),
        value: historyStats.averageSpeedHuman,
        icon: <Gauge className="h-4 w-4" />,
      },
      {
        label: t('downloads.historyPanel.successRate'),
        value: `${historyStats.successRate}%`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      },
      {
        label: t('downloads.stats.total'),
        value: historyStats.totalCount,
        icon: <History className="h-4 w-4" />,
      },
    ];
  }, [historyStats, t]);

  return (
    <div className="p-6 space-y-6" data-hint="downloads-concurrent">
      <PageHeader
        title={t('downloads.title')}
        description={t('downloads.description')}
        actions={(
          <>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              {t('downloads.addDownload')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGithubDialogOpen(true)}>
              <Github className="h-4 w-4 mr-2" />
              {t('downloads.fromGitHub')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGitlabDialogOpen(true)}>
              <Archive className="h-4 w-4 mr-2" />
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
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
            onCancelAll={handleCancelAll}
            onClearFinished={handleClearFinished}
            onRetryFailed={handleRetryFailed}
            stats={queueStats}
            isLoading={isLoading}
            t={t}
          />

          <Card>
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
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                        <TableRow key={task.id}>
                          <TableCell className="min-w-[220px]">
                            <div className="space-y-1">
                              <p className="font-medium truncate" title={task.name}>
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
                                <span>{task.progress.totalHuman ?? '—'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{task.progress.speedHuman || '—'}</TableCell>
                          <TableCell>{formatEta(task.progress.etaHuman)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {task.state === 'downloading' || task.state === 'queued' ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => pauseDownload(task.id)}
                                  title={t('downloads.actions.pause')}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {task.state === 'paused' || task.state === 'failed' ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resumeDownload(task.id)}
                                  title={t('downloads.actions.resume')}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {task.state !== 'completed' && task.state !== 'cancelled' ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => cancelDownload(task.id)}
                                  title={t('downloads.actions.cancel')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {task.state === 'completed' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openFile(task.destination)}
                                    title={t('downloads.actions.open')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => revealFile(task.destination)}
                                    title={t('downloads.actions.reveal')}
                                  >
                                    <FolderOpen className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeDownload(task.id)}
                                title={t('downloads.actions.remove')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

          <Card>
            <CardHeader>
              <CardTitle>{t('downloads.settings.speedLimit')}</CardTitle>
              <CardDescription>{t('downloads.settings.speedLimitDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="speed-limit">{t('downloads.settings.speedLimit')}</Label>
                  <Input
                    id="speed-limit"
                    type="number"
                    min={0}
                    value={speedLimitInput}
                    onChange={(event) => setSpeedLimitInput(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {speedLimitInput === '0'
                      ? t('downloads.settings.unlimited')
                      : `${speedLimitInput} B/s`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-concurrent">{t('downloads.settings.maxConcurrent')}</Label>
                  <Input
                    id="max-concurrent"
                    type="number"
                    min={1}
                    value={maxConcurrentInput}
                    onChange={(event) => setMaxConcurrentInput(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('downloads.settings.maxConcurrentDesc')}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleApplySettings} disabled={!isDesktop}>
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('downloads.historyPanel.title')}</CardTitle>
                  <CardDescription>{t('downloads.historyPanel.search')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder={t('downloads.historyPanel.search')}
                    className="w-56"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearHistory()}
                    disabled={history.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('downloads.historyPanel.clear')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyStatsCard && (
                <div className="grid gap-4 md:grid-cols-4 mb-4">
                  {historyStatsCard.map((card) => (
                    <div
                      key={card.label}
                      className="flex items-center gap-2 rounded-lg border p-3"
                    >
                      <span className="text-muted-foreground">{card.icon}</span>
                      <div>
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-lg font-semibold">{card.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm font-medium">{t('downloads.noHistory')}</p>
                  <p className="text-xs">{t('downloads.noHistoryDesc')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('downloads.name')}</TableHead>
                        <TableHead>{t('downloads.status')}</TableHead>
                        <TableHead>{t('downloads.historyPanel.duration')}</TableHead>
                        <TableHead>{t('downloads.historyPanel.averageSpeed')}</TableHead>
                        <TableHead>{t('downloads.progress.total')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="min-w-[220px]">
                            <div className="space-y-1">
                              <p className="font-medium truncate" title={record.filename}>
                                {record.filename}
                              </p>
                              <p className="text-xs text-muted-foreground truncate" title={record.url}>
                                {record.url}
                              </p>
                              {record.error && (
                                <p className="text-xs text-destructive">{record.error}</p>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeHistoryRecord(record.id)}
                              title={t('downloads.actions.remove')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddDownloadDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAdd}
      />

      <GitHubDownloadDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        onDownloadStarted={() => {
          refreshTasks();
          refreshStats();
        }}
      />

      <GitLabDownloadDialog
        open={gitlabDialogOpen}
        onOpenChange={setGitlabDialogOpen}
        onDownloadStarted={() => {
          refreshTasks();
          refreshStats();
        }}
      />
    </div>
  );
}
