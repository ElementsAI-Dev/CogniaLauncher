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
  createApplyImportPreviewHandler,
  createApplyPathRepairHandler,
  createExportHandler,
  createImportHandler,
  createPathDeduplicateHandler,
  createPathMutationHandler,
  createPreviewImportHandler,
  createPreviewPathRepairHandler,
  createRefreshHandler,
  createResolveConflictHandler,
  createScopeFilterChangeHandler,
  createVarMutationHandler,
} from './page-action-handlers';
import {
  getActionLabel,
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
import { AlertCircle, Variable, Route, Terminal, Plus, Upload, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarScope } from '@/types/tauri';

export default function EnvVarPage() {
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
  const [activeAction, setActiveAction] = useState<EnvVarAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshVariables = useCallback(async (
    scope: EnvVarScope | 'all',
    options?: { forceRefresh?: boolean },
  ) => {
    if (!isDesktop) return;
    await loadDetection(scope, options);
  }, [isDesktop, loadDetection]);

  const actionLabel = useMemo(() => {
    if (!activeAction) return '';
    return getActionLabel(activeAction, t);
  }, [activeAction, t]);

  const formatActionError = useCallback(
    (action: EnvVarAction, message: string) => `${getActionLabel(action, t)}: ${message}`,
    [t],
  );

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
      void refreshVariables('all', { forceRefresh: true });
      void loadSupportSnapshot();
    }, 0);
    return () => clearTimeout(timer);
  }, [isDesktop, loadSupportSnapshot, refreshVariables]);

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
    setActionError,
    setActionNotice,
    setActiveAction,
  });

  const runPathMutation = createPathMutationHandler({
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handlePathDeduplicate = createPathDeduplicateHandler({
    pathScope,
    deduplicatePath,
    setActionError,
    setActionNotice,
    setActiveAction,
    t,
  });

  const handlePreviewImport = createPreviewImportHandler({
    previewImportEnvFile,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleApplyImportPreview = createApplyImportPreviewHandler({
    importPreviewStale,
    applyImportPreview,
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handlePreviewPathRepair = createPreviewPathRepairHandler({
    pathScope,
    previewPathRepair,
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
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleResolveConflict = createResolveConflictHandler({
    resolveConflict,
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
    setActionError,
    setActionNotice,
    setActiveAction,
    formatActionError,
    t,
  });

  const handleExport = createExportHandler({
    exportEnvFile,
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

        {/* Status alerts grouped */}
        {(activeAction || error || actionError || actionNotice || supportError || (shellGuidance.length > 0 && activeTab !== 'shells')) && (
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

            {actionNotice && (
              <Alert data-testid="envvar-operation-notice">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionNotice}</AlertDescription>
              </Alert>
            )}

            {supportError && (
              <Alert variant="destructive" data-testid="envvar-support-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{supportError}</AlertDescription>
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
