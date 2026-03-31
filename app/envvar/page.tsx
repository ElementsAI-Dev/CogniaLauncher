'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/layout/page-header';
import {
  EnvVarTable,
  EnvVarToolbar,
  EnvVarEditDialog,
  EnvVarPathEditor,
  EnvVarShellProfiles,
  EnvVarImportExport,
  EnvVarConflictPanel,
} from '@/components/envvar';
import { useEnvVar } from '@/hooks/envvar/use-envvar';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { buildEnvVarRows } from '@/lib/envvar';
import {
  createApplyImportPreviewHandler,
  createApplyPathRepairHandler,
  createExportHandler,
  createImportHandler,
  createPathDeduplicateHandler,
  createPathMutationHandler,
  createPreviewImportHandler,
  createPreviewPathRepairHandler,
  createRefreshHandler,
  createRestoreSnapshotHandler,
  createResolveConflictHandler,
  createScopeFilterChangeHandler,
  createVarMutationHandler,
} from './page-action-handlers';
import {
  getActionLabel,
  getBackupProtectionBadgeVariant,
  getDetectionStatusText,
  getFilteredRowCount,
  getSupportForAction,
  type EnvVarAction,
} from './page-helpers';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, Variable, Route, Terminal, Plus, Upload, Download, RefreshCw, History } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarBackupProtectionState, EnvVarScope, EnvVarSnapshotRestorePreview } from '@/types/tauri';

function normalizeEnvVarTab(value: string | null): 'variables' | 'path' | 'shells' {
  if (value === 'path' || value === 'shells') {
    return value;
  }
  return 'variables';
}

export default function EnvVarPage() {
  const searchParams = useSearchParams();
  const {
    processVarSummaries,
    userPersistentVarSummaries,
    systemPersistentVarSummaries,
    revealedValues,
    pathEntries,
    shellProfiles,
    conflicts,
    importPreview,
    importPreviewStale,
    pathRepairPreview,
    pathRepairPreviewStale,
    shellGuidance,
    detectionLoading,
    pathLoading,
    importExportLoading,
    error,
    detectionState,
    detectionFromCache,
    detectionError,
    detectionCanRetry,
    supportSnapshot,
    supportLoading,
    supportError,
    snapshotHistory,
    snapshotLoading,
    snapshotError,
    fetchSnapshotHistory,
    createSnapshot,
    getBackupProtection,
    previewSnapshotRestore,
    restoreSnapshot,
    deleteSnapshot,
    setVar,
    removeVar,
    fetchPath,
    addPathEntry,
    removePathEntry,
    reorderPath,
    fetchShellProfiles,
    readShellProfile,
    previewImportEnvFile,
    applyImportPreview,
    clearImportPreview,
    importEnvFile,
    exportEnvFile,
    deduplicatePath,
    previewPathRepair,
    applyPathRepair,
    clearPathRepairPreview,
    resolveConflict,
    revealVar,
    loadDetection,
    loadSupportSnapshot,
    defaultScopePreference,
  } = useEnvVar();

  const { t } = useLocale();
  const isDesktop = isTauri();
  const initializedRef = useRef(false);
  const initialDefaultScopePreferenceRef = useRef<EnvVarScope | 'all'>(defaultScopePreference);
  const hydratedDefaultScopeAppliedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<EnvVarScope | 'all'>(defaultScopePreference);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | undefined>();
  const [editValue, setEditValue] = useState<string | undefined>();
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'import' | 'export'>('import');
  const [pathScope, setPathScope] = useState<EnvVarScope>('process');
  const [activeTab, setActiveTab] = useState<'variables' | 'path' | 'shells'>('variables');
  const [activeAction, setActiveAction] = useState<EnvVarAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [backupProtection, setBackupProtection] = useState<EnvVarBackupProtectionState | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<EnvVarSnapshotRestorePreview | null>(null);
  const [selectedSnapshotPath, setSelectedSnapshotPath] = useState<string | null>(null);
  const [selectedSnapshotScopes, setSelectedSnapshotScopes] = useState<EnvVarScope[]>([]);
  const defaultCreateScope: EnvVarScope =
    defaultScopePreference === 'all' ? 'process' : defaultScopePreference;

  // Surface hook-level errors and support errors as toasts
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (supportError) toast.error(supportError);
  }, [supportError]);

  useEffect(() => {
    setActiveTab(normalizeEnvVarTab(searchParams.get('tab')));
  }, [searchParams]);

  const refreshVariables = useCallback(async (
    scope: EnvVarScope | 'all',
    options?: { forceRefresh?: boolean },
  ) => {
    if (!isDesktop) return;
    await loadDetection(scope, options);
  }, [isDesktop, loadDetection]);

  const formatActionError = useCallback(
    (action: EnvVarAction, message: string) => `${getActionLabel(action, t)}: ${message}`,
    [t],
  );

  const refreshBackupProtection = useCallback(async (
    context?: {
      action: string;
      scope: EnvVarScope;
    },
  ) => {
    if (!isDesktop) {
      setBackupProtection(null);
      return null;
    }
    const resolvedContext = context ?? {
      action: 'import_apply',
      scope: scopeFilter === 'system' ? 'system' : 'user',
    };
    const protection = await getBackupProtection(resolvedContext.action, resolvedContext.scope);
    setBackupProtection(protection);
    return protection;
  }, [getBackupProtection, isDesktop, scopeFilter]);

  const loadActionProtection = useCallback(async (
    action: string,
    scope: EnvVarScope,
  ) => {
    await refreshBackupProtection({ action, scope });
  }, [refreshBackupProtection]);

  const detectionStatusText = useMemo(
    () => getDetectionStatusText(detectionState, detectionFromCache, t),
    [detectionFromCache, detectionState, t],
  );

  const envRows = useMemo(() => buildEnvVarRows({
    processVars: processVarSummaries,
    userPersistentVars: userPersistentVarSummaries,
    systemPersistentVars: systemPersistentVarSummaries,
    scopeFilter,
    conflicts,
    revealedValues,
  }), [
    conflicts,
    processVarSummaries,
    revealedValues,
    scopeFilter,
    systemPersistentVarSummaries,
    userPersistentVarSummaries,
  ]);

  const filteredRowCount = useMemo(
    () => getFilteredRowCount(envRows, searchQuery),
    [envRows, searchQuery],
  );

  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;
    const timer = setTimeout(() => {
      void refreshVariables(defaultScopePreference, { forceRefresh: true });
      void loadSupportSnapshot();
      void fetchSnapshotHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultScopePreference, fetchSnapshotHistory, isDesktop, loadSupportSnapshot, refreshVariables]);

  useEffect(() => {
    if (!isDesktop || !initializedRef.current || hydratedDefaultScopeAppliedRef.current) return;
    if (defaultScopePreference === initialDefaultScopePreferenceRef.current) return;

    hydratedDefaultScopeAppliedRef.current = true;

    if (scopeFilter !== initialDefaultScopePreferenceRef.current) {
      return;
    }

    setScopeFilter(defaultScopePreference);
    void refreshVariables(defaultScopePreference, { forceRefresh: true });
  }, [defaultScopePreference, isDesktop, refreshVariables, scopeFilter]);

  useEffect(() => {
    void refreshBackupProtection();
  }, [refreshBackupProtection]);

  const handleCreateSnapshot = useCallback(() => {
    setActionError(null);
    setActionNotice(null);
    void createSnapshot(['user', 'system'], {
      creationMode: 'manual',
      sourceAction: 'manual_snapshot',
      note: t('envvar.snapshots.manualNote'),
    });
  }, [createSnapshot, t]);

  const getEffectiveSnapshotScopes = useCallback((snapshot: {
    path: string;
    scopes: EnvVarScope[];
  }) => {
    if (selectedSnapshotPath === snapshot.path && selectedSnapshotScopes.length > 0) {
      return selectedSnapshotScopes;
    }
    return snapshot.scopes;
  }, [selectedSnapshotPath, selectedSnapshotScopes]);

  const normalizeSnapshotScopesForCall = useCallback((snapshot: {
    scopes: EnvVarScope[];
  }, scopes: EnvVarScope[]) => {
    return scopes.length === snapshot.scopes.length ? [] : scopes;
  }, []);

  const handleSnapshotScopeToggle = useCallback((snapshot: {
    path: string;
    scopes: EnvVarScope[];
  }, scope: EnvVarScope) => {
    const currentScopes = getEffectiveSnapshotScopes(snapshot);
    const allScopesSelected = currentScopes.length === snapshot.scopes.length;
    const nextScopes = allScopesSelected
      ? [scope]
      : currentScopes.includes(scope)
        ? currentScopes.filter((item) => item !== scope)
        : [...currentScopes, scope];
    if (nextScopes.length === 0) {
      return;
    }

    setSelectedSnapshotPath(snapshot.path);
    setSelectedSnapshotScopes(
      nextScopes.length === snapshot.scopes.length ? [] : nextScopes,
    );
    setSnapshotPreview(null);
    setActionError(null);
    setActionNotice(null);
  }, [getEffectiveSnapshotScopes]);

  const handlePreviewSnapshot = useCallback((snapshot: {
    path: string;
    scopes: EnvVarScope[];
  }) => {
    const scopes = getEffectiveSnapshotScopes(snapshot);
    const previewScopes = normalizeSnapshotScopesForCall(snapshot, scopes);
    setActionError(null);
    setActionNotice(null);
    setSelectedSnapshotPath(snapshot.path);
    setSelectedSnapshotScopes(previewScopes);
    void previewSnapshotRestore(snapshot.path, previewScopes).then(setSnapshotPreview);
  }, [getEffectiveSnapshotScopes, normalizeSnapshotScopesForCall, previewSnapshotRestore]);

  const refreshAfterRestore = useCallback(async () => {
    clearImportPreview();
    clearPathRepairPreview();
    setSnapshotPreview(null);
    setSelectedSnapshotPath(null);
    setSelectedSnapshotScopes([]);
    await refreshBackupProtection();
    await fetchPath(pathScope);
    if (activeTab === 'shells') {
      await fetchShellProfiles();
    }
  }, [
    activeTab,
    clearImportPreview,
    clearPathRepairPreview,
    fetchPath,
    fetchShellProfiles,
    pathScope,
    refreshBackupProtection,
  ]);

  const runRestoreSnapshot = createRestoreSnapshotHandler({
    restoreSnapshot,
    afterRestore: refreshAfterRestore,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleRestoreSnapshot = useCallback((snapshotPath: string, scopes: EnvVarScope[] = []) => {
    setActionNotice(null);
    const normalizedScopes = [...scopes].sort();
    const previewedScopes = [...selectedSnapshotScopes].sort();
    const scopesMatch = normalizedScopes.length === previewedScopes.length
      && normalizedScopes.every((scope, index) => scope === previewedScopes[index]);
    if (selectedSnapshotPath !== snapshotPath || snapshotPreview == null || !scopesMatch) {
      setActionError(formatActionError('snapshot-restore', t('common.error')));
      return;
    }
    setActionError(null);
    void runRestoreSnapshot(snapshotPath, scopes, snapshotPreview.fingerprint);
  }, [formatActionError, runRestoreSnapshot, selectedSnapshotPath, selectedSnapshotScopes, snapshotPreview, t]);

  const handleDeleteSnapshot = useCallback((snapshotPath: string) => {
    setActionError(null);
    setActionNotice(null);
    if (selectedSnapshotPath === snapshotPath) {
      setSelectedSnapshotPath(null);
      setSelectedSnapshotScopes([]);
      setSnapshotPreview(null);
    }
    void deleteSnapshot(snapshotPath);
  }, [deleteSnapshot, selectedSnapshotPath]);

  const handleTabChange = useCallback((tab: string) => {
    const nextTab = (tab as 'variables' | 'path' | 'shells');
    setActiveTab(nextTab);
    if (tab === 'path' && isDesktop) {
      fetchPath(pathScope);
    } else if (tab === 'shells' && isDesktop) {
      fetchShellProfiles();
    }
  }, [fetchPath, fetchShellProfiles, isDesktop, pathScope]);

  const handlePathScopeChange = useCallback((scope: EnvVarScope) => {
    setPathScope(scope);
    clearPathRepairPreview();
    if (isDesktop) {
      fetchPath(scope);
    }
  }, [clearPathRepairPreview, fetchPath, isDesktop]);

  const handleScopeFilterChange = createScopeFilterChangeHandler({
    refreshVariables,
    setScopeFilter,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
  });

  const runVarMutation = createVarMutationHandler({
    scopeFilter,
    refreshVariables,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleEdit = useCallback((key: string, value: string, scope: EnvVarScope) => {
    void runVarMutation('edit', scope, () => setVar(key, value, scope), t('common.saved'));
  }, [runVarMutation, setVar, t]);

  const handleDelete = useCallback((key: string, scope: EnvVarScope) => {
    void runVarMutation('delete', scope, () => removeVar(key, scope), t('common.deleted'));
  }, [removeVar, runVarMutation, t]);

  const handleAddSave = useCallback((key: string, value: string, scope: EnvVarScope) => {
    void runVarMutation('add', scope, () => setVar(key, value, scope), t('common.saved'));
  }, [runVarMutation, setVar, t]);

  const handleRefresh = createRefreshHandler({
    scopeFilter,
    refreshVariables,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
  });

  const runPathMutation = createPathMutationHandler({
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handlePathDeduplicate = createPathDeduplicateHandler({
    pathScope,
    deduplicatePath,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    t,
  });

  const handlePreviewImport = createPreviewImportHandler({
    previewImportEnvFile,
    beforeAction: (scope) => loadActionProtection('import_apply', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleApplyImportPreview = createApplyImportPreviewHandler({
    importPreviewStale,
    applyImportPreview,
    beforeAction: (scope) => loadActionProtection('import_apply', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handlePreviewPathRepair = createPreviewPathRepairHandler({
    pathScope,
    previewPathRepair,
    beforeAction: (scope) => loadActionProtection('path_repair_apply', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleApplyPathRepair = createApplyPathRepairHandler({
    pathScope,
    pathRepairPreviewStale,
    applyPathRepair,
    beforeAction: (scope) => loadActionProtection('path_repair_apply', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleResolveConflict = createResolveConflictHandler({
    resolveConflict,
    beforeAction: (scope) => loadActionProtection('conflict_resolve', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleImport = createImportHandler({
    scopeFilter,
    importEnvFile,
    refreshVariables,
    beforeAction: (scope) => loadActionProtection('import_apply', scope),
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleExport = createExportHandler({
    exportEnvFile,
    toastApi: toast,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleOpenAdd = useCallback(() => {
    setEditKey(undefined);
    setEditValue(undefined);
    setEditDialogOpen(true);
  }, []);

  const variableBusy = activeAction !== null || detectionLoading;
  const pathBusy = activeAction !== null || pathLoading;
  const importExportBusy = activeAction !== null || importExportLoading;
  const headerBusy = activeAction !== null || detectionLoading || importExportLoading;
  const refreshSupport = getSupportForAction(supportSnapshot, 'refresh', scopeFilter);
  const refreshBlocked = refreshSupport?.supported === false
    || refreshSupport?.state === 'blocked'
    || refreshSupport?.state === 'unavailable';

  const isRefreshing = detectionLoading
    || activeAction === 'refresh'
    || detectionState === 'loading-no-cache'
    || detectionState === 'showing-cache-refreshing';

  // Detection alert: only show when not fresh
  const showDetectionAlert = detectionState !== 'showing-fresh';

  if (!isDesktop) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <PageHeader
          title={t('envvar.title')}
          description={t('envvar.description')}
        />
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Variable />
            </EmptyMedia>
            <EmptyTitle>{t('envvar.emptyState.title')}</EmptyTitle>
            <EmptyDescription>{t('envvar.emptyState.description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div data-testid="envvar-page-root" className="h-full min-h-0 overflow-hidden p-3 sm:p-4 md:p-6">
      <div className="flex h-full min-h-0 flex-col gap-4 sm:gap-6">
        <PageHeader
          title={t('envvar.title')}
          description={t('envvar.description')}
          actions={
            <div
              className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:flex-nowrap"
              data-testid="envvar-header-actions"
            >
              {/* Snapshots toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSnapshotsOpen(!snapshotsOpen)}
                    className="gap-1.5"
                    data-testid="envvar-snapshots-toggle"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('envvar.snapshots.title')}</span>
                    {snapshotHistory.length > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                        {snapshotHistory.length}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">{t('envvar.snapshots.title')}</TooltipContent>
              </Tooltip>

              {/* Import/Export dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={headerBusy}
                        data-testid="envvar-import-export-trigger"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t('envvar.importExport.title')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="sm:hidden">{t('envvar.importExport.title')}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setImportExportTab('import');
                      setImportExportOpen(true);
                    }}
                    data-testid="envvar-import-trigger"
                  >
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    {t('envvar.importExport.import')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setImportExportTab('export');
                      setImportExportOpen(true);
                    }}
                    data-testid="envvar-export-trigger"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {t('envvar.importExport.export')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Refresh */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={headerBusy || Boolean(refreshBlocked) || supportLoading}
                    className="gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{t('envvar.actions.refresh')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">{t('envvar.actions.refresh')}</TooltipContent>
              </Tooltip>

              {/* Add */}
              <Button size="sm" onClick={handleOpenAdd} className="gap-1.5" disabled={headerBusy}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('envvar.actions.add')}</span>
              </Button>
            </div>
          }
        />

        {actionError && (
          <Alert variant="destructive" data-testid="envvar-action-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
        {actionNotice && (
          <Alert data-testid="envvar-action-notice">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{actionNotice}</AlertDescription>
          </Alert>
        )}

        {/* Collapsible snapshot history */}
        <Collapsible open={snapshotsOpen} onOpenChange={setSnapshotsOpen}>
          <CollapsibleContent>
            <Card data-testid="envvar-snapshot-history" className="shrink-0">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    {t('envvar.snapshots.title')}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t('envvar.snapshots.description')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateSnapshot}
                  disabled={snapshotLoading}
                >
                  {t('envvar.snapshots.create')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {backupProtection && (
                  <Alert data-testid="envvar-snapshot-protection">
                    <AlertCircle className="h-4 w-4" />
                    <div className="flex w-full items-center justify-between gap-3">
                      <AlertDescription>{backupProtection.reason}</AlertDescription>
                      <Badge variant={getBackupProtectionBadgeVariant(backupProtection)}>
                        {backupProtection.state}
                      </Badge>
                    </div>
                  </Alert>
                )}
                {snapshotError && (
                  <Alert variant="destructive" data-testid="envvar-snapshot-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{snapshotError}</AlertDescription>
                  </Alert>
                )}
                {snapshotHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('envvar.snapshots.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {snapshotHistory.slice(0, 5).map((snapshot) => (
                      <div
                        key={snapshot.path}
                        className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{snapshot.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[snapshot.creationMode, snapshot.sourceAction || t('envvar.snapshots.manualSource'), snapshot.scopes.join(', ')].join(' · ')}
                          </div>
                          {snapshot.note && (
                            <div className="text-xs text-muted-foreground">{snapshot.note}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={snapshot.integrityState === 'valid' ? 'secondary' : 'destructive'}>
                            {snapshot.integrityState}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-1">
                            {snapshot.scopes.map((scope) => {
                              const selectedScopes = getEffectiveSnapshotScopes(snapshot);
                              const selected = selectedScopes.includes(scope);
                              return (
                                <Button
                                  key={`${snapshot.path}:${scope}`}
                                  type="button"
                                  variant={selected ? 'secondary' : 'outline'}
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  data-testid={`envvar-snapshot-scope-${scope}-${snapshot.path}`}
                                  onClick={() => handleSnapshotScopeToggle(snapshot, scope)}
                                >
                                  {t(`envvar.scopes.${scope}`)}
                                </Button>
                              );
                            })}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handlePreviewSnapshot(snapshot)}>
                            {t('envvar.snapshots.preview')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreSnapshot(snapshot.path, selectedSnapshotPath === snapshot.path ? selectedSnapshotScopes : [])}
                          >
                            {t('envvar.snapshots.restore')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSnapshot(snapshot.path)}>
                            {t('envvar.snapshots.delete')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {snapshotPreview && selectedSnapshotPath && (
                  <div data-testid="envvar-snapshot-preview" className="rounded-lg border border-dashed px-3 py-2">
                    {snapshotPreview.segments.map((segment) => (
                      <div key={`${selectedSnapshotPath}:${segment.scope}`} className="space-y-1 py-1">
                        <p className="text-sm text-muted-foreground">
                          {t('envvar.snapshots.segmentSummary')}
                          {' · '}
                          {segment.scope}
                          {' · '}
                          +{segment.addedVariables}
                          {' / '}
                          ~{segment.changedVariables}
                          {' / '}
                          -{segment.removedVariables}
                        </p>
                        {segment.skipped && segment.reason && (
                          <p className="text-xs text-muted-foreground">{segment.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
          data-testid="envvar-tabs"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-3 sm:w-fit">
            <TabsTrigger value="variables" className="justify-center gap-1.5 sm:justify-start">
              <Variable className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('envvar.tabs.variables')}</span>
              {envRows.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {envRows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="path" className="justify-center gap-1.5 sm:justify-start">
              <Route className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('envvar.tabs.pathEditor')}</span>
              {pathEntries.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {pathEntries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shells" className="relative justify-center gap-1.5 sm:justify-start">
              <Terminal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('envvar.tabs.shellProfiles')}</span>
              {shellProfiles.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {shellProfiles.length}
                </Badge>
              )}
              {shellGuidance.length > 0 && activeTab !== 'shells' && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500"
                  data-testid="envvar-shell-guidance-dot"
                  title={t('envvar.shellProfiles.guidanceBanner', { count: shellGuidance.length })}
                />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="variables"
            className="mt-3 flex min-h-0 flex-1 flex-col gap-3 sm:mt-4 sm:gap-4"
            data-testid="envvar-variables-content"
          >
            {showDetectionAlert && (
              <Alert
                variant={detectionState === 'error' ? 'destructive' : 'default'}
                data-testid="envvar-detection-status"
                data-detection-state={detectionState}
              >
                {detectionState === 'loading-no-cache' || detectionState === 'showing-cache-refreshing' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Variable className="h-4 w-4" />
                )}
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    <AlertDescription>{detectionStatusText}</AlertDescription>
                    {detectionError && (
                      <p className="mt-1 text-xs" data-testid="envvar-detection-error">{detectionError}</p>
                    )}
                  </div>
                  {(detectionCanRetry || detectionState === 'empty' || detectionState === 'error') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={variableBusy}
                      data-testid="envvar-detection-retry"
                    >
                      {t('common.retry')}
                    </Button>
                  )}
                </div>
              </Alert>
            )}

            <Card className="shrink-0 gap-0 py-0" data-testid="envvar-toolbar-shell">
              <CardContent className="px-3 py-3 sm:px-4">
                <EnvVarToolbar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  scopeFilter={scopeFilter}
                  onScopeFilterChange={handleScopeFilterChange}
                  disabled={variableBusy}
                  totalCount={envRows.length}
                  filteredCount={searchQuery ? filteredRowCount : undefined}
                  t={t}
                />
              </CardContent>
            </Card>

            {/* Conflict panel - self-contained component */}
            {scopeFilter === 'all' && (
              <EnvVarConflictPanel
                conflicts={conflicts}
                onResolve={(key, sourceScope, targetScope) => void handleResolveConflict(key, sourceScope, targetScope)}
                busy={variableBusy}
                t={t}
              />
            )}

            <Card className="min-h-0 flex-1 gap-0 py-0" data-testid="envvar-variables-list-shell">
              <CardHeader className="border-b px-3 py-3 sm:px-4">
                <CardTitle className="text-sm">{t('envvar.tabs.variables')}</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 p-0">
                <EnvVarTable
                  rows={envRows}
                  scopeFilter={scopeFilter}
                  searchQuery={searchQuery}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReveal={(key, scope) => revealVar(key, scope)}
                  busy={variableBusy}
                  t={t}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="path" className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-4" data-testid="envvar-path-content">
            <div className="min-h-0 flex-1">
              <EnvVarPathEditor
                pathEntries={pathEntries}
                pathScope={pathScope}
                onPathScopeChange={handlePathScopeChange}
                onAdd={(path, position) => runPathMutation('path-add', () => addPathEntry(path, pathScope, position))}
                onRemove={(path) => runPathMutation('path-remove', () => removePathEntry(path, pathScope))}
                onReorder={(entries) => runPathMutation('path-reorder', () => reorderPath(entries, pathScope))}
                onDeduplicate={handlePathDeduplicate}
                onPreviewRepair={handlePreviewPathRepair}
                onApplyRepair={handleApplyPathRepair}
                onClearRepairPreview={clearPathRepairPreview}
                repairPreview={pathRepairPreview}
                repairPreviewStale={pathRepairPreviewStale}
                onRefresh={() => fetchPath(pathScope)}
                loading={pathBusy}
                t={t}
              />
            </div>
          </TabsContent>

          <TabsContent value="shells" className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-4" data-testid="envvar-shells-content">
            <div className="min-h-0 flex-1">
              <EnvVarShellProfiles
                profiles={shellProfiles}
                onReadProfile={readShellProfile}
                guidance={shellGuidance}
                t={t}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <EnvVarEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleAddSave}
        editKey={editKey}
        editValue={editValue}
        defaultScope={defaultCreateScope}
        pending={activeAction === 'add' || activeAction === 'edit'}
        t={t}
      />

      <EnvVarImportExport
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        onPreviewImport={handlePreviewImport}
        onApplyImportPreview={handleApplyImportPreview}
        onClearImportPreview={clearImportPreview}
        importPreview={importPreview}
        importPreviewStale={importPreviewStale}
        onImport={handleImport}
        onExport={handleExport}
        defaultTab={importExportTab}
        busy={importExportBusy}
        t={t}
      />
    </div>
  );
}
