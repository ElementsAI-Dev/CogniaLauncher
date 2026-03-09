'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import {
  EnvVarTable,
  EnvVarToolbar,
  EnvVarEditDialog,
  EnvVarPathEditor,
  EnvVarShellProfiles,
  EnvVarImportExport,
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
import { Input } from '@/components/ui/input';
import { AlertCircle, Variable, Route, Terminal, Plus, Upload, Download, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarScope } from '@/types/tauri';

type EnvVarAction =
  | 'refresh'
  | 'add'
  | 'edit'
  | 'delete'
  | 'import'
  | 'export'
  | 'path-add'
  | 'path-remove'
  | 'path-reorder'
  | 'path-deduplicate'
  | null;

const DEFAULT_CONFLICT_IGNORED_KEYS = ['PATH', 'PATHEXT', 'TEMP', 'TMP', 'PSMODULEPATH'] as const;
const CONFLICT_CUSTOM_IGNORED_STORAGE_KEY = 'envvar.customIgnoredConflictKeys';

function normalizeEnvKey(key: string): string {
  return key.trim().toUpperCase();
}

function normalizeEnvKeyList(keys: string[]): string[] {
  return Array.from(new Set(keys.map(normalizeEnvKey).filter(Boolean)));
}

function parseEnvKeyInput(input: string): string[] {
  return normalizeEnvKeyList(input.split(/[\s,;]+/));
}

export default function EnvVarPage() {
  const {
    envVars,
    userPersistentVarsTyped,
    systemPersistentVarsTyped,
    pathEntries,
    shellProfiles,
    conflicts,
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
    importEnvFile,
    exportEnvFile,
    deduplicatePath,
    loadDetection,
  } = useEnvVar();

  const { t } = useLocale();
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
  const [compactConflictView, setCompactConflictView] = useState(false);
  const [customIgnoredConflictKeys, setCustomIgnoredConflictKeys] = useState<string[]>([]);
  const [conflictIgnoreInput, setConflictIgnoreInput] = useState('');
  const [conflictsPanelCollapsed, setConflictsPanelCollapsed] = useState(false);
  const [conflictsPanelDismissed, setConflictsPanelDismissed] = useState(false);

  const refreshVariables = useCallback(async (
    scope: EnvVarScope | 'all',
    options?: { forceRefresh?: boolean },
  ) => {
    if (!isTauri()) return;
    await loadDetection(scope, options);
  }, [loadDetection]);

  useEffect(() => {
    const syncViewport = () => setCompactConflictView(window.innerWidth < 768);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONFLICT_CUSTOM_IGNORED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomIgnoredConflictKeys(normalizeEnvKeyList(parsed.filter((item): item is string => typeof item === 'string')));
      }
    } catch {
      // Ignore malformed persisted settings and fallback to defaults.
    }
  }, []);

  const resolveRefreshScope = useCallback((scope: EnvVarScope): EnvVarScope | 'all' => {
    if (scopeFilter === 'all') return 'all';
    return scope;
  }, [scopeFilter]);

  const actionLabel = useMemo(() => {
    if (!activeAction) return '';
    switch (activeAction) {
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
      case 'export':
        return t('envvar.importExport.export');
      case 'path-add':
        return t('envvar.pathEditor.add');
      case 'path-remove':
        return t('envvar.pathEditor.remove');
      case 'path-reorder':
        return t('envvar.pathEditor.title');
      case 'path-deduplicate':
        return t('envvar.pathEditor.deduplicate');
      default:
        return '';
    }
  }, [activeAction, t]);

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
      case 'export':
        return t('envvar.importExport.export');
      case 'path-add':
        return t('envvar.pathEditor.add');
      case 'path-remove':
        return t('envvar.pathEditor.remove');
      case 'path-reorder':
        return t('envvar.pathEditor.title');
      case 'path-deduplicate':
        return t('envvar.pathEditor.deduplicate');
      default:
        return t('common.error');
    }
  }, [t]);

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

  const defaultIgnoredConflictKeys = useMemo(
    () => normalizeEnvKeyList([...DEFAULT_CONFLICT_IGNORED_KEYS]),
    [],
  );

  const allIgnoredConflictKeySet = useMemo(
    () => new Set([...defaultIgnoredConflictKeys, ...customIgnoredConflictKeys]),
    [customIgnoredConflictKeys, defaultIgnoredConflictKeys],
  );

  const visibleConflicts = useMemo(
    () => conflicts.filter((conflict) => !allIgnoredConflictKeySet.has(normalizeEnvKey(conflict.key))),
    [allIgnoredConflictKeySet, conflicts],
  );

  const hiddenConflictCount = conflicts.length - visibleConflicts.length;

  const envRows = useMemo(() => buildEnvVarRows({
    processVars: envVars,
    userPersistentVars: userPersistentVarsTyped,
    systemPersistentVars: systemPersistentVarsTyped,
    scopeFilter,
    conflicts: visibleConflicts,
  }), [envVars, scopeFilter, systemPersistentVarsTyped, userPersistentVarsTyped, visibleConflicts]);

  const persistCustomIgnoredConflictKeys = useCallback((nextKeys: string[]) => {
    const normalized = normalizeEnvKeyList(nextKeys);
    setCustomIgnoredConflictKeys(normalized);
    try {
      window.localStorage.setItem(CONFLICT_CUSTOM_IGNORED_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage write errors.
    }
  }, []);

  useEffect(() => {
    if (!initializedRef.current && isTauri()) {
      initializedRef.current = true;
      const timer = setTimeout(() => {
        void refreshVariables('all');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [refreshVariables]);

  const handleTabChange = useCallback((tab: string) => {
    const nextTab = (tab as 'variables' | 'path' | 'shells');
    setActiveTab(nextTab);
    if (tab === 'path' && isTauri()) {
      fetchPath(pathScope);
    } else if (tab === 'shells' && isTauri()) {
      fetchShellProfiles();
    }
  }, [fetchPath, fetchShellProfiles, pathScope]);

  const handlePathScopeChange = useCallback((scope: EnvVarScope) => {
    setPathScope(scope);
    if (isTauri()) {
      fetchPath(scope);
    }
  }, [fetchPath]);

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

  const handleOpenAdd = useCallback(() => {
    setEditKey(undefined);
    setEditValue(undefined);
    setEditDialogOpen(true);
  }, []);

  const handleAddIgnoredConflictKeys = useCallback(() => {
    const nextKeys = parseEnvKeyInput(conflictIgnoreInput);
    if (nextKeys.length === 0) return;
    const filtered = nextKeys.filter(
      (key) => !defaultIgnoredConflictKeys.includes(key) && !customIgnoredConflictKeys.includes(key),
    );
    if (filtered.length === 0) {
      setConflictIgnoreInput('');
      return;
    }
    persistCustomIgnoredConflictKeys([...customIgnoredConflictKeys, ...filtered]);
    setConflictIgnoreInput('');
  }, [
    conflictIgnoreInput,
    customIgnoredConflictKeys,
    defaultIgnoredConflictKeys,
    persistCustomIgnoredConflictKeys,
  ]);

  const handleRemoveIgnoredConflictKey = useCallback((key: string) => {
    persistCustomIgnoredConflictKeys(customIgnoredConflictKeys.filter((item) => item !== key));
  }, [customIgnoredConflictKeys, persistCustomIgnoredConflictKeys]);

  const variableBusy = activeAction !== null || detectionLoading;
  const pathBusy = activeAction !== null || pathLoading;
  const importExportBusy = activeAction !== null || importExportLoading;
  const headerBusy = activeAction !== null || detectionLoading || importExportLoading;

  if (!isTauri()) {
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
                {t('envvar.importExport.import')}
              </Button>
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
                {t('envvar.importExport.export')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={headerBusy}
                className="gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${(
                    detectionLoading
                    || activeAction === 'refresh'
                    || detectionState === 'loading-no-cache'
                    || detectionState === 'showing-cache-refreshing'
                  ) ? 'animate-spin' : ''}`}
                />
                {t('envvar.actions.refresh')}
              </Button>
              <Button size="sm" onClick={handleOpenAdd} className="gap-1.5" disabled={headerBusy}>
                <Plus className="h-3.5 w-3.5" />
                {t('envvar.actions.add')}
              </Button>
            </div>
          }
        />

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

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
          data-testid="envvar-tabs"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-3 sm:w-fit">
            <TabsTrigger value="variables" className="justify-center gap-1.5 sm:justify-start">
              <Variable className="h-3.5 w-3.5" />
              {t('envvar.tabs.variables')}
            </TabsTrigger>
            <TabsTrigger value="path" className="justify-center gap-1.5 sm:justify-start">
              <Route className="h-3.5 w-3.5" />
              {t('envvar.tabs.pathEditor')}
            </TabsTrigger>
            <TabsTrigger value="shells" className="justify-center gap-1.5 sm:justify-start">
              <Terminal className="h-3.5 w-3.5" />
              {t('envvar.tabs.shellProfiles')}
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
                  t={t}
                />
              </CardContent>
            </Card>
            {scopeFilter === 'all' && conflictsPanelDismissed ? (
              <div className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConflictsPanelDismissed(false)}
                  data-testid="envvar-conflicts-restore"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {t('envvar.conflicts.restore')}
                </Button>
              </div>
            ) : null}
            {scopeFilter === 'all' && !conflictsPanelDismissed && (
              <Card className="shrink-0 gap-0 py-0" data-testid="envvar-conflicts-summary">
                <CardHeader className="border-b px-3 py-3 sm:px-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">{t('envvar.conflicts.title')}</CardTitle>
                    <div className="flex items-center gap-1">
                      {visibleConflicts.length > 0 && (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground" data-testid="envvar-conflicts-count">
                          {visibleConflicts.length}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setConflictsPanelCollapsed((prev) => !prev)}
                        aria-label={conflictsPanelCollapsed ? t('envvar.conflicts.show') : t('envvar.conflicts.hide')}
                        data-testid="envvar-conflicts-toggle"
                      >
                        {conflictsPanelCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setConflictsPanelDismissed(true)}
                        aria-label={t('envvar.conflicts.dismiss')}
                        data-testid="envvar-conflicts-dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {!conflictsPanelCollapsed && (
                  <CardContent className="space-y-3 px-3 py-3 sm:px-4">
                    <div className="space-y-2 rounded-md border bg-background/70 p-2.5" data-testid="envvar-conflicts-ignore-settings">
                      <p className="text-xs text-muted-foreground">
                        {t('envvar.conflicts.ignoreDefaults', { keys: defaultIgnoredConflictKeys.join(', ') })}
                      </p>
                      {customIgnoredConflictKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1.5" data-testid="envvar-conflicts-custom-ignore-list">
                          {customIgnoredConflictKeys.map((key) => (
                            <span key={key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                              <span className="font-mono">{key}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                                onClick={() => handleRemoveIgnoredConflictKey(key)}
                                aria-label={`${t('common.delete')} ${key}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          value={conflictIgnoreInput}
                          onChange={(event) => setConflictIgnoreInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddIgnoredConflictKeys();
                            }
                          }}
                          placeholder={t('envvar.conflicts.ignorePlaceholder')}
                          className="h-8 text-xs"
                          data-testid="envvar-conflicts-ignore-input"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={handleAddIgnoredConflictKeys}
                          data-testid="envvar-conflicts-ignore-add"
                        >
                          {t('envvar.conflicts.ignoreAdd')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => persistCustomIgnoredConflictKeys([])}
                          disabled={customIgnoredConflictKeys.length === 0}
                          data-testid="envvar-conflicts-ignore-clear"
                        >
                          {t('common.clear')}
                        </Button>
                      </div>
                      {hiddenConflictCount > 0 && (
                        <p className="text-xs text-muted-foreground" data-testid="envvar-conflicts-hidden-count">
                          {t('envvar.conflicts.hiddenByIgnore', { count: hiddenConflictCount })}
                        </p>
                      )}
                    </div>

                    {visibleConflicts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t('envvar.conflicts.noConflicts')}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t('envvar.conflicts.description', { count: visibleConflicts.length })}
                        </p>
                        <div className="max-h-[32vh] overflow-y-auto pr-1" data-testid="envvar-conflicts-scroll-area">
                          {compactConflictView ? (
                            <div className="space-y-2" data-testid="envvar-conflicts-compact-list">
                              {visibleConflicts.map((conflict) => (
                                <div key={conflict.key} className="rounded-md border bg-background/90 p-2.5 text-xs" data-testid="envvar-conflict-item">
                                  <div className="font-mono text-xs font-semibold">{conflict.key}</div>
                                  <dl className="mt-2 space-y-1.5">
                                    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                                      <dt className="text-muted-foreground">{t('envvar.conflicts.userValue')}:</dt>
                                      <dd className="font-mono break-all">{conflict.userValue}</dd>
                                    </div>
                                    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                                      <dt className="text-muted-foreground">{t('envvar.conflicts.systemValue')}:</dt>
                                      <dd className="font-mono break-all">{conflict.systemValue}</dd>
                                    </div>
                                    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                                      <dt className="text-muted-foreground">{t('envvar.conflicts.effectiveValue')}:</dt>
                                      <dd className="font-mono font-semibold text-foreground break-all" data-testid="envvar-conflict-effective-value">
                                        {conflict.effectiveValue}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div data-testid="envvar-conflicts-table">
                              <Table className="table-fixed text-xs">
                                <TableHeader>
                                  <TableRow className="text-muted-foreground hover:bg-transparent">
                                    <TableHead className="w-28 pr-3">{t('envvar.conflicts.key')}</TableHead>
                                    <TableHead className="pr-3">{t('envvar.conflicts.userValue')}</TableHead>
                                    <TableHead className="pr-3">{t('envvar.conflicts.systemValue')}</TableHead>
                                    <TableHead>{t('envvar.conflicts.effectiveValue')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {visibleConflicts.map((conflict) => (
                                    <TableRow key={conflict.key} className="align-top">
                                      <TableCell className="pr-3 font-mono font-medium">{conflict.key}</TableCell>
                                      <TableCell className="pr-3 font-mono break-all text-muted-foreground">{conflict.userValue}</TableCell>
                                      <TableCell className="pr-3 font-mono break-all text-muted-foreground">{conflict.systemValue}</TableCell>
                                      <TableCell>
                                        <span className="font-mono font-semibold text-foreground break-all" data-testid="envvar-conflict-effective-value">
                                          {conflict.effectiveValue}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
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
