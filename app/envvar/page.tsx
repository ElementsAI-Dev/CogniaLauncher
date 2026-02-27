'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { AlertCircle, Variable, Route, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import type { EnvVarScope } from '@/types/tauri';

export default function EnvVarPage() {
  const {
    envVars,
    persistentVars,
    pathEntries,
    shellProfiles,
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
    fetchPersistentVars,
    deduplicatePath,
  } = useEnvVar();

  const { t } = useLocale();
  const initializedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<EnvVarScope | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | undefined>();
  const [editValue, setEditValue] = useState<string | undefined>();
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [pathScope, setPathScope] = useState<EnvVarScope>('process');

  useEffect(() => {
    if (!initializedRef.current && isTauri()) {
      initializedRef.current = true;
      fetchAllVars();
    }
  }, [fetchAllVars]);

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
    if (isTauri()) {
      if (scope === 'all' || scope === 'process') {
        fetchAllVars();
      } else {
        fetchPersistentVars(scope);
      }
    }
  }, [fetchAllVars, fetchPersistentVars]);

  const handleEdit = useCallback((key: string, value: string) => {
    setVar(key, value, 'process').then((ok) => {
      if (ok) {
        toast.success(t('common.saved'));
        fetchAllVars();
      }
    });
  }, [setVar, fetchAllVars, t]);

  const handleDelete = useCallback((key: string) => {
    removeVar(key, 'process').then((ok) => {
      if (ok) {
        toast.success(t('common.deleted'));
      }
    });
  }, [removeVar, t]);

  const handleAddSave = useCallback((key: string, value: string, scope: EnvVarScope) => {
    setVar(key, value, scope).then((ok) => {
      if (ok) {
        toast.success(t('common.saved'));
        fetchAllVars();
      }
    });
  }, [setVar, fetchAllVars, t]);

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
            onRefresh={() => scopeFilter === 'user' || scopeFilter === 'system' ? fetchPersistentVars(scopeFilter) : fetchAllVars()}
            onAdd={handleOpenAdd}
            onImport={() => setImportExportOpen(true)}
            onExport={() => setImportExportOpen(true)}
            isLoading={loading}
            t={t}
          />
          <EnvVarTable
            envVars={envVars}
            persistentVars={persistentVars}
            scope={scopeFilter}
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
        onImport={importEnvFile}
        onExport={exportEnvFile}
        t={t}
      />
    </div>
  );
}
