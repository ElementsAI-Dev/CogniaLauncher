'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWsl } from '@/hooks/wsl/use-wsl';
import { useWslStore } from '@/lib/stores/wsl';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadingSkeleton } from '@/components/layout/page-loading-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  WslExportDialog,
  WslChangeUserDialog,
  WslMoveDialog,
  WslResizeDialog,
  WslCloneDialog,
  WslDistroOverview,
  WslDistroTerminal,
  WslDistroFilesystem,
  WslDistroNetwork,
  WslDistroServices,
  WslDistroDocker,
  WslDistroEnvvars,
  WslBackupCard,
  WslBackupScheduleCard,
} from '@/components/wsl';
import {
  RefreshCw,
  Play,
  Square,
  AlertCircle,
  LayoutDashboard,
  TerminalSquare,
  FolderOpen,
  Network,
  Cog,
  Variable,
  Star,
  Download,
  Trash2,
  ArrowUpDown,
  UserCog,
  MoveRight,
  Expand,
  HardDrive,
  Copy,
  Archive,
  Container,
  Activity,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import type { WslDistroDetailPageProps } from '@/types/wsl';
import type { WslDistroStatus } from '@/types/tauri';
import type { WslAssistanceActionDescriptor, WslAssistanceSummary } from '@/types/wsl';
import { buildWslOverviewHref } from '@/lib/wsl/workflow';

interface DistroLifecycleFeedback {
  status: 'running' | 'success' | 'failed';
  title: string;
  details?: string;
}

export function WslDistroDetailPage({
  distroName,
  returnTo,
  origin,
  continueAction,
}: WslDistroDetailPageProps) {
  const { t } = useLocale();
  const backupSchedules = useWslStore((state) => state.backupSchedules);
  const upsertBackupSchedule = useWslStore((state) => state.upsertBackupSchedule);
  const removeBackupSchedule = useWslStore((state) => state.removeBackupSchedule);
  const router = useRouter();
  const isDesktop = isTauri();
  const {
    available,
    distros,
    capabilities,
    config,
    status,
    distroInfoByName,
    loading,
    error,
    checkAvailability,
    refreshDistroInfo,
    getCapabilities,
    refreshDistros,
    refreshRuntimeInfo,
    refreshStatus,
    shutdown,
    terminate,
    setDefault,
    setVersion,
    setNetworkingMode,
    exportDistro,
    launch,
    execCommand,
    getDiskUsage,
    getIpAddress,
    changeDefaultUser,
    setSparse,
    moveDistro,
    resizeDistro,
    getDistroConfig,
    setDistroConfigValue,
    detectDistroEnv,
    exportWindowsEnv,
    readDistroEnv,
    getWslenv,
    setWslenv,
    listUsers,
    getDistroResources,
    updateDistroPackages,
    openInExplorer,
    openInTerminal,
    cloneDistro,
    unregisterDistro,
    healthCheck,
    listPortForwards,
    addPortForward,
    removePortForward,
    backupDistro,
    listBackups,
    restoreBackup,
    deleteBackup,
    getAssistanceActions,
    executeAssistanceAction,
    mapErrorToAssistance,
  } = useWsl();

  const initializedRef = useRef(false);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') ?? 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [exportOpen, setExportOpen] = useState(false);
  const [changeUserOpen, setChangeUserOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [healthRunning, setHealthRunning] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthResult, setHealthResult] = useState<{
    status: string;
    issues: { severity: string; category: string; message: string }[];
    checkedAt: string;
  } | null>(null);
  const [runningAssistanceId, setRunningAssistanceId] = useState<string | null>(null);
  const [assistanceSummary, setAssistanceSummary] = useState<WslAssistanceSummary | null>(null);
  const [assistanceOrigin, setAssistanceOrigin] = useState<'panel' | 'error' | null>(null);
  const [lifecycleFeedback, setLifecycleFeedback] = useState<DistroLifecycleFeedback | null>(null);
  // Auto-dismiss success feedback after 5 seconds
  useEffect(() => {
    if (lifecycleFeedback?.status !== 'success') return;
    const timer = setTimeout(() => setLifecycleFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [lifecycleFeedback]);

  const [confirmAction, setConfirmAction] = useState<
    | { type: 'unregister' | 'terminate' }
    | { type: 'move'; location: string }
    | { type: 'resize'; size: string }
    | { type: 'assistance'; actionId: string; origin: 'panel' | 'error' }
    | null
  >(null);
  const distroInfoMap = distroInfoByName ?? {};
  const refreshRuntimeInfoAction = useMemo(
    () =>
      refreshRuntimeInfo ??
      (async () => {
        await refreshStatus();
        return null;
      }),
    [refreshRuntimeInfo, refreshStatus],
  );
  const refreshDistroInfoAction = useMemo(
    () => refreshDistroInfo ?? (async () => null),
    [refreshDistroInfo],
  );

  // Initialize on mount
  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const isAvailable = await checkAvailability();
      if (isAvailable) {
        await refreshDistros();
        await Promise.all([
          refreshRuntimeInfoAction(),
          refreshDistroInfoAction(distroName),
          getCapabilities(),
        ]);
      }
    };
    init();
  }, [checkAvailability, distroName, getCapabilities, isDesktop, refreshDistroInfoAction, refreshDistros, refreshRuntimeInfoAction]);

  // Find the distro data
  const distro: WslDistroStatus | undefined = distros.find(
    (d) => d.name === distroName
  );

  const isRunning = distro?.state.toLowerCase() === 'running';
  const wslVer = distro ? parseInt(distro.wslVersion, 10) : 2;
  const targetVersion = wslVer === 1 ? 2 : 1;
  const returnHref = returnTo ?? buildWslOverviewHref({ origin: 'detail' });
  const returnLabel =
    origin === 'sidebar'
      ? t('wsl.detail.returnToSidebar')
      : origin === 'widget'
        ? t('wsl.detail.returnToWidget')
        : origin === 'assistance'
          ? t('wsl.detail.returnToAssistance')
          : t('wsl.detail.returnToOverview');
  const distroAssistanceActions = getAssistanceActions('distro', distroName);
  const assistanceActionById = distroAssistanceActions.reduce<Record<string, WslAssistanceActionDescriptor>>(
    (acc, action) => {
      acc[action.id] = action;
      return acc;
    },
    {}
  );

  const handleRefresh = useCallback(async () => {
    await refreshDistros();
    await Promise.all([
      refreshRuntimeInfoAction(),
      refreshDistroInfoAction(distroName),
    ]);
  }, [distroName, refreshDistroInfoAction, refreshDistros, refreshRuntimeInfoAction]);

  const handleLaunch = useCallback(async () => {
    setLifecycleFeedback({
      status: 'running',
      title: t('wsl.workflow.running').replace('{action}', t('wsl.launch')),
    });
    try {
      await launch(distroName);
      toast.success(t('wsl.launchSuccess').replace('{name}', distroName));
      setLifecycleFeedback({
        status: 'success',
        title: t('wsl.workflow.success').replace('{action}', t('wsl.launch')),
        details: distroName,
      });
    } catch (err) {
      toast.error(String(err));
      setLifecycleFeedback({
        status: 'failed',
        title: t('wsl.workflow.failed').replace('{action}', t('wsl.launch')),
        details: String(err),
      });
    }
  }, [distroName, launch, t]);

  const handleTerminate = useCallback(async () => {
    setLifecycleFeedback({
      status: 'running',
      title: t('wsl.workflow.running').replace('{action}', t('wsl.terminate')),
    });
    try {
      await terminate(distroName);
      toast.success(t('wsl.terminateSuccess').replace('{name}', distroName));
      setLifecycleFeedback({
        status: 'success',
        title: t('wsl.workflow.success').replace('{action}', t('wsl.terminate')),
        details: distroName,
      });
    } catch (err) {
      toast.error(String(err));
      setLifecycleFeedback({
        status: 'failed',
        title: t('wsl.workflow.failed').replace('{action}', t('wsl.terminate')),
        details: String(err),
      });
    }
  }, [terminate, distroName, t]);

  const handleSetDefault = useCallback(async () => {
    try {
      await setDefault(distroName);
      toast.success(t('wsl.setDefaultSuccess').replace('{name}', distroName));
    } catch (err) {
      toast.error(String(err));
    }
  }, [setDefault, distroName, t]);

  const handleSetVersion = useCallback(async () => {
    try {
      await setVersion(distroName, targetVersion);
      toast.success(
        t('wsl.setVersionSuccess')
          .replace('{name}', distroName)
          .replace('{version}', String(targetVersion))
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [setVersion, distroName, targetVersion, t]);

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

  const handleExport = useCallback(
    async (name: string, filePath: string, asVhd: boolean) => {
      try {
        await exportDistro(name, filePath, asVhd);
        toast.success(t('wsl.exportSuccess').replace('{name}', name));
      } catch (err) {
        toast.error(buildExportErrorMessage(err));
        throw err;
      }
    },
    [buildExportErrorMessage, exportDistro, t]
  );

  const handleUnregister = useCallback(async () => {
    setLifecycleFeedback({
      status: 'running',
      title: t('wsl.workflow.running').replace('{action}', t('wsl.unregister')),
    });
    try {
      await unregisterDistro(distroName);
      toast.success(t('wsl.unregisterSuccess').replace('{name}', distroName));
      router.push(returnHref);
    } catch (err) {
      toast.error(String(err));
      setLifecycleFeedback({
        status: 'failed',
        title: t('wsl.workflow.failed').replace('{action}', t('wsl.unregister')),
        details: String(err),
      });
    }
  }, [distroName, returnHref, router, t, unregisterDistro]);

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

  const handleSetSparse = useCallback(async (enabled: boolean) => {
    try {
      await setSparse(distroName, enabled);
      toast.success(
        enabled
          ? t('wsl.setSparseSuccessEnabled').replace('{name}', distroName)
          : t('wsl.setSparseSuccessDisabled').replace('{name}', distroName)
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [distroName, setSparse, t]);

  const handleOpenInExplorer = useCallback(async () => {
    try {
      await openInExplorer(distroName);
      toast.success(t('wsl.openInExplorer'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [distroName, openInExplorer, t]);

  const handleOpenInTerminal = useCallback(async () => {
    try {
      await openInTerminal(distroName);
      toast.success(t('wsl.openInTerminal'));
    } catch (err) {
      toast.error(String(err));
    }
  }, [distroName, openInTerminal, t]);

  const handleCloneConfirm = useCallback(async (name: string, newName: string, location: string) => {
    try {
      const result = await cloneDistro(name, newName, location);
      toast.success(t('wsl.cloneSuccess').replace('{name}', newName) + (result ? `\n${result}` : ''));
    } catch (err) {
      toast.error(String(err));
    }
  }, [cloneDistro, t]);

  const handleRunHealthCheck = useCallback(async () => {
    setHealthRunning(true);
    setHealthError(null);
    try {
      const result = await healthCheck(distroName);
      setHealthResult(result);
    } catch (err) {
      setHealthError(String(err));
    } finally {
      setHealthRunning(false);
    }
  }, [distroName, healthCheck]);

  const runAssistanceAction = useCallback(async (actionId: string, origin: 'panel' | 'error') => {
    setRunningAssistanceId(actionId);
    setAssistanceOrigin(origin);
    try {
      const summary = await executeAssistanceAction(actionId, 'distro', distroName);
      setAssistanceSummary(summary);
      if (summary.status === 'success') {
        toast.success(summary.title);
        await handleRefresh();
        setLifecycleFeedback({
          status: 'success',
          title: summary.title,
          details: summary.details,
        });
      } else {
        toast.error(summary.details ?? summary.title);
        setLifecycleFeedback({
          status: 'failed',
          title: summary.title,
          details: summary.details ?? summary.title,
        });
      }
    } finally {
      setRunningAssistanceId(null);
    }
  }, [distroName, executeAssistanceAction, handleRefresh]);

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

  const handleMoveConfirm = useCallback((location: string) => {
    setConfirmAction({ type: 'move', location });
  }, []);

  const handleResizeConfirm = useCallback((size: string) => {
    setConfirmAction({ type: 'resize', size });
  }, []);

  const confirmAndExecute = useCallback(async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'unregister') {
      await handleUnregister();
    } else if (confirmAction.type === 'terminate') {
      await handleTerminate();
    } else if (confirmAction.type === 'move') {
      try {
        const result = await moveDistro(distroName, confirmAction.location);
        toast.success(t('wsl.moveSuccess').replace('{name}', distroName) + (result ? `\n${result}` : ''));
        setLifecycleFeedback({
          status: 'success',
          title: t('wsl.workflow.success').replace('{action}', t('wsl.move')),
          details: result,
        });
      } catch (err) {
        toast.error(String(err));
        setLifecycleFeedback({
          status: 'failed',
          title: t('wsl.workflow.failed').replace('{action}', t('wsl.move')),
          details: String(err),
        });
      }
    } else if (confirmAction.type === 'resize') {
      try {
        const result = await resizeDistro(distroName, confirmAction.size);
        toast.success(t('wsl.resizeSuccess').replace('{name}', distroName) + (result ? `\n${result}` : ''));
        setLifecycleFeedback({
          status: 'success',
          title: t('wsl.workflow.success').replace('{action}', t('wsl.resize')),
          details: result,
        });
      } catch (err) {
        toast.error(String(err));
        setLifecycleFeedback({
          status: 'failed',
          title: t('wsl.workflow.failed').replace('{action}', t('wsl.resize')),
          details: String(err),
        });
      }
    } else if (confirmAction.type === 'assistance') {
      await runAssistanceAction(confirmAction.actionId, confirmAction.origin);
    }
    setConfirmAction(null);
  }, [confirmAction, distroName, handleTerminate, handleUnregister, moveDistro, resizeDistro, runAssistanceAction, t]);

  const moveUnsupported = capabilities?.move === false;
  const resizeUnsupported = capabilities?.resize === false;
  const sparseUnsupported = capabilities?.setSparse === false;
  const runningCount = status?.runningDistros?.length ?? distros.filter((entry) => entry.state.toLowerCase() === 'running').length;
  const currentNetworkingMode = config?.['wsl2']?.['networkingMode'] ?? 'NAT';
  const moveHint = moveUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.move'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;
  const resizeHint = resizeUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.resize'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;
  const sparseHint = sparseUnsupported
    ? t('wsl.capabilityUnsupported')
        .replace('{feature}', t('wsl.setSparse'))
        .replace('{version}', capabilities?.version ?? 'Unknown')
    : undefined;
  const errorSuggestions = error
    ? mapErrorToAssistance(error, 'distro', distroName)
    : [];
  const assistanceGroups: Array<'check' | 'repair' | 'maintenance'> = ['check', 'repair', 'maintenance'];

  // Non-Tauri fallback
  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('wsl.notAvailable')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (available === null || (loading && distros.length === 0)) {
    return <PageLoadingSkeleton variant="detail" />;
  }

  // Distro not found
  if (available && distros.length > 0 && !distro) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <BreadcrumbRoot>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={returnHref}>{t('wsl.title')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{distroName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </BreadcrumbRoot>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('wsl.detail.notFound').replace('{name}', distroName)}
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href={returnHref}>{returnLabel}</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Breadcrumb */}
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={returnHref}>{t('wsl.title')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{distroName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <TerminalSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>{distroName}</span>
                {distro?.isDefault && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={isRunning ? 'default' : 'secondary'}
                  className={isRunning ? 'bg-green-500/10 text-green-700 dark:text-green-400 text-xs' : 'text-xs'}
                >
                  {isRunning ? t('wsl.running') : t('wsl.stopped')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  WSL {distro?.wslVersion ?? '?'}
                </Badge>
                {distro?.isDefault && (
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    {t('wsl.defaultBadge')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={returnHref}>{returnLabel}</Link>
            </Button>
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction({ type: 'terminate' })}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                {t('wsl.terminate')}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleLaunch}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                {t('wsl.launch')}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.refresh')}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {!distro?.isDefault && (
                  <DropdownMenuItem onClick={handleSetDefault}>
                    <Star className="mr-2 h-4 w-4" />
                    {t('wsl.setDefault')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSetVersion}>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {t('wsl.setVersion')} WSL {targetVersion}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChangeUserOpen(true)}>
                  <UserCog className="mr-2 h-4 w-4" />
                  {t('wsl.changeDefaultUser')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setExportOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('wsl.export')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloneDialogOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('wsl.clone')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenInExplorer}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('wsl.openInExplorer')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenInTerminal}>
                  <TerminalSquare className="mr-2 h-4 w-4" />
                  {t('wsl.openInTerminal')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmAction({ type: 'unregister' })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('wsl.unregister')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {lifecycleFeedback && (
        <Alert
          data-testid="wsl-distro-lifecycle-feedback"
          variant={lifecycleFeedback.status === 'failed' ? 'destructive' : 'default'}
        >
          <AlertDescription className="space-y-2">
            <p className="font-medium">{lifecycleFeedback.title}</p>
            {lifecycleFeedback.details && (
              <p className="text-xs text-muted-foreground">{lifecycleFeedback.details}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                {t('common.refresh')}
              </Button>
              {continueAction && (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={returnHref}>{t('wsl.workflow.continue')}</Link>
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            {errorSuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">{t('wsl.assistance.suggestedActions')}</p>
                <div className="flex flex-wrap gap-2">
                  {errorSuggestions.map((suggestion) => {
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

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">{t('wsl.manageOps')}</div>
          <CardDescription>{t('wsl.manageOpsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => setMoveDialogOpen(true)}
              disabled={moveUnsupported}
              title={moveHint}
            >
              <MoveRight className="h-3.5 w-3.5" />
              {t('wsl.move')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => setResizeDialogOpen(true)}
              disabled={resizeUnsupported}
              title={resizeHint}
            >
              <Expand className="h-3.5 w-3.5" />
              {t('wsl.resize')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => handleSetSparse(true)}
              disabled={sparseUnsupported}
              title={sparseHint}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.setSparseEnable')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => handleSetSparse(false)}
              disabled={sparseUnsupported}
              title={sparseHint}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t('wsl.setSparseDisable')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={() => setCloneDialogOpen(true)}
            >
              <Copy className="h-3.5 w-3.5" />
              {t('wsl.clone')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5"
              onClick={handleRunHealthCheck}
              disabled={healthRunning}
            >
              <Activity className={`h-3.5 w-3.5 ${healthRunning ? 'animate-pulse' : ''}`} />
              {healthRunning ? t('wsl.detail.healthCheckRunning') : t('wsl.detail.healthCheckRun')}
            </Button>
          </div>
          {(moveHint || resizeHint || sparseHint) && (
            <p className="text-xs text-muted-foreground">
              {moveHint ?? resizeHint ?? sparseHint}
            </p>
          )}
          <div data-testid="wsl-distro-assistance-section" className="space-y-2 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{t('wsl.assistance.title')}</p>
              <p className="text-xs text-muted-foreground">{t('wsl.assistance.distroDesc')}</p>
            </div>
            {assistanceSummary && (
              <Alert
                variant={assistanceSummary.status === 'success' ? 'default' : 'destructive'}
                data-testid="wsl-distro-assistance-summary"
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
              const actions = distroAssistanceActions.filter((action) => action.category === group);
              if (actions.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t(`wsl.assistance.groups.${group}`)}</p>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                    {actions.map((action) => (
                      <Button
                        key={action.id}
                        variant="outline"
                        size="sm"
                        className="h-auto flex-col items-start justify-start gap-0.5 py-2 text-left"
                        disabled={!action.supported || runningAssistanceId === action.id}
                        title={action.supported ? undefined : action.blockedReason}
                        onClick={() => handleAssistanceAction(action.id)}
                      >
                        <span className="text-xs font-medium">{t(action.labelKey)}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">{t(action.descriptionKey)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {healthError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{t('wsl.detail.healthCheckFailed').replace('{error}', healthError)}</p>
                <Button size="sm" variant="outline" onClick={handleRunHealthCheck}>
                  {t('wsl.detail.healthCheckRetry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {healthResult && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    healthResult.status === 'healthy'
                      ? 'default'
                      : healthResult.status === 'warning'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {healthResult.status === 'healthy'
                    ? t('wsl.detail.healthHealthy')
                    : healthResult.status === 'warning'
                      ? t('wsl.detail.healthWarning')
                      : t('wsl.detail.healthError')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('wsl.detail.healthCheckedAt')}
                  {' '}
                  {new Date(healthResult.checkedAt).toLocaleString()}
                </span>
              </div>
              {healthResult.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('wsl.detail.healthNoIssues')}</p>
              ) : (
                <div className="space-y-1.5">
                  {healthResult.issues.map((issue, index) => (
                    <div
                      key={`${issue.category}-${index}`}
                      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                        issue.severity === 'error' || issue.severity === 'critical'
                          ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                          : issue.severity === 'warning'
                            ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                            : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                      }`}
                    >
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${
                          issue.severity === 'error' || issue.severity === 'critical'
                            ? 'border-red-300 text-red-700 dark:text-red-400'
                            : issue.severity === 'warning'
                              ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                              : 'border-green-300 text-green-700 dark:text-green-400'
                        }`}
                      >
                        {issue.severity}
                      </Badge>
                      <div>
                        <span className="font-medium">{issue.category}</span>
                        <span className="text-muted-foreground">{': '}{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', v);
        window.history.replaceState(null, '', url.toString());
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('wsl.detail.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5" />
            {t('wsl.detail.tabTerminal')}
          </TabsTrigger>
          <TabsTrigger value="filesystem" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {t('wsl.detail.tabFilesystem')}
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1.5">
            <Network className="h-3.5 w-3.5" />
            {t('wsl.detail.tabNetwork')}
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <Cog className="h-3.5 w-3.5" />
            {t('wsl.detail.tabServices')}
          </TabsTrigger>
          <TabsTrigger value="envvars" className="gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            {t('wsl.detail.tabEnvVars')}
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            {t('wsl.detail.tabBackup')}
          </TabsTrigger>
          <TabsTrigger value="docker" className="gap-1.5">
            <Container className="h-3.5 w-3.5" />
            {t('wsl.detail.tabDocker')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <WslDistroOverview
            distroName={distroName}
            distro={distro ?? null}
            info={distroInfoMap[distroName] ?? null}
            onRefreshInfo={() => refreshDistroInfoAction(distroName).then(() => undefined)}
            onRefreshLiveInfo={() => refreshDistroInfoAction(distroName).then(() => undefined)}
            getDiskUsage={getDiskUsage}
            getIpAddress={getIpAddress}
            getDistroConfig={getDistroConfig}
            setDistroConfigValue={setDistroConfigValue}
            detectDistroEnv={detectDistroEnv}
            getDistroResources={getDistroResources}
            updateDistroPackages={updateDistroPackages}
            t={t}
          />
        </TabsContent>

        <TabsContent value="terminal">
          <WslDistroTerminal
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="filesystem">
          <WslDistroFilesystem
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="network">
          <WslDistroNetwork
            distroName={distroName}
            isRunning={isRunning}
            info={distroInfoMap[distroName] ?? null}
            onRefreshInfo={() => refreshDistroInfoAction(distroName).then(() => undefined)}
            getIpAddress={getIpAddress}
            onExec={execCommand}
            listPortForwards={listPortForwards}
            addPortForward={addPortForward}
            removePortForward={removePortForward}
            setNetworkingMode={setNetworkingMode}
            currentNetworkingMode={currentNetworkingMode}
            runningCount={runningCount}
            onShutdownAll={shutdown}
            onRefreshRuntime={async () => {
              await Promise.all([
                refreshDistros(),
                refreshRuntimeInfoAction(),
                refreshDistroInfoAction(distroName),
              ]);
            }}
            t={t}
          />
        </TabsContent>

        <TabsContent value="services">
          <WslDistroServices
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>

        <TabsContent value="envvars">
          <WslDistroEnvvars
            distroName={distroName}
            readDistroEnv={readDistroEnv}
            exportWindowsEnv={exportWindowsEnv}
            getWslenv={getWslenv}
            setWslenv={setWslenv}
            t={t}
          />
        </TabsContent>

        <TabsContent value="backup">
          <div className="space-y-4">
            <WslBackupCard
              distroNames={[distroName]}
              activeWorkspaceDistroName={distroName}
              backupDistro={backupDistro}
              listBackups={listBackups}
              restoreBackup={restoreBackup}
              deleteBackup={deleteBackup}
              onRestoreSuccess={handleRefresh}
              onMutationSuccess={handleRefresh}
              t={t}
            />
            <WslBackupScheduleCard
              distroNames={[distroName]}
              schedules={backupSchedules.filter((schedule) => schedule.distro_name === distroName)}
              onUpsert={upsertBackupSchedule}
              onDelete={removeBackupSchedule}
              t={t}
            />
          </div>
        </TabsContent>

        <TabsContent value="docker">
          <WslDistroDocker
            distroName={distroName}
            isRunning={isRunning}
            onExec={execCommand}
            t={t}
          />
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <WslExportDialog
        open={exportOpen}
        distroName={distroName}
        onOpenChange={setExportOpen}
        onExport={handleExport}
        capabilities={capabilities}
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
                : confirmAction?.type === 'move'
                  ? t('wsl.move')
                  : confirmAction?.type === 'resize'
                    ? t('wsl.resize')
                    : confirmAction?.type === 'assistance'
                      ? t(assistanceActionById[confirmAction.actionId]?.labelKey ?? 'wsl.assistance.title')
                    : t('wsl.terminate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'unregister'
                ? t('wsl.unregisterConfirm').replace('{name}', distroName)
                : confirmAction?.type === 'move'
                  ? t('wsl.moveConfirm').replace('{name}', distroName)
                  : confirmAction?.type === 'resize'
                    ? t('wsl.resizeConfirm').replace('{name}', distroName)
                    : confirmAction?.type === 'assistance'
                      ? t(assistanceActionById[confirmAction.actionId]?.descriptionKey ?? 'wsl.assistance.desc')
                    : `${t('wsl.terminate')} ${distroName}?`}
              {confirmAction?.type === 'unregister' && (
                <>
                  <br />
                  <span className="text-destructive font-medium">
                    {t('wsl.dataLossWarning')}
                  </span>
                </>
              )}
              {(confirmAction?.type === 'move' || confirmAction?.type === 'resize' || confirmAction?.type === 'assistance') && (
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
              className={
                confirmAction?.type === 'unregister'
                  || confirmAction?.type === 'move'
                  || confirmAction?.type === 'resize'
                  || confirmAction?.type === 'assistance'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Default User Dialog */}
      <WslChangeUserDialog
        open={changeUserOpen}
        distroName={distroName}
        onOpenChange={setChangeUserOpen}
        onConfirm={handleChangeDefaultUserConfirm}
        listUsers={listUsers}
        t={t}
      />

      {/* Move Dialog */}
      <WslMoveDialog
        open={moveDialogOpen}
        distroName={distroName}
        onOpenChange={setMoveDialogOpen}
        onConfirm={handleMoveConfirm}
        t={t}
      />

      {/* Resize Dialog */}
      <WslResizeDialog
        open={resizeDialogOpen}
        distroName={distroName}
        onOpenChange={setResizeDialogOpen}
        onConfirm={handleResizeConfirm}
        t={t}
      />

      {/* Clone Dialog */}
      <WslCloneDialog
        open={cloneDialogOpen}
        distroName={distroName}
        onOpenChange={setCloneDialogOpen}
        onConfirm={handleCloneConfirm}
        t={t}
      />
    </div>
  );
}
