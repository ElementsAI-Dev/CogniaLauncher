'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { AlertCircle, Variable, Route, Terminal, Plus, Upload, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarScope, PersistentEnvVar } from '@/types/tauri';

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

export default function EnvVarPage() {
  const {
    envVars,
    pathEntries,
    shellProfiles,
    conflicts,
    loading,
    error,
    fetchAllVars,
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
    fetchPersistentVarsTyped,
    deduplicatePath,
    detectConflicts,
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
  const [userPersistentVars, setUserPersistentVars] = useState<PersistentEnvVar[]>([]);
  const [systemPersistentVars, setSystemPersistentVars] = useState<PersistentEnvVar[]>([]);
  const [activeTab, setActiveTab] = useState<'variables' | 'path' | 'shells'>('variables');
  const [activeAction, setActiveAction] = useState<EnvVarAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [compactConflictView, setCompactConflictView] = useState(false);

  const refreshVariables = useCallback(async (scope: EnvVarScope | 'all') => {
    if (!isTauri()) return;

    if (scope === 'all') {
      const [, userVars, systemVars] = await Promise.all([
        fetchAllVars(),
        fetchPersistentVarsTyped('user'),
        fetchPersistentVarsTyped('system'),
        detectConflicts(),
      ]);
      setUserPersistentVars(userVars);
      setSystemPersistentVars(systemVars);
      return;
    }

    if (scope === 'process') {
      await fetchAllVars();
      return;
    }

    const [typedVars] = await Promise.all([
      fetchPersistentVarsTyped(scope),
      detectConflicts(),
    ]);

    if (scope === 'user') {
      setUserPersistentVars(typedVars);
    } else {
      setSystemPersistentVars(typedVars);
    }
  }, [detectConflicts, fetchAllVars, fetchPersistentVarsTyped]);

  useEffect(() => {
    const syncViewport = () => setCompactConflictView(window.innerWidth < 768);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
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

  const envRows = useMemo(() => buildEnvVarRows({
    processVars: envVars,
    userPersistentVars,
    systemPersistentVars,
    scopeFilter,
    conflicts,
  }), [conflicts, envVars, scopeFilter, systemPersistentVars, userPersistentVars]);

  useEffect(() => {
    if (!initializedRef.current && isTauri()) {
      initializedRef.current = true;
      const timer = setTimeout(() => refreshVariables('all'), 0);
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
        setActionError(t('common.error'));
        return false;
      }
      await refreshVariables(resolveRefreshScope(scope));
      toast.success(successMessage);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
      return false;
    } finally {
      setActiveAction(null);
    }
  }, [refreshVariables, resolveRefreshScope, t]);

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
      await refreshVariables(scopeFilter);
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
        setActionError(t('common.error'));
      }
      return ok;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
      return false;
    } finally {
      setActiveAction(null);
    }
  }, [t]);

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

  const busy = loading || activeAction !== null;

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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title={t('envvar.title')}
        description={t('envvar.description')}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end" data-testid="envvar-header-actions">
            <div className="flex flex-wrap items-center justify-end gap-2" data-testid="envvar-header-actions-secondary">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportExportTab('import');
                  setImportExportOpen(true);
                }}
                className="gap-1.5"
                disabled={busy}
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
                disabled={busy}
              >
                <Download className="h-3.5 w-3.5" />
                {t('envvar.importExport.export')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2" data-testid="envvar-header-actions-primary">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={busy}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${(loading || activeAction === 'refresh') ? 'animate-spin' : ''}`} />
                {t('envvar.actions.refresh')}
              </Button>
              <Button size="sm" onClick={handleOpenAdd} className="gap-1.5" disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                {t('envvar.actions.add')}
              </Button>
            </div>
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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
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

        <TabsContent value="variables" className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          <EnvVarToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scopeFilter={scopeFilter}
            onScopeFilterChange={handleScopeFilterChange}
            disabled={busy}
            t={t}
          />
          {scopeFilter === 'all' && (
            <div className="rounded-md border bg-muted/30 px-3 py-3 space-y-2.5" data-testid="envvar-conflicts-summary">
              <div className="text-sm font-medium">{t('envvar.conflicts.title')}</div>
              {conflicts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('envvar.conflicts.noConflicts')}
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t('envvar.conflicts.description', { count: conflicts.length })}
                  </p>
                  {compactConflictView ? (
                    <div className="space-y-2" data-testid="envvar-conflicts-compact-list">
                      {conflicts.map((conflict) => (
                        <div key={conflict.key} className="rounded-md border bg-background/80 p-2 text-xs">
                          <div className="font-mono font-medium">{conflict.key}</div>
                          <div className="mt-1 grid gap-1 text-muted-foreground">
                            <p>{t('envvar.conflicts.userValue')}: <span className="font-mono">{conflict.userValue}</span></p>
                            <p>{t('envvar.conflicts.systemValue')}: <span className="font-mono">{conflict.systemValue}</span></p>
                            <p>{t('envvar.conflicts.effectiveValue')}: <span className="font-mono text-foreground">{conflict.effectiveValue}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto" data-testid="envvar-conflicts-table">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="text-left font-medium py-1.5 pr-3">{t('envvar.conflicts.key')}</th>
                            <th className="text-left font-medium py-1.5 pr-3">{t('envvar.conflicts.userValue')}</th>
                            <th className="text-left font-medium py-1.5 pr-3">{t('envvar.conflicts.systemValue')}</th>
                            <th className="text-left font-medium py-1.5">{t('envvar.conflicts.effectiveValue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conflicts.map((conflict) => (
                            <tr key={conflict.key} className="border-b last:border-b-0">
                              <td className="font-mono py-1.5 pr-3">{conflict.key}</td>
                              <td className="font-mono py-1.5 pr-3">{conflict.userValue}</td>
                              <td className="font-mono py-1.5 pr-3">{conflict.systemValue}</td>
                              <td className="font-mono py-1.5">{conflict.effectiveValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <EnvVarTable
            rows={envRows}
            scopeFilter={scopeFilter}
            searchQuery={searchQuery}
            onEdit={handleEdit}
            onDelete={handleDelete}
            busy={busy}
            t={t}
          />
        </TabsContent>

        <TabsContent value="path" className="mt-3 sm:mt-4">
          <EnvVarPathEditor
            pathEntries={pathEntries}
            pathScope={pathScope}
            onPathScopeChange={handlePathScopeChange}
            onAdd={(path, position) => runPathMutation('path-add', () => addPathEntry(path, pathScope, position))}
            onRemove={(path) => runPathMutation('path-remove', () => removePathEntry(path, pathScope))}
            onReorder={(entries) => runPathMutation('path-reorder', () => reorderPath(entries, pathScope))}
            onDeduplicate={handlePathDeduplicate}
            onRefresh={() => fetchPath(pathScope)}
            loading={busy}
            t={t}
          />
        </TabsContent>

        <TabsContent value="shells" className="mt-3 sm:mt-4">
          <EnvVarShellProfiles
            profiles={shellProfiles}
            onReadProfile={readShellProfile}
            t={t}
          />
        </TabsContent>
      </Tabs>

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
              await refreshVariables(resolveRefreshScope(scope));
            } else {
              setActionError(t('common.error'));
            }
            return result;
          } catch (err) {
            setActionError(err instanceof Error ? err.message : String(err));
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
              setActionError(t('common.error'));
            }
            return result;
          } catch (err) {
            setActionError(err instanceof Error ? err.message : String(err));
            return null;
          } finally {
            setActiveAction(null);
          }
        }}
        defaultTab={importExportTab}
        busy={busy}
        t={t}
      />
    </div>
  );
}
