'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useWsl } from '@/hooks/use-wsl';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { useWslStore } from '@/lib/stores/wsl';
import {
  WslStatusCard,
  WslDistroCard,
  WslOnlineList,
  WslImportDialog,
  WslExportDialog,
  WslEmptyState,
  WslNotAvailable,
  WslConfigCard,
  WslDistroConfigCard,
  WslExecTerminal,
  WslChangeUserDialog,
  WslMountDialog,
  WslImportInPlaceDialog,
  WslInstallLocationDialog,
  WslCloneDialog,
  WslBackupCard,
  WslBatchWorkflowCard,
  WslBatchWorkflowPreviewDialog,
  WslBatchWorkflowSummaryCard,
} from '@/components/wsl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertCircle,
  Upload,
  RefreshCw,
  ArrowUpCircle,
  Info,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { PRESET_COMMANDS } from '@/lib/constants/wsl';
import { formatBytes } from '@/lib/utils';
import type { WslImportOptions, WslMountOptions, WslTotalDiskUsage, WslVersionInfo } from '@/types/tauri';
import type {
  WslAssistanceActionDescriptor,
  WslAssistanceSummary,
  WslBatchWorkflowPreflight,
  WslBatchWorkflowPreset,
  WslBatchWorkflowSummary,
} from '@/types/wsl';
import {
  buildWslBatchWorkflowPreflight,
  buildWslDistroHref,
  buildWslOverviewHref,
  normalizeWslBatchWorkflowPreset,
  normalizeSelectedDistros,
  readWslOverviewContext,
  summarizeBatchResults,
} from '@/lib/wsl/workflow';

interface WslLifecycleFeedback {
  status: 'running' | 'success' | 'failed';
  title: string;
  details?: string;
}

function createWorkflowDraft(t: (key: string, params?: Record<string, string | number>) => string): WslBatchWorkflowPreset {
  const timestamp = new Date().toISOString();
  const defaultCommand = PRESET_COMMANDS[0];
  return {
    id: 'workflow-draft',
    name: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    target: { mode: 'selected' },
    steps: [{
      id: 'command-1',
      kind: 'command',
      command: defaultCommand?.command ?? '',
      user: defaultCommand?.user,
      savedCommandId: defaultCommand?.id,
      label: defaultCommand?.name ?? t('wsl.batchWorkflow.command'),
    }],
  };
}

interface WslOverviewSummaryBandProps {
  summaryActions: ReactNode;
  distrosCount: number;
  runningCount: number;
  defaultDistro: string | null;
  totalDiskUsage: WslTotalDiskUsage | null;
  completenessHint: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function WslSupportGroup({
  testId,
  title,
  description,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="space-y-3">
      <div className="space-y-1 px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function WslOverviewSummaryBand({
  summaryActions,
  distrosCount,
  runningCount,
  defaultDistro,
  totalDiskUsage,
  completenessHint,
  t,
}: WslOverviewSummaryBandProps) {
  const summaryStats = [
    {
      label: t('wsl.distros'),
      value: String(distrosCount),
      hint: t('wsl.distros'),
    },
    {
      label: t('wsl.runningDistros'),
      value: String(runningCount),
      hint: t(runningCount > 0 ? 'wsl.running' : 'wsl.noRunning'),
    },
    {
      label: t('wsl.defaultDistribution'),
      value: defaultDistro ?? '—',
      hint: t('wsl.setDefault'),
    },
    {
      label: t('wsl.totalDiskUsage'),
      value: totalDiskUsage ? formatBytes(totalDiskUsage.totalBytes) : '—',
      hint: t('wsl.versionInfo'),
    },
  ];

  return (
    <section data-testid="wsl-summary-band">
      <Card className="border-border/60 bg-card/50 py-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">{t('wsl.summaryTitle')}</CardTitle>
          <CardDescription>{t('wsl.summaryDesc')}</CardDescription>
          <CardAction
            data-testid="wsl-summary-actions"
            className="flex flex-wrap items-center justify-end gap-2"
          >
            {summaryActions}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {summaryStats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/60 bg-background/60 p-3"
              >
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-2 truncate text-lg font-semibold">{item.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.hint}</p>
              </div>
            ))}
          </div>
          {completenessHint && (
            <Alert>
              <AlertDescription>{completenessHint}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default function WslPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    available,
    distros,
    onlineDistros,
    status,
    capabilities,
    runtimeSnapshot,
    runtimeInfo,
    completeness,
    loading,
    error,
    checkAvailability,
    refreshDistros,
    refreshOnlineDistros,
    refreshStatus,
    refreshAll,
    terminate,
    shutdown,
    setDefault,
    setVersion,
    setDefaultVersion,
    exportDistro,
    importDistro,
    importInPlace,
    updateWsl,
    launch,
    config,
    execCommand,
    refreshConfig,
    setConfigValue,
    getDiskUsage,
    mountDisk,
    unmountDisk,
    getIpAddress,
    changeDefaultUser,
    getDistroConfig,
    setDistroConfigValue,
    installWslOnly,
    listUsers,
    installOnlineDistro,
    unregisterDistro,
    installWithLocation,
    getVersionInfo,
    refreshRuntimeInfo,
    getTotalDiskUsage,
    openInExplorer,
    openInTerminal,
    cloneDistro,
    batchLaunch,
    batchTerminate,
    runBatchWorkflow,
    retryBatchWorkflowFailures,
    backupDistro,
    listBackups,
    restoreBackup,
    deleteBackup,
    getAssistanceActions,
    executeAssistanceAction,
    mapErrorToAssistance,
  } = useWsl();

  const initializedRef = useRef(false);
  const retryActionRef = useRef<(() => void) | null>(null);
  const workflowDraftRef = useRef<WslBatchWorkflowPreset | null>(null);
  const {
    distroTags,
    availableTags,
    savedCommands,
    workflowPresets,
    workflowSummaries,
    addWorkflowPreset,
    updateWorkflowPreset,
    removeWorkflowPreset,
    recordWorkflowSummary,
    overviewContext,
    setOverviewContext,
  } = useWslStore();
  const initialOverviewContext = useMemo(
    () => readWslOverviewContext(searchParams, overviewContext),
    [overviewContext, searchParams]
  );
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>(initialOverviewContext.tab);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDistroName, setExportDistroName] = useState('');
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'unregister'; name: string }
    | { type: 'shutdown' }
    | { type: 'mount'; options: WslMountOptions }
    | { type: 'unmount'; diskPath?: string }
    | { type: 'assistance'; actionId: string; origin: 'panel' | 'error' }
    | null
  >(null);
  const [selectedDistroForConfig, setSelectedDistroForConfig] = useState<string | null>(null);
  const [changeUserOpen, setChangeUserOpen] = useState(false);
  const [changeUserDistro, setChangeUserDistro] = useState('');
  const [mountDialogOpen, setMountDialogOpen] = useState(false);
  const [importInPlaceOpen, setImportInPlaceOpen] = useState(false);
  const [installLocationDialogOpen, setInstallLocationDialogOpen] = useState(false);
  const [installLocationDistroName, setInstallLocationDistroName] = useState('');
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceDistro, setCloneSourceDistro] = useState('');
  const [legacyVersionInfo, setLegacyVersionInfo] = useState<WslVersionInfo | null>(null);
  const [totalDiskUsage, setTotalDiskUsage] = useState<WslTotalDiskUsage | null>(null);
  const [showAllDiskUsage, setShowAllDiskUsage] = useState(false);
  const [sidebarMetaLoading, setSidebarMetaLoading] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(initialOverviewContext.tag);
  const [selectedDistros, setSelectedDistros] = useState<Set<string>>(new Set());
  const [runningAssistanceId, setRunningAssistanceId] = useState<string | null>(null);
  const [assistanceSummary, setAssistanceSummary] = useState<WslAssistanceSummary | null>(null);
  const [assistanceOrigin, setAssistanceOrigin] = useState<'panel' | 'error' | null>(null);
  const [lifecycleFeedback, setLifecycleFeedback] = useState<WslLifecycleFeedback | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<WslBatchWorkflowPreset>(() => createWorkflowDraft(t));
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowPreview, setWorkflowPreview] = useState<WslBatchWorkflowPreflight | null>(null);
  const [workflowPreviewOpen, setWorkflowPreviewOpen] = useState(false);
  const [workflowPreviewCandidate, setWorkflowPreviewCandidate] = useState<WslBatchWorkflowPreset | null>(null);
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const runtimeInfoSnapshot = runtimeInfo ?? null;
  const refreshRuntimeInfoAction = useCallback(async () => {
    if (refreshRuntimeInfo) {
      return await refreshRuntimeInfo();
    }
    await refreshStatus();
    return runtimeInfoSnapshot;
  }, [refreshRuntimeInfo, refreshStatus, runtimeInfoSnapshot]);
  const versionInfo = runtimeInfoSnapshot?.versionInfo?.data ?? legacyVersionInfo;

  useEffect(() => {
    workflowDraftRef.current = workflowDraft;
  }, [workflowDraft]);

  // Auto-dismiss success lifecycle feedback after 5 seconds
  useEffect(() => {
    if (lifecycleFeedback?.status !== 'success') return;
    const timer = setTimeout(() => {
      setLifecycleFeedback(null);
      retryActionRef.current = null;
    }, 5000);
    return () => clearTimeout(timer);
  }, [lifecycleFeedback]);

  const filteredDistros = activeTagFilter
    ? distros.filter((d) => (distroTags[d.name] ?? []).includes(activeTagFilter))
    : distros;
  const completenessHint = useMemo(() => {
    if (runtimeSnapshot?.state === 'degraded') {
      return runtimeSnapshot.degradedReasons[0]
        ?? runtimeSnapshot.reason
        ?? t('wsl.runtimeDegradedHint');
    }
    if (runtimeSnapshot?.state === 'unavailable') {
      return runtimeSnapshot.reason || t('wsl.runtimeUnavailableHint');
    }
    if (completeness.state === 'degraded') {
      return completeness.degradedReasons[0] ?? t('wsl.runtimeDegradedHint');
    }
    return null;
  }, [completeness.degradedReasons, completeness.state, runtimeSnapshot, t]);
  const runtimeAssistanceActions = getAssistanceActions('runtime');
  const batchAssistanceActions = useMemo(() => {
    const referenceDistro = filteredDistros[0]?.name ?? distros[0]?.name;
    return referenceDistro ? getAssistanceActions('distro', referenceDistro) : [];
  }, [distros, filteredDistros, getAssistanceActions]);
  const workflowCommandOptions = useMemo(
    () => [...PRESET_COMMANDS, ...savedCommands],
    [savedCommands]
  );

  const assistanceActionById = runtimeAssistanceActions.reduce<Record<string, WslAssistanceActionDescriptor>>(
    (acc, action) => {
      acc[action.id] = action;
      return acc;
    },
    {}
  );

  const refreshSidebarMeta = useCallback(async () => {
    if (!isDesktop) return;
    setSidebarMetaLoading(true);
    try {
      if (!runtimeInfoSnapshot && getVersionInfo) {
        setLegacyVersionInfo(await getVersionInfo());
      }
      const totalUsage = await getTotalDiskUsage();
      setTotalDiskUsage(totalUsage);
    } finally {
      setSidebarMetaLoading(false);
    }
  }, [getTotalDiskUsage, getVersionInfo, isDesktop, runtimeInfoSnapshot]);

  const syncOverviewContext = useCallback((nextTab: 'installed' | 'available', nextTag: string | null) => {
    const href = buildWslOverviewHref({ tab: nextTab, tag: nextTag, origin: 'overview' });
    setOverviewContext({ tab: nextTab, tag: nextTag, origin: 'overview' });
    if (typeof window !== 'undefined' && pathname === '/wsl') {
      window.history.replaceState(null, '', href);
    }
    return href;
  }, [pathname, setOverviewContext]);

  // Keep selected per-distro config target valid when distros change
  useEffect(() => {
    if (distros.length === 0) {
      setSelectedDistroForConfig(null);
      return;
    }

    const selectedIsValid = selectedDistroForConfig
      ? distros.some((d) => d.name === selectedDistroForConfig)
      : false;

    if (!selectedIsValid) {
      setSelectedDistroForConfig(distros[0].name);
    }
  }, [distros, selectedDistroForConfig]);

  useEffect(() => {
    if (!totalDiskUsage) {
      setShowAllDiskUsage(false);
      return;
    }
    if (totalDiskUsage.perDistro.length <= 3 && showAllDiskUsage) {
      setShowAllDiskUsage(false);
    }
  }, [showAllDiskUsage, totalDiskUsage]);

  useEffect(() => {
    const nextContext = readWslOverviewContext(searchParams, overviewContext);
    if (nextContext.tab !== activeTab) {
      setActiveTab(nextContext.tab);
    }
    if (nextContext.tag !== activeTagFilter) {
      setActiveTagFilter(nextContext.tag);
    }
  }, [activeTab, activeTagFilter, overviewContext, searchParams]);

  useEffect(() => {
    if (activeTagFilter && !availableTags.includes(activeTagFilter)) {
      setActiveTagFilter(null);
      syncOverviewContext(activeTab, null);
    }
  }, [activeTab, activeTagFilter, availableTags, syncOverviewContext]);

  useEffect(() => {
    setSelectedDistros((prev) => normalizeSelectedDistros(prev, filteredDistros));
  }, [filteredDistros]);

  useEffect(() => {
    if (activeTab !== 'installed' && selectedDistros.size > 0) {
      setSelectedDistros(new Set());
    }
  }, [activeTab, selectedDistros]);

  useEffect(() => {
    setOverviewContext({ tab: activeTab, tag: activeTagFilter, origin: 'overview' });
  }, [activeTab, activeTagFilter, setOverviewContext]);

  // Initialize on mount
  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const isAvailable = await checkAvailability();
      if (isAvailable) {
        await Promise.all([refreshAll(), refreshSidebarMeta()]);
      }
    };
    init();
  }, [isDesktop, checkAvailability, refreshAll, refreshSidebarMeta]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'installed') {
      await Promise.all([refreshRuntimeInfoAction(), refreshDistros(), refreshSidebarMeta()]);
    } else {
      await refreshOnlineDistros();
    }
  }, [activeTab, refreshDistros, refreshOnlineDistros, refreshRuntimeInfoAction, refreshSidebarMeta]);

  const setRunningFeedback = useCallback((action: string, retry?: () => void) => {
    retryActionRef.current = retry ?? null;
    setLifecycleFeedback({
      status: 'running',
      title: t('wsl.workflow.running').replace('{action}', action),
    });
  }, [t]);

  const setSuccessFeedback = useCallback((action: string, details?: string) => {
    retryActionRef.current = null;
    setLifecycleFeedback({
      status: 'success',
      title: t('wsl.workflow.success').replace('{action}', action),
      details,
    });
  }, [t]);

  const setFailedFeedback = useCallback((action: string, errorMessage: string, retry?: () => void) => {
    retryActionRef.current = retry ?? null;
    setLifecycleFeedback({
      status: 'failed',
      title: t('wsl.workflow.failed').replace('{action}', action),
      details: errorMessage,
    });
  }, [t]);

  const handleInstallOnline = useCallback(async (name: string) => {
    setRunningFeedback(t('wsl.install').replace('{name}', name), () => {
      void handleInstallOnline(name);
    });
    try {
      await installOnlineDistro(name);
      toast.success(t('wsl.installSuccess').replace('{name}', name));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.install').replace('{name}', name), name);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.install').replace('{name}', name), String(err), () => {
        void handleInstallOnline(name);
      });
    }
  }, [installOnlineDistro, refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleOpenInstallWithLocation = useCallback((name: string) => {
    setInstallLocationDistroName(name);
    setInstallLocationDialogOpen(true);
  }, []);

  const handleInstallWithLocation = useCallback(async (name: string, location: string) => {
    setRunningFeedback(t('wsl.installWithLocation'), () => {
      void handleInstallWithLocation(name, location);
    });
    try {
      await installWithLocation(name, location);
      toast.success(t('wsl.installWithLocationSuccess').replace('{name}', name));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.installWithLocation'), location);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.installWithLocation'), String(err), () => {
        void handleInstallWithLocation(name, location);
      });
    }
  }, [installWithLocation, refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleLaunch = useCallback(async (name: string) => {
    setRunningFeedback(t('wsl.launch').replace('{name}', name), () => {
      void handleLaunch(name);
    });
    try {
      await launch(name);
      toast.success(t('wsl.launchSuccess').replace('{name}', name));
      setSuccessFeedback(t('wsl.launch').replace('{name}', name), name);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.launch').replace('{name}', name), String(err), () => {
        void handleLaunch(name);
      });
    }
  }, [launch, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleTerminate = useCallback(async (name: string) => {
    setRunningFeedback(t('wsl.terminate').replace('{name}', name), () => {
      void handleTerminate(name);
    });
    try {
      await terminate(name);
      toast.success(t('wsl.terminateSuccess').replace('{name}', name));
      setSuccessFeedback(t('wsl.terminate').replace('{name}', name), name);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.terminate').replace('{name}', name), String(err), () => {
        void handleTerminate(name);
      });
    }
  }, [setFailedFeedback, setRunningFeedback, setSuccessFeedback, t, terminate]);

  const handleShutdown = useCallback(async () => {
    setRunningFeedback(t('wsl.shutdown'), () => {
      void handleShutdown();
    });
    try {
      await shutdown();
      toast.success(t('wsl.shutdownSuccess'));
      setSuccessFeedback(t('wsl.shutdown'));
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.shutdown'), String(err), () => {
        void handleShutdown();
      });
    }
  }, [setFailedFeedback, setRunningFeedback, setSuccessFeedback, shutdown, t]);

  const handleSetDefault = useCallback(async (name: string) => {
    try {
      await setDefault(name);
      toast.success(t('wsl.setDefaultSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefault, t]);

  const handleSetVersion = useCallback(async (name: string, version: number) => {
    try {
      await setVersion(name, version);
      toast.success(
        t('wsl.setVersionSuccess')
          .replace('{name}', name)
          .replace('{version}', String(version))
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [setVersion, t]);

  const handleExportOpen = useCallback((name: string) => {
    setExportDistroName(name);
    setExportOpen(true);
  }, []);

  const buildExportErrorMessage = useCallback((err: unknown) => {
    const message = String(err);
    const lower = message.toLowerCase();
    if (lower.includes('access is denied') || lower.includes('permission denied')) {
      return t('wsl.exportErrorPermission');
    }
    if (
      lower.includes('unknown option')
      || lower.includes('invalid option')
      || lower.includes('not supported')
      || lower.includes('未识别')
      || lower.includes('不支持')
    ) {
      return t('wsl.exportErrorUnsupported');
    }
    return t('wsl.exportErrorGeneric').replace('{error}', message);
  }, [t]);

  const handleExport = useCallback(async (name: string, filePath: string, asVhd: boolean) => {
    try {
      await exportDistro(name, filePath, asVhd);
      toast.success(t('wsl.exportSuccess').replace('{name}', name));
    } catch (err) {
      toast.error(buildExportErrorMessage(err));
      throw err;
    }
  }, [buildExportErrorMessage, exportDistro, t]);

  const handleImport = useCallback(async (options: WslImportOptions) => {
    setRunningFeedback(t('wsl.import').replace('{name}', options.name), () => {
      void handleImport(options);
    });
    try {
      await importDistro(options);
      toast.success(t('wsl.importSuccess').replace('{name}', options.name));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.import').replace('{name}', options.name), options.name);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.import').replace('{name}', options.name), String(err), () => {
        void handleImport(options);
      });
    }
  }, [importDistro, refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleInstallWslOnly = useCallback(async () => {
    setRunningFeedback(t('wsl.installWslOnly'));
    const result = await installWslOnly();
    const nowAvailable = await checkAvailability();
    if (nowAvailable) {
      await Promise.all([refreshAll(), refreshSidebarMeta()]);
    }
    setSuccessFeedback(t('wsl.installWslOnly'), result);
    return result;
  }, [checkAvailability, installWslOnly, refreshAll, refreshSidebarMeta, setRunningFeedback, setSuccessFeedback, t]);

  const handleSetDefaultVersion = useCallback(async (version: number) => {
    try {
      await setDefaultVersion(version);
      toast.success(t('wsl.setDefaultVersionSuccess').replace('{version}', String(version)));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefaultVersion, t]);

  const handleImportInPlaceConfirm = useCallback(async (name: string, vhdxPath: string) => {
    setRunningFeedback(t('wsl.importInPlace').replace('{name}', name), () => {
      void handleImportInPlaceConfirm(name, vhdxPath);
    });
    try {
      await importInPlace(name, vhdxPath);
      toast.success(t('wsl.importInPlaceSuccess').replace('{name}', name));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.importInPlace').replace('{name}', name), vhdxPath);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.importInPlace').replace('{name}', name), String(err), () => {
        void handleImportInPlaceConfirm(name, vhdxPath);
      });
    }
  }, [importInPlace, refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleMount = useCallback(async (options: WslMountOptions) => {
    setRunningFeedback(t('wsl.mount'));
    try {
      const result = await mountDisk(options);
      toast.success(t('wsl.mountSuccess') + (result ? `\n${result}` : ''));
      setSuccessFeedback(t('wsl.mount'), result);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.mount'), String(err));
    }
  }, [mountDisk, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleUnmount = useCallback(async (diskPath?: string) => {
    setRunningFeedback(t('wsl.unmount'));
    try {
      await unmountDisk(diskPath);
      toast.success(t('wsl.unmountSuccess'));
      setSuccessFeedback(t('wsl.unmount'), diskPath);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.unmount'), String(err));
    }
  }, [setFailedFeedback, setRunningFeedback, setSuccessFeedback, t, unmountDisk]);

  const handleMountConfirm = useCallback(async (options: WslMountOptions) => {
    setConfirmAction({ type: 'mount', options });
    return '';
  }, []);

  const handleUnmountPrompt = useCallback(() => {
    // For unmount, a simple confirm dialog is sufficient since it's just an optional path
    setConfirmAction({ type: 'unmount', diskPath: undefined });
  }, []);

  const handleUnregister = useCallback(async (name: string) => {
    setRunningFeedback(t('wsl.unregister').replace('{name}', name), () => {
      void handleUnregister(name);
    });
    try {
      await unregisterDistro(name);
      toast.success(t('wsl.unregisterSuccess').replace('{name}', name));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.unregister').replace('{name}', name), name);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.unregister').replace('{name}', name), String(err), () => {
        void handleUnregister(name);
      });
    }
  }, [refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t, unregisterDistro]);

  const handleChangeDefaultUserOpen = useCallback((name: string) => {
    setChangeUserDistro(name);
    setChangeUserOpen(true);
  }, []);

  const handleChangeDefaultUserConfirm = useCallback(async (distro: string, username: string) => {
    try {
      await changeDefaultUser(distro, username);
      toast.success(
        t('wsl.changeDefaultUserSuccess')
          .replace('{name}', distro)
          .replace('{user}', username)
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [changeDefaultUser, t]);

  const handleUpdate = useCallback(async () => {
    setRunningFeedback(t('wsl.update'), () => {
      void handleUpdate();
    });
    try {
      const result = await updateWsl();
      toast.success(t('wsl.updateSuccess') + (result ? `\n${result}` : ''));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.update'), result);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.update'), String(err), () => {
        void handleUpdate();
      });
    }
  }, [refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t, updateWsl]);

  const handleOpenInExplorer = useCallback(async (name: string) => {
    try {
      await openInExplorer(name);
      toast.success(t('wsl.openInExplorer'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [openInExplorer, t]);

  const handleOpenInTerminal = useCallback(async (name: string) => {
    try {
      await openInTerminal(name);
      toast.success(t('wsl.openInTerminal'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [openInTerminal, t]);

  const handleCloneOpen = useCallback((name: string) => {
    setCloneSourceDistro(name);
    setCloneDialogOpen(true);
  }, []);

  const handleCloneConfirm = useCallback(async (name: string, newName: string, location: string) => {
    setRunningFeedback(t('wsl.clone').replace('{name}', newName), () => {
      void handleCloneConfirm(name, newName, location);
    });
    try {
      const result = await cloneDistro(name, newName, location);
      toast.success(t('wsl.cloneSuccess').replace('{name}', newName) + (result ? `\n${result}` : ''));
      await refreshSidebarMeta();
      setSuccessFeedback(t('wsl.clone').replace('{name}', newName), result);
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.clone').replace('{name}', newName), String(err), () => {
        void handleCloneConfirm(name, newName, location);
      });
    }
  }, [cloneDistro, refreshSidebarMeta, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const runAssistanceAction = useCallback(async (actionId: string, origin: 'panel' | 'error') => {
    setRunningAssistanceId(actionId);
    setAssistanceOrigin(origin);
    try {
      const summary = await executeAssistanceAction(actionId, 'runtime');
      setAssistanceSummary(summary);
      if (summary.status === 'success') {
        toast.success(summary.title);
        await refreshSidebarMeta();
        setSuccessFeedback(summary.title, summary.details);
      } else {
        toast.error(summary.details ?? summary.title);
        setFailedFeedback(summary.title, summary.details ?? summary.title);
      }
    } finally {
      setRunningAssistanceId(null);
    }
  }, [executeAssistanceAction, refreshSidebarMeta, setFailedFeedback, setSuccessFeedback]);

  const handleAssistanceAction = useCallback((actionId: string, origin: 'panel' | 'error' = 'panel') => {
    const action = assistanceActionById[actionId];
    if (!action) return;
    if (!action.supported) {
      toast.error(action.blockedReason ?? t('wsl.assistance.blocked'));
      return;
    }
    if (action.risk === 'high') {
      setConfirmAction({ type: 'assistance', actionId, origin });
      return;
    }
    void runAssistanceAction(actionId, origin);
  }, [assistanceActionById, runAssistanceAction, t]);

  const handleBatchLaunch = useCallback(async () => {
    if (selectedDistros.size === 0) return;
    setRunningFeedback(t('wsl.batch.launch'));
    try {
      const results = await batchLaunch(Array.from(selectedDistros));
      const summary = summarizeBatchResults(results);
      const failed = results.filter(([, ok]) => !ok);
      if (failed.length === 0) {
        toast.success(t('wsl.batch.launchSuccess').replace('{count}', String(results.length)));
      } else {
        toast.warning(t('wsl.batch.partialFail').replace('{failed}', String(failed.length)).replace('{total}', String(results.length)));
      }
      setSelectedDistros(new Set());
      setSuccessFeedback(t('wsl.batch.launch'), summary.details.join('\n'));
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.batch.launch'), String(err), () => {
        void handleBatchLaunch();
      });
    }
  }, [batchLaunch, selectedDistros, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const handleBatchTerminate = useCallback(async () => {
    if (selectedDistros.size === 0) return;
    setRunningFeedback(t('wsl.batch.terminate'));
    try {
      const results = await batchTerminate(Array.from(selectedDistros));
      const summary = summarizeBatchResults(results);
      const failed = results.filter(([, ok]) => !ok);
      if (failed.length === 0) {
        toast.success(t('wsl.batch.terminateSuccess').replace('{count}', String(results.length)));
      } else {
        toast.warning(t('wsl.batch.partialFail').replace('{failed}', String(failed.length)).replace('{total}', String(results.length)));
      }
      setSelectedDistros(new Set());
      setSuccessFeedback(t('wsl.batch.terminate'), summary.details.join('\n'));
    } catch (err) {
      toast.error(String(err));
      setFailedFeedback(t('wsl.batch.terminate'), String(err), () => {
        void handleBatchTerminate();
      });
    }
  }, [batchTerminate, selectedDistros, setFailedFeedback, setRunningFeedback, setSuccessFeedback, t]);

  const toggleSelectDistro = useCallback((name: string) => {
    setSelectedDistros((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedDistros((prev) => {
      if (prev.size === filteredDistros.length) return new Set();
      return new Set(filteredDistros.map((d) => d.name));
    });
  }, [filteredDistros]);

  const handleWorkflowDraftChange = useCallback((nextDraft: WslBatchWorkflowPreset) => {
    const normalizedDraft = normalizeWslBatchWorkflowPreset(nextDraft);
    workflowDraftRef.current = normalizedDraft;
    setWorkflowDraft(normalizedDraft);
  }, []);

  const openWorkflowPreview = useCallback((workflow: WslBatchWorkflowPreset) => {
    const preview = buildWslBatchWorkflowPreflight({
      workflow,
      distros,
      selectedDistros,
      distroTags,
      capabilities,
      resolveAssistanceAction: (distroName, actionId) =>
        getAssistanceActions('distro', distroName).find((action) => action.id === actionId),
    });
    setWorkflowPreview(preview);
    setWorkflowPreviewCandidate(workflow);
    setWorkflowPreviewOpen(true);
  }, [capabilities, distros, distroTags, getAssistanceActions, selectedDistros]);

  const handleSaveWorkflowPreset = useCallback(() => {
    const activeDraft = normalizeWslBatchWorkflowPreset(workflowDraftRef.current ?? workflowDraft);
    const trimmedName = activeDraft.name.trim();
    if (!trimmedName) {
      toast.error(t('wsl.batchWorkflow.nameRequired'));
      return;
    }

    if (editingWorkflowId) {
      updateWorkflowPreset(editingWorkflowId, {
        name: trimmedName,
        target: activeDraft.target,
        steps: activeDraft.steps,
      });
    } else {
      addWorkflowPreset({
        name: trimmedName,
        target: activeDraft.target,
        steps: activeDraft.steps,
      });
    }

    setEditingWorkflowId(null);
    const resetDraft = createWorkflowDraft(t);
    workflowDraftRef.current = resetDraft;
    setWorkflowDraft(resetDraft);
  }, [addWorkflowPreset, editingWorkflowId, t, updateWorkflowPreset, workflowDraft]);

  const handleRunWorkflowDraft = useCallback(() => {
    openWorkflowPreview(workflowDraftRef.current ?? workflowDraft);
  }, [openWorkflowPreview, workflowDraft]);

  const handleEditWorkflowPreset = useCallback((preset: WslBatchWorkflowPreset) => {
    setEditingWorkflowId(preset.id);
    const normalizedPreset = normalizeWslBatchWorkflowPreset(preset);
    workflowDraftRef.current = normalizedPreset;
    setWorkflowDraft(normalizedPreset);
  }, []);

  const handleRunWorkflowPreset = useCallback((preset: WslBatchWorkflowPreset) => {
    openWorkflowPreview(preset);
  }, [openWorkflowPreview]);

  const handleConfirmWorkflowRun = useCallback(async () => {
    if (!workflowPreviewCandidate) return;

    setWorkflowRunning(true);
    try {
      const summary = await runBatchWorkflow(workflowPreviewCandidate, {
        selectedDistros,
        distroTags,
      });
      recordWorkflowSummary(summary);
      setWorkflowPreviewOpen(false);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setWorkflowRunning(false);
    }
  }, [distroTags, recordWorkflowSummary, runBatchWorkflow, selectedDistros, workflowPreviewCandidate]);

  const handleRetryWorkflowSummary = useCallback(async (summary?: WslBatchWorkflowSummary | null) => {
    const activeSummary = summary ?? workflowSummaries[0] ?? null;
    if (!activeSummary) return;

    setWorkflowRunning(true);
    try {
      const retriedSummary = await retryBatchWorkflowFailures(activeSummary, { distroTags });
      recordWorkflowSummary(retriedSummary);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setWorkflowRunning(false);
    }
  }, [distroTags, recordWorkflowSummary, retryBatchWorkflowFailures, workflowSummaries]);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'unregister') {
      await handleUnregister(confirmAction.name);
    } else if (confirmAction.type === 'shutdown') {
      await handleShutdown();
    } else if (confirmAction.type === 'mount') {
      await handleMount(confirmAction.options);
    } else if (confirmAction.type === 'unmount') {
      await handleUnmount(confirmAction.diskPath);
    } else if (confirmAction.type === 'assistance') {
      await runAssistanceAction(confirmAction.actionId, confirmAction.origin);
    }
    setConfirmAction(null);
  }, [confirmAction, handleMount, handleShutdown, handleUnmount, handleUnregister, runAssistanceAction]);

  const importInPlaceUnsupported = capabilities?.importInPlace === false;
  const importInPlaceHint = importInPlaceUnsupported
    ? `${t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.importInPlace'))
        .replace('{version}', capabilities?.version ?? 'Unknown')} ${t('wsl.runtimeUnsupportedHint')}`
    : null;
  const runtimeErrorSuggestions = error
    ? mapErrorToAssistance(error, 'runtime')
    : [];
  const assistanceGroups: Array<'check' | 'repair' | 'maintenance'> = ['check', 'repair', 'maintenance'];
  const desktopLayoutClass =
    'grid gap-6 xl:gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]';
  const defaultDistroName = status?.defaultDistribution
    ?? distros.find((distro) => distro.isDefault)?.name
    ?? null;
  const runningCount = status?.runningDistros.length ?? completeness.runningCount;
  const summaryActions = (
    <>
      <Button variant="outline" size="sm" onClick={handleUpdate} className="gap-2 whitespace-nowrap">
        <ArrowUpCircle className="h-4 w-4" />
        {t('wsl.update')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setImportOpen(true)}
        className="gap-2 whitespace-nowrap"
      >
        <Upload className="h-4 w-4" />
        {t('wsl.import')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRefresh}
        disabled={loading || available !== true}
        className="h-8 w-8 shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </>
  );

  // Non-Tauri fallback
  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title={t('wsl.title')} description={t('wsl.description')} />
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('wsl.notAvailable')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('wsl.title')}
        description={t('wsl.description')}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            {runtimeErrorSuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">{t('wsl.assistance.suggestedActions')}</p>
                <div className="flex flex-wrap gap-2">
                  {runtimeErrorSuggestions.map((suggestion) => {
                    const action = assistanceActionById[suggestion.actionId];
                    if (!action || !action.supported) return null;
                    return (
                      <Button
                        key={`${suggestion.actionId}-${suggestion.reason}`}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleAssistanceAction(suggestion.actionId, 'error')}
                      >
                        {t(action.labelKey)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div data-testid="wsl-page-content" className="space-y-6">
        {available === false && (
          <section data-testid="wsl-summary-band" className="space-y-4">
            <div data-testid="wsl-summary-actions" className="hidden" aria-hidden="true">
              {summaryActions}
            </div>
            <section data-testid="wsl-not-available" className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5">
              <WslNotAvailable t={t} onInstallWsl={handleInstallWslOnly} />
            </section>
          </section>
        )}

        {/* Loading skeleton before WSL availability is resolved */}
        {available === null && (
          <>
            <section
              data-testid="wsl-summary-band"
              className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]"
            >
              <Card className="border-dashed py-0">
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-64" />
                  <CardAction data-testid="wsl-summary-actions" className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-3 pb-6 sm:grid-cols-2 2xl:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-xl border border-dashed p-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="mt-3 h-6 w-20" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="grid gap-4">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            </section>
            <div data-testid="wsl-layout-grid" className={desktopLayoutClass}>
              <section data-testid="wsl-primary-region" className="space-y-4">
                <Card className="border-dashed">
                  <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="w-full space-y-2">
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-4 w-36" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
              <aside data-testid="wsl-supporting-region" className="space-y-4">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                  </Card>
                ))}
              </aside>
            </div>
          </>
        )}

        {available === true && (
          <>
            <WslOverviewSummaryBand
              summaryActions={summaryActions}
              distrosCount={distros.length}
              runningCount={runningCount}
              defaultDistro={defaultDistroName}
              totalDiskUsage={totalDiskUsage}
              completenessHint={completenessHint}
              t={t}
            />
            <div data-testid="wsl-layout-grid" className={desktopLayoutClass}>
            {/* Primary workflow region */}
            <section data-testid="wsl-primary-region" className="space-y-5">
              <section
                data-testid="wsl-distro-workflow-section"
                className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
              >
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    const nextTab = v as 'installed' | 'available';
                    setActiveTab(nextTab);
                    setSelectedDistros(new Set());
                    syncOverviewContext(nextTab, activeTagFilter);
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="installed">
                      {t('wsl.installed')} ({distros.length})
                    </TabsTrigger>
                    <TabsTrigger value="available">
                      {t('wsl.available')} ({onlineDistros.length})
                    </TabsTrigger>
                  </TabsList>

                  {distros.length > 0 && availableTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={activeTagFilter === null ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          setActiveTagFilter(null);
                          syncOverviewContext(activeTab, null);
                        }}
                      >
                        {t('wsl.tags.all')}
                      </Badge>
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={activeTagFilter === tag ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            const nextTag = activeTagFilter === tag ? null : tag;
                            setActiveTagFilter(nextTag);
                            syncOverviewContext(activeTab, nextTag);
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <TabsContent value="installed" className="mt-4 space-y-3">
                    {loading && distros.length === 0 ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="space-y-2">
                                  <Skeleton className="h-5 w-28" />
                                  <Skeleton className="h-4 w-36" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : distros.length === 0 ? (
                      <WslEmptyState t={t} />
                    ) : filteredDistros.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm text-muted-foreground">{t('wsl.noFilterResults')}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setActiveTagFilter(null);
                            syncOverviewContext(activeTab, null);
                          }}
                        >
                          {t('wsl.clearFilter')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        {filteredDistros.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2 pb-1">
                            <Checkbox
                              checked={selectedDistros.size === filteredDistros.length && filteredDistros.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                            <span className="text-xs text-muted-foreground">
                              {selectedDistros.size > 0
                                ? `${selectedDistros.size} ${t('wsl.batch.selected')}`
                                : t('wsl.batch.selectAll')}
                            </span>
                            {selectedDistros.size > 0 && (
                              <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
                                <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 text-xs sm:flex-none" onClick={handleBatchLaunch}>
                                  {t('wsl.batch.launch')}
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 flex-1 gap-1 text-xs sm:flex-none" onClick={handleBatchTerminate}>
                                  {t('wsl.batch.terminate')}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {filteredDistros.map((distro) => (
                          <div key={distro.name} className="flex items-start gap-2">
                            {filteredDistros.length > 1 && (
                              <Checkbox
                                className="mt-5"
                                checked={selectedDistros.has(distro.name)}
                                onCheckedChange={() => toggleSelectDistro(distro.name)}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <WslDistroCard
                                distro={distro}
                                detailHref={buildWslDistroHref(distro.name, {
                                  tab: activeTab,
                                  tag: activeTagFilter,
                                  origin: 'overview',
                                })}
                                onLaunch={handleLaunch}
                                onTerminate={handleTerminate}
                                onSetDefault={handleSetDefault}
                                onSetVersion={handleSetVersion}
                                onExport={handleExportOpen}
                                onUnregister={(name) =>
                                  setConfirmAction({ type: 'unregister', name })
                                }
                                onChangeDefaultUser={handleChangeDefaultUserOpen}
                                onOpenInExplorer={handleOpenInExplorer}
                                onOpenInTerminal={handleOpenInTerminal}
                                onClone={handleCloneOpen}
                                getDiskUsage={getDiskUsage}
                                t={t}
                              />
                            </div>
                          </div>
                        ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="available" className="mt-4">
                    <WslOnlineList
                      distros={onlineDistros}
                      installedNames={distros.map((d) => d.name)}
                      loading={loading}
                      onInstall={handleInstallOnline}
                      onInstallWithLocation={handleOpenInstallWithLocation}
                      t={t}
                    />
                  </TabsContent>
                </Tabs>
              </section>

              {distros.length > 0 && (
                <section
                  data-testid="wsl-terminal-workflow-section"
                  className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4"
                >
                  <WslExecTerminal
                    distros={distros}
                    onExec={execCommand}
                    t={t}
                  />
                </section>
              )}
            </section>

            {/* Supporting region */}
            <aside data-testid="wsl-supporting-region" className="space-y-6">
              {lifecycleFeedback && (
                <Alert
                  data-testid="wsl-lifecycle-feedback"
                  variant={lifecycleFeedback.status === 'failed' ? 'destructive' : 'default'}
                >
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">{lifecycleFeedback.title}</p>
                    {lifecycleFeedback.details && (
                      <p className="text-xs whitespace-pre-wrap text-muted-foreground">{lifecycleFeedback.details}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {lifecycleFeedback.status === 'failed' && retryActionRef.current && (
                        <Button size="sm" variant="outline" onClick={() => retryActionRef.current?.()}>
                          {t('wsl.assistance.retry')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          retryActionRef.current = null;
                          setLifecycleFeedback(null);
                        }}
                      >
                        {t('wsl.assistance.dismiss')}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <WslSupportGroup
                testId="wsl-support-maintenance-group"
                title={t('wsl.supportGroups.maintenanceTitle')}
                description={t('wsl.supportGroups.maintenanceDesc')}
              >
              <section data-testid="wsl-runtime-support-section" className="space-y-4">
                <WslStatusCard
                  status={status}
                  runtimeInfo={runtimeInfoSnapshot ?? undefined}
                  loading={loading}
                  onRefresh={() => refreshStatus()}
                  onShutdownAll={() => setConfirmAction({ type: 'shutdown' })}
                  getIpAddress={() => getIpAddress()}
                  config={config}
                  t={t}
                />
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Info className="h-4 w-4" />
                      {t('wsl.versionInfo')}
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.wslVersion')}</span>
                      <span
                        className="cursor-pointer truncate font-mono text-xs transition-colors hover:text-primary"
                        title={t('common.clickToCopy')}
                        onClick={() => {
                          const v = versionInfo?.wslVersion ?? status?.version;
                          if (v) { void navigator.clipboard.writeText(v); toast.success(t('common.copied')); }
                        }}
                      >
                        {versionInfo?.wslVersion ?? status?.version ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.kernelVersion')}</span>
                      <span
                        className="cursor-pointer truncate font-mono text-xs transition-colors hover:text-primary"
                        title={t('common.clickToCopy')}
                        onClick={() => {
                          const v = versionInfo?.kernelVersion ?? status?.kernelVersion;
                          if (v) { void navigator.clipboard.writeText(v); toast.success(t('common.copied')); }
                        }}
                      >
                        {versionInfo?.kernelVersion ?? status?.kernelVersion ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('wsl.wslgVersion')}</span>
                      <span
                        className="cursor-pointer truncate font-mono text-xs transition-colors hover:text-primary"
                        title={t('common.clickToCopy')}
                        onClick={() => {
                          const v = versionInfo?.wslgVersion ?? status?.wslgVersion;
                          if (v) { void navigator.clipboard.writeText(v); toast.success(t('common.copied')); }
                        }}
                      >
                        {versionInfo?.wslgVersion ?? status?.wslgVersion ?? '—'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5" />
                        {t('wsl.totalDiskUsage')}
                      </span>
                      <span className="font-mono">
                        {totalDiskUsage ? formatBytes(totalDiskUsage.totalBytes) : '—'}
                      </span>
                    </div>
                    {totalDiskUsage && totalDiskUsage.perDistro.length > 0 && (
                      <div className="space-y-1">
                        {(showAllDiskUsage
                          ? totalDiskUsage.perDistro
                          : totalDiskUsage.perDistro.slice(0, 3)).map(([name, bytes]) => (
                          <div key={name} className="flex items-center justify-between text-xs">
                            <span className="truncate text-muted-foreground">{name}</span>
                            <span className="font-mono">{formatBytes(bytes)}</span>
                          </div>
                        ))}
                        {totalDiskUsage.perDistro.length > 3 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-full justify-center gap-1 text-xs"
                            onClick={() => setShowAllDiskUsage((prev) => !prev)}
                          >
                            {showAllDiskUsage ? (
                              <>
                                {t('wsl.showLess')}
                                <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                {t('wsl.viewAllDistros').replace('{count}', String(totalDiskUsage.perDistro.length))}
                                <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                    {sidebarMetaLoading && (
                      <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
                    )}
                  </CardContent>
                </Card>
              </section>
              <section data-testid="wsl-operations-support-section" className="space-y-4">
                <Card data-testid="wsl-assistance-support-section">
                  <CardHeader className="pb-3">
                    <h3 className="text-sm font-semibold">{t('wsl.assistance.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('wsl.assistance.desc')}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assistanceSummary && (
                      <Alert
                        variant={assistanceSummary.status === 'success' ? 'default' : 'destructive'}
                        data-testid="wsl-assistance-summary"
                      >
                        <AlertDescription className="space-y-2">
                          <p className="font-medium">{assistanceSummary.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(assistanceSummary.timestamp).toLocaleString()}
                          </p>
                          {assistanceSummary.findings.length > 0 && (
                            <div className="space-y-1">
                              {assistanceSummary.findings.slice(0, 3).map((finding) => (
                                <p key={finding} className="text-xs">{finding}</p>
                              ))}
                            </div>
                          )}
                          {assistanceSummary.details && (
                            <p className="text-xs text-muted-foreground">{assistanceSummary.details}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {assistanceSummary.retryable && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleAssistanceAction(assistanceSummary.actionId, assistanceOrigin ?? 'panel')}
                                disabled={runningAssistanceId === assistanceSummary.actionId}
                              >
                                {t('wsl.assistance.retry')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                setAssistanceSummary(null);
                                setAssistanceOrigin(null);
                              }}
                            >
                              {assistanceOrigin === 'error'
                                ? t('wsl.assistance.returnToError')
                                : t('wsl.assistance.dismiss')}
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    {assistanceGroups.map((group) => {
                      const groupActions = runtimeAssistanceActions.filter((action) => action.category === group);
                      if (groupActions.length === 0) return null;
                      return (
                        <div key={group} className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t(`wsl.assistance.groups.${group}`)}
                          </p>
                          <div className="space-y-1.5">
                            {groupActions.map((action) => (
                              <Button
                                key={action.id}
                                variant="outline"
                                size="sm"
                                className="h-auto w-full flex-col items-start justify-start gap-0.5 py-2 text-left"
                                disabled={!action.supported || runningAssistanceId === action.id}
                                title={action.supported ? undefined : action.blockedReason}
                                onClick={() => handleAssistanceAction(action.id)}
                              >
                                <span className="text-xs font-medium">{t(action.labelKey)}</span>
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  {t(action.descriptionKey)}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="text-sm font-semibold">{t('wsl.advancedOps')}</h3>
                    <p className="text-xs text-muted-foreground">{t('wsl.advancedOpsDesc')}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-center whitespace-nowrap"
                        onClick={() => handleSetDefaultVersion(1)}
                      >
                        {t('wsl.defaultVersion')} 1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-center whitespace-nowrap"
                        onClick={() => handleSetDefaultVersion(2)}
                      >
                        {t('wsl.defaultVersion')} 2
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setImportInPlaceOpen(true)}
                      disabled={importInPlaceUnsupported}
                      title={importInPlaceHint ?? undefined}
                    >
                      {t('wsl.importInPlace')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setMountDialogOpen(true)}
                    >
                      {t('wsl.mount')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleUnmountPrompt}
                    >
                      {t('wsl.unmount')}
                    </Button>
                    {importInPlaceHint && (
                      <p className="text-xs text-muted-foreground">{importInPlaceHint}</p>
                    )}
                    {capabilities?.mountOptions === false && (
                      <p className="text-xs text-muted-foreground">
                        {t('wsl.mountOptionsFallback')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>
              </WslSupportGroup>

              <WslSupportGroup
                testId="wsl-support-automation-group"
                title={t('wsl.supportGroups.automationTitle')}
                description={t('wsl.supportGroups.automationDesc')}
              >
                <WslBackupCard
                  distroNames={distros.map((d) => d.name)}
                  backupDistro={backupDistro}
                  listBackups={listBackups}
                  restoreBackup={restoreBackup}
                  deleteBackup={deleteBackup}
                  onRestoreSuccess={refreshSidebarMeta}
                  onMutationSuccess={refreshSidebarMeta}
                  t={t}
                />
                <WslBatchWorkflowCard
                  draft={workflowDraft}
                  editingPresetId={editingWorkflowId}
                  presets={workflowPresets}
                  distros={distros}
                  availableTags={availableTags}
                  selectedCount={selectedDistros.size}
                  commandOptions={workflowCommandOptions}
                  assistanceActions={batchAssistanceActions}
                  onDraftChange={handleWorkflowDraftChange}
                  onSavePreset={handleSaveWorkflowPreset}
                  onRunDraft={handleRunWorkflowDraft}
                  onEditPreset={handleEditWorkflowPreset}
                  onRunPreset={handleRunWorkflowPreset}
                  onDeletePreset={removeWorkflowPreset}
                  t={t}
                />
                <WslBatchWorkflowSummaryCard
                  summary={workflowSummaries[0] ?? null}
                  summaries={workflowSummaries}
                  onRetry={handleRetryWorkflowSummary}
                  t={t}
                />
              </WslSupportGroup>

              <WslSupportGroup
                testId="wsl-support-config-group"
                title={t('wsl.supportGroups.configTitle')}
                description={t('wsl.supportGroups.configDesc')}
              >
              <section data-testid="wsl-config-support-section" className="space-y-4">
                <WslConfigCard
                  config={config}
                  loading={loading}
                  onRefresh={refreshConfig}
                  onSetConfig={setConfigValue}
                  t={t}
                />
                {distros.length > 1 && (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('wsl.distroConfig.targetLabel')}
                    </p>
                    <Select
                      value={selectedDistroForConfig ?? ''}
                      onValueChange={(value) => setSelectedDistroForConfig(value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder={t('wsl.distroConfig.targetPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {distros.map((distro) => (
                          <SelectItem key={distro.name} value={distro.name}>
                            {distro.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedDistroForConfig && (
                  <WslDistroConfigCard
                    distroName={selectedDistroForConfig}
                    getDistroConfig={getDistroConfig}
                    setDistroConfigValue={setDistroConfigValue}
                    t={t}
                  />
                )}
              </section>
              </WslSupportGroup>
            </aside>
          </div>
          </>
        )}
      </div>

      {/* Import Dialog */}
      <WslImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        capabilities={capabilities}
        t={t}
      />

      {/* Export Dialog */}
      <WslExportDialog
        open={exportOpen}
        distroName={exportDistroName}
        onOpenChange={setExportOpen}
        onExport={handleExport}
        capabilities={capabilities}
        t={t}
      />

      {/* Change Default User Dialog */}
      <WslChangeUserDialog
        open={changeUserOpen}
        distroName={changeUserDistro}
        onOpenChange={setChangeUserOpen}
        onConfirm={handleChangeDefaultUserConfirm}
        listUsers={listUsers}
        t={t}
      />

      {/* Mount Disk Dialog */}
      <WslMountDialog
        open={mountDialogOpen}
        onOpenChange={setMountDialogOpen}
        capabilities={capabilities}
        onConfirm={handleMountConfirm}
        t={t}
      />

      {/* Import In-Place Dialog */}
      <WslImportInPlaceDialog
        open={importInPlaceOpen}
        onOpenChange={setImportInPlaceOpen}
        onConfirm={handleImportInPlaceConfirm}
        t={t}
      />

      {/* Install with Location Dialog */}
      <WslInstallLocationDialog
        open={installLocationDialogOpen}
        distroName={installLocationDistroName}
        onOpenChange={setInstallLocationDialogOpen}
        onConfirm={handleInstallWithLocation}
        t={t}
      />

      {/* Clone Dialog */}
      <WslCloneDialog
        open={cloneDialogOpen}
        distroName={cloneSourceDistro}
        onOpenChange={setCloneDialogOpen}
        onConfirm={handleCloneConfirm}
        t={t}
      />

      <WslBatchWorkflowPreviewDialog
        open={workflowPreviewOpen}
        workflowName={workflowPreviewCandidate?.name ?? ''}
        preview={workflowPreview}
        running={workflowRunning}
        onOpenChange={setWorkflowPreviewOpen}
        onConfirm={handleConfirmWorkflowRun}
        t={t}
      />

      {/* Confirm Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === 'unregister'
                  ? t('wsl.unregister')
                  : confirmAction?.type === 'mount'
                    ? t('wsl.mount')
                    : confirmAction?.type === 'unmount'
                      ? t('wsl.unmount')
                      : confirmAction?.type === 'assistance'
                        ? t(assistanceActionById[confirmAction.actionId]?.labelKey ?? 'wsl.assistance.title')
                        : t('wsl.shutdown')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === 'unregister'
                  ? t('wsl.unregisterConfirm').replace(
                      '{name}',
                      confirmAction.name ?? ''
                    )
                  : confirmAction?.type === 'mount'
                    ? t('wsl.mountConfirm')
                  : confirmAction?.type === 'unmount'
                      ? confirmAction.diskPath
                        ? t('wsl.unmountConfirm').replace('{path}', confirmAction.diskPath)
                        : t('wsl.unmountAllConfirm')
                      : confirmAction?.type === 'assistance'
                        ? t(assistanceActionById[confirmAction.actionId]?.descriptionKey ?? 'wsl.assistance.desc')
                      : t('wsl.shutdownConfirm')}
                {confirmAction?.type === 'unregister' && (
                  <>
                    <br />
                    <span className="text-destructive font-medium">
                      {t('wsl.dataLossWarning')}
                    </span>
                  </>
                )}
                {(confirmAction?.type === 'mount'
                  || confirmAction?.type === 'unmount'
                  || confirmAction?.type === 'assistance'
                  || confirmAction?.type === 'shutdown') && (
                  <>
                    <br />
                    <span className="text-muted-foreground">
                      {t('wsl.highRiskHint')}
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndExecute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
