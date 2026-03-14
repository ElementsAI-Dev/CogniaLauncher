'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useEnvVar } from '@/hooks/use-envvar';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { buildEnvVarRows } from '@/lib/envvar';
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
import { AlertCircle, Variable, Route, Terminal, Plus, Upload, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarScope } from '@/types/tauri';

type EnvVarAction =
  | 'refresh'
  | 'add'
  | 'edit'
  | 'delete'
  | 'import'
  | 'import-preview'
  | 'export'
  | 'conflict-resolve'
  | 'path-add'
  | 'path-remove'
  | 'path-reorder'
  | 'path-deduplicate'
  | 'path-repair'
  | null;

export default function EnvVarPage() {
  const {
    envVars,
    userPersistentVarsTyped,
    systemPersistentVarsTyped,
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
    loadDetection,
  } = useEnvVar();

  const { t } = useLocale();
  const isDesktop = isTauri();
  const initializedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<EnvVarScope | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | undefined>();
  const [editValue, setEditValue] = useState<string | undefined>();
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'import' | 'export'>('import');
  const [pathScope, setPathScope] = useState<EnvVarScope>('process');
  const [activeTab, setActiveTab] = useState<'variables' | 'path' | 'shells'>('variables');
  const [activeAction, setActiveAction] = useState<EnvVarAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshVariables = useCallback(async (
    scope: EnvVarScope | 'all',
    options?: { forceRefresh?: boolean },
  ) => {
    if (!isDesktop) return;
    await loadDetection(scope, options);
  }, [isDesktop, loadDetection]);

  const resolveRefreshScope = useCallback((scope: EnvVarScope): EnvVarScope | 'all' => {
    if (scopeFilter === 'all') return 'all';
    return scope;
  }, [scopeFilter]);

  const getActionLabel = useCallback((action: Exclude<EnvVarAction, null>) => {
    switch (action) {
      case 'refresh':
        return t('envvar.actions.refresh');
      case 'add':
        return t('envvar.actions.add');
      case 'edit':
        return t('envvar.actions.edit');
      case 'delete':
        return t('envvar.actions.delete');
      case 'import':
        return t('envvar.importExport.import');
      case 'import-preview':
        return t('envvar.importExport.preview');
      case 'export':
        return t('envvar.importExport.export');
      case 'conflict-resolve':
        return t('envvar.conflicts.resolve');
      case 'path-add':
        return t('envvar.pathEditor.add');
      case 'path-remove':
        return t('envvar.pathEditor.remove');
      case 'path-reorder':
        return t('envvar.pathEditor.title');
      case 'path-deduplicate':
        return t('envvar.pathEditor.deduplicate');
      case 'path-repair':
        return t('envvar.pathEditor.applyRepair');
      default:
        return t('common.error');
    }
  }, [t]);

  const actionLabel = useMemo(() => {
    if (!activeAction) return '';
    return getActionLabel(activeAction);
  }, [activeAction, getActionLabel]);

  const formatActionError = useCallback(
    (action: Exclude<EnvVarAction, null>, message: string) => `${getActionLabel(action)}: ${message}`,
    [getActionLabel],
  );

  const detectionStatusText = useMemo(() => {
    switch (detectionState) {
      case 'loading-no-cache':
        return t('envvar.detection.loading');
      case 'showing-cache-refreshing':
        return t('envvar.detection.cacheRefreshing');
      case 'showing-fresh':
        return t('envvar.detection.fresh');
      case 'empty':
        return t('envvar.detection.empty');
      case 'error':
        return detectionFromCache
          ? t('envvar.detection.errorWithCache')
          : t('envvar.detection.error');
      case 'idle':
      default:
        return t('envvar.detection.idle');
    }
  }, [detectionFromCache, detectionState, t]);

  const envRows = useMemo(() => buildEnvVarRows({
    processVars: envVars,
    userPersistentVars: userPersistentVarsTyped,
    systemPersistentVars: systemPersistentVarsTyped,
    scopeFilter,
    conflicts,
  }), [envVars, scopeFilter, systemPersistentVarsTyped, userPersistentVarsTyped, conflicts]);

  const filteredRowCount = useMemo(() => {
    if (!searchQuery) return envRows.length;
    const q = searchQuery.toLowerCase();
    return envRows.filter(
      (r) => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q),
    ).length;
  }, [envRows, searchQuery]);

  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;
    const timer = setTimeout(() => {
      void refreshVariables('all', { forceRefresh: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [isDesktop, refreshVariables]);

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

  const handleScopeFilterChange = useCallback(async (scope: EnvVarScope | 'all') => {
    setActionError(null);
    setActiveAction('refresh');
    setScopeFilter(scope);
    try {
      await refreshVariables(scope);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  }, [refreshVariables]);

  const runVarMutation = useCallback(async (
    action: Exclude<EnvVarAction, null>,
    scope: EnvVarScope,
    mutate: () => Promise<boolean>,
    successMessage: string,
  ) => {
    setActionError(null);
    setActiveAction(action);
    try {
      const ok = await mutate();
      if (!ok) {
        setActionError(formatActionError(action, t('common.error')));
        return false;
      }
      await refreshVariables(resolveRefreshScope(scope), { forceRefresh: true });
      toast.success(successMessage);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError(action, msg));
      toast.error(msg);
      return false;
    } finally {
      setActiveAction(null);
    }
  }, [formatActionError, refreshVariables, resolveRefreshScope, t]);

  const handleEdit = useCallback((key: string, value: string, scope: EnvVarScope) => {
    void runVarMutation('edit', scope, () => setVar(key, value, scope), t('common.saved'));
  }, [runVarMutation, setVar, t]);

  const handleDelete = useCallback((key: string, scope: EnvVarScope) => {
    void runVarMutation('delete', scope, () => removeVar(key, scope), t('common.deleted'));
  }, [removeVar, runVarMutation, t]);

  const handleAddSave = useCallback((key: string, value: string, scope: EnvVarScope) => {
    void runVarMutation('add', scope, () => setVar(key, value, scope), t('common.saved'));
  }, [runVarMutation, setVar, t]);

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    setActiveAction('refresh');
    try {
      await refreshVariables(scopeFilter, { forceRefresh: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  }, [refreshVariables, scopeFilter]);

  const runPathMutation = useCallback(async (
    action: Exclude<EnvVarAction, null>,
    mutation: () => Promise<boolean>,
  ) => {
    setActionError(null);
    setActiveAction(action);
    try {
      const ok = await mutation();
      if (!ok) {
        setActionError(formatActionError(action, t('common.error')));
      }
      return ok;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError(action, msg));
      return false;
    } finally {
      setActiveAction(null);
    }
  }, [formatActionError, t]);

  const handlePathDeduplicate = useCallback(async () => {
    setActionError(null);
    setActiveAction('path-deduplicate');
    try {
      return await deduplicatePath(pathScope);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      return 0;
    } finally {
      setActiveAction(null);
    }
  }, [deduplicatePath, pathScope]);

  const handlePreviewImport = useCallback(async (content: string, scope: EnvVarScope) => {
    setActionError(null);
    setActiveAction('import-preview');
    try {
      const preview = await previewImportEnvFile(content, scope);
      if (!preview) {
        setActionError(formatActionError('import-preview', t('common.error')));
      }
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError('import-preview', message));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, [formatActionError, previewImportEnvFile, t]);

  const handleApplyImportPreview = useCallback(async (
    content: string,
    scope: EnvVarScope,
    fingerprint: string,
  ) => {
    setActionError(null);
    setActiveAction('import');
    try {
      const result = await applyImportPreview(content, scope, fingerprint);
      if (!result) {
        const message = importPreviewStale ? t('envvar.importExport.previewStale') : t('common.error');
        setActionError(formatActionError('import', message));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError('import', message));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, [applyImportPreview, formatActionError, importPreviewStale, t]);

  const handlePreviewPathRepair = useCallback(async () => {
    setActionError(null);
    setActiveAction('path-repair');
    try {
      const preview = await previewPathRepair(pathScope);
      if (!preview) {
        setActionError(formatActionError('path-repair', t('common.error')));
      }
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError('path-repair', message));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, [formatActionError, pathScope, previewPathRepair, t]);

  const handleApplyPathRepair = useCallback(async (fingerprint: string) => {
    setActionError(null);
    setActiveAction('path-repair');
    try {
      const removed = await applyPathRepair(pathScope, fingerprint);
      if (removed === null) {
        const message = pathRepairPreviewStale ? t('envvar.pathEditor.repairPreviewStale') : t('common.error');
        setActionError(formatActionError('path-repair', message));
      }
      return removed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError('path-repair', message));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, [applyPathRepair, formatActionError, pathRepairPreviewStale, pathScope, t]);

  const handleResolveConflict = useCallback(async (
    key: string,
    sourceScope: EnvVarScope,
    targetScope: EnvVarScope,
  ) => {
    setActionError(null);
    setActiveAction('conflict-resolve');
    try {
      const result = await resolveConflict(key, sourceScope, targetScope);
      if (!result) {
        setActionError(formatActionError('conflict-resolve', t('common.error')));
        return false;
      }
      toast.success(t('common.saved'));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(formatActionError('conflict-resolve', message));
      return false;
    } finally {
      setActiveAction(null);
    }
  }, [formatActionError, resolveConflict, t]);

  const handleOpenAdd = useCallback(() => {
    setEditKey(undefined);
    setEditValue(undefined);
    setEditDialogOpen(true);
  }, []);

  const variableBusy = activeAction !== null || detectionLoading;
  const pathBusy = activeAction !== null || pathLoading;
  const importExportBusy = activeAction !== null || importExportLoading;
  const headerBusy = activeAction !== null || detectionLoading || importExportLoading;

  const isRefreshing = detectionLoading
    || activeAction === 'refresh'
    || detectionState === 'loading-no-cache'
    || detectionState === 'showing-cache-refreshing';

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
              {/* Import - icon-only on small screens */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportExportTab('import');
                      setImportExportOpen(true);
                    }}
                    className="gap-1.5"
                    disabled={headerBusy}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('envvar.importExport.import')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">{t('envvar.importExport.import')}</TooltipContent>
              </Tooltip>

              {/* Export - icon-only on small screens */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportExportTab('export');
                      setImportExportOpen(true);
                    }}
                    className="gap-1.5"
                    disabled={headerBusy}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('envvar.importExport.export')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">{t('envvar.importExport.export')}</TooltipContent>
              </Tooltip>

              {/* Refresh */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={headerBusy}
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

        {/* Status alerts grouped */}
        {(activeAction || error || actionError || (shellGuidance.length > 0 && activeTab !== 'shells')) && (
          <div className="flex shrink-0 flex-col gap-2">
            {activeAction && (
              <Alert data-testid="envvar-operation-status">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription>{t('common.loading')} {actionLabel ? `· ${actionLabel}` : ''}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {actionError && (
              <Alert variant="destructive" data-testid="envvar-operation-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            {shellGuidance.length > 0 && activeTab !== 'shells' && (
              <Alert data-testid="envvar-shell-guidance-banner">
                <Terminal className="h-4 w-4" />
                <div className="flex w-full items-center justify-between gap-2">
                  <AlertDescription>
                    {t('envvar.shellProfiles.guidanceBanner', { count: shellGuidance.length })}
                  </AlertDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTabChange('shells')}
                    data-testid="envvar-shell-guidance-open"
                  >
                    {t('envvar.shellProfiles.openGuidance')}
                  </Button>
                </div>
              </Alert>
            )}
          </div>
        )}

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
            <TabsTrigger value="shells" className="justify-center gap-1.5 sm:justify-start">
              <Terminal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('envvar.tabs.shellProfiles')}</span>
              {shellProfiles.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {shellProfiles.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="variables"
            className="mt-3 flex min-h-0 flex-1 flex-col gap-3 sm:mt-4 sm:gap-4"
            data-testid="envvar-variables-content"
          >
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
        onImport={async (content, scope) => {
          setActionError(null);
          setActiveAction('import');
          try {
            const result = await importEnvFile(content, scope);
            if (result) {
              await refreshVariables(resolveRefreshScope(scope), { forceRefresh: true });
            } else {
              setActionError(formatActionError('import', t('common.error')));
            }
            return result;
          } catch (err) {
            setActionError(formatActionError('import', err instanceof Error ? err.message : String(err)));
            return null;
          } finally {
            setActiveAction(null);
          }
        }}
        onExport={async (scope, format) => {
          setActionError(null);
          setActiveAction('export');
          try {
            const result = await exportEnvFile(scope, format);
            if (!result) {
              setActionError(formatActionError('export', t('common.error')));
            }
            return result;
          } catch (err) {
            setActionError(formatActionError('export', err instanceof Error ? err.message : String(err)));
            return null;
          } finally {
            setActiveAction(null);
          }
        }}
        defaultTab={importExportTab}
        busy={importExportBusy}
        t={t}
      />
    </div>
  );
}
