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

  const handleScopeFilterChange = useCallback((scope: EnvVarScope | 'all') => {
    setScopeFilter(scope);
    refreshVariables(scope);
  }, [refreshVariables]);

  const handleEdit = useCallback((key: string, value: string, scope: EnvVarScope) => {
    setVar(key, value, scope).then((ok) => {
      if (ok) {
        toast.success(t('common.saved'));
        refreshVariables(scopeFilter);
      }
    });
  }, [refreshVariables, scopeFilter, setVar, t]);

  const handleDelete = useCallback((key: string, scope: EnvVarScope) => {
    removeVar(key, scope).then((ok) => {
      if (ok) {
        toast.success(t('common.deleted'));
        refreshVariables(scopeFilter);
      }
    });
  }, [refreshVariables, removeVar, scopeFilter, t]);

  const handleAddSave = useCallback((key: string, value: string, scope: EnvVarScope) => {
    setVar(key, value, scope).then((ok) => {
      if (ok) {
        toast.success(t('common.saved'));
        refreshVariables(scopeFilter);
      }
    });
  }, [refreshVariables, scopeFilter, setVar, t]);

  const handleOpenAdd = useCallback(() => {
    setEditKey(undefined);
    setEditValue(undefined);
    setEditDialogOpen(true);
  }, []);

  if (!isTauri()) {
    return (
      <div className="p-4 md:p-6">
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
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('envvar.title')}
        description={t('envvar.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setImportExportTab('import'); setImportExportOpen(true); }} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {t('envvar.importExport.import')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setImportExportTab('export'); setImportExportOpen(true); }} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {t('envvar.importExport.export')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshVariables(scopeFilter)}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('envvar.actions.refresh')}
            </Button>
            <Button size="sm" onClick={handleOpenAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('envvar.actions.add')}
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="variables" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="variables" className="gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            {t('envvar.tabs.variables')}
          </TabsTrigger>
          <TabsTrigger value="path" className="gap-1.5">
            <Route className="h-3.5 w-3.5" />
            {t('envvar.tabs.pathEditor')}
          </TabsTrigger>
          <TabsTrigger value="shells" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            {t('envvar.tabs.shellProfiles')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="space-y-4 mt-4">
          <EnvVarToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scopeFilter={scopeFilter}
            onScopeFilterChange={handleScopeFilterChange}
            t={t}
          />
          {scopeFilter === 'all' && (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2">
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
                  <div className="overflow-x-auto">
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
            t={t}
          />
        </TabsContent>

        <TabsContent value="path" className="mt-4">
          <EnvVarPathEditor
            pathEntries={pathEntries}
            pathScope={pathScope}
            onPathScopeChange={handlePathScopeChange}
            onAdd={(path, position) => addPathEntry(path, pathScope, position)}
            onRemove={(path) => removePathEntry(path, pathScope)}
            onReorder={(entries) => reorderPath(entries, pathScope)}
            onDeduplicate={() => deduplicatePath(pathScope)}
            onRefresh={() => fetchPath(pathScope)}
            loading={loading}
            t={t}
          />
        </TabsContent>

        <TabsContent value="shells" className="mt-4">
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
        t={t}
      />

      <EnvVarImportExport
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        onImport={async (content, scope) => {
          const result = await importEnvFile(content, scope);
          if (result) {
            await refreshVariables(scopeFilter);
          }
          return result;
        }}
        onExport={exportEnvFile}
        defaultTab={importExportTab}
        t={t}
      />
    </div>
  );
}
