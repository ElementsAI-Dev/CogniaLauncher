'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { EnvironmentCard } from '@/components/environments/environment-card';
import { AddEnvironmentDialog, type AddEnvironmentOptions } from '@/components/environments/add-environment-dialog';
import { InstallationProgressDialog } from '@/components/environments/installation-progress-dialog';
import { VersionBrowserPanel } from '@/components/environments/version-browser-panel';
import { EnvironmentDetailsPanel } from '@/components/environments/environment-details-panel';
import { EnvironmentErrorBoundary, EnvironmentCardErrorBoundary } from '@/components/environments/environment-error-boundary';
import { EmptyState } from '@/components/environments/empty-state';
import { EnvironmentBatchOperations } from '@/components/environments/batch-operations';
import { EnvironmentToolbar } from '@/components/environments/environment-toolbar';
import { ProfileManager } from '@/components/environments/profile-manager';
import { PageHeader } from '@/components/layout/page-header';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironments } from '@/hooks/use-environments';
import { useAutoVersionSwitch, useProjectPath } from '@/hooks/use-auto-version';
import { useLocale } from '@/components/providers/locale-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, Bookmark } from 'lucide-react';

export default function EnvironmentsPage() {
  const {
    environments,
    detectedVersions,
    availableProviders,
    loading,
    error,
    fetchEnvironments,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    fetchProviders,
    openAddDialog,
  } = useEnvironments();
  
  const {
    versionBrowserOpen,
    versionBrowserEnvType,
    closeVersionBrowser,
    detailsPanelOpen,
    detailsPanelEnvType,
    closeDetailsPanel,
    selectedVersions,
    clearVersionSelection,
    searchQuery,
    statusFilter,
    sortBy,
    viewMode,
    setSearchQuery,
    setStatusFilter,
    setSortBy,
    setViewMode,
    clearFilters,
  } = useEnvironmentStore();
  const { t } = useLocale();
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({});
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);

  // Project path and auto version switch
  const { projectPath } = useProjectPath();
  useAutoVersionSwitch({ projectPath, enabled: true });

  // Track initialization to prevent duplicate fetches on re-renders
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchEnvironments();
      fetchProviders();
      detectVersions('.');
    }
  }, [fetchEnvironments, fetchProviders, detectVersions]);

  const getDetectedForEnv = (envType: string) => {
    return detectedVersions.find((d) => d.env_type === envType) || null;
  };

  const getEnvByType = (envType: string | null) => {
    if (!envType) return null;
    return environments.find((e) => e.env_type === envType) || null;
  };

  const getEnvKey = useCallback((envType: string) => {
    const provider = availableProviders.find((item) => item.id === envType);
    return provider?.env_type ?? envType;
  }, [availableProviders]);

  const getProvidersForEnv = useCallback((envType: string) => {
    const envKey = getEnvKey(envType);
    return availableProviders
      .filter(p => p.env_type === envKey)
      .map(p => ({ id: p.id, name: p.display_name }));
  }, [availableProviders, getEnvKey]);

  const getSelectedProvider = useCallback((envType: string) => {
    const envKey = getEnvKey(envType);
    return selectedProviders[envKey] || envType;
  }, [getEnvKey, selectedProviders]);

  const handleProviderChange = useCallback((envType: string, providerId: string) => {
    const envKey = getEnvKey(envType);
    setSelectedProviders((prev) => ({
      ...prev,
      [envKey]: providerId,
    }));
  }, [getEnvKey]);

  const currentBrowserEnv = getEnvByType(versionBrowserEnvType);
  const currentDetailsEnv = getEnvByType(detailsPanelEnvType);

  const handleRefresh = useCallback(async () => {
    await fetchEnvironments();
    await detectVersions('.');
  }, [fetchEnvironments, detectVersions]);

  // Filter and sort environments
  const filteredEnvironments = useMemo(() => {
    return environments
      .filter((env) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesType = env.env_type.toLowerCase().includes(query);
          const matchesProvider = env.provider.toLowerCase().includes(query);
          if (!matchesType && !matchesProvider) {
            return false;
          }
        }
        // Status filter
        if (statusFilter === 'available' && !env.available) return false;
        if (statusFilter === 'unavailable' && env.available) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'installed_count':
            return b.installed_versions.length - a.installed_versions.length;
          case 'provider':
            return a.provider.localeCompare(b.provider);
          case 'name':
          default:
            return a.env_type.localeCompare(b.env_type);
        }
      });
  }, [environments, searchQuery, statusFilter, sortBy]);

  const handleAddEnvironment = useCallback(async (_language: string, provider: string, version: string, options: AddEnvironmentOptions) => {
    await installVersion(provider, version, provider);
    
    // Apply autoSwitch setting
    if (options.autoSwitch) {
      const { setEnvSettings, getEnvSettings } = useEnvironmentStore.getState();
      const currentSettings = getEnvSettings(provider);
      setEnvSettings(provider, {
        ...currentSettings,
        autoSwitch: options.autoSwitch,
      });
    }
    
    // Set as default/global version after successful installation
    if (options.setAsDefault) {
      try {
        // Resolve the version if it's an alias (lts, latest)
        const resolvedVersion = version.trim().toLowerCase();
        const isAlias = ['latest', 'newest', 'current', 'lts', 'stable'].includes(resolvedVersion);
        if (!isAlias) {
          await setGlobalVersion(provider, version);
        }
        // For aliases, the install already resolved the version, 
        // and the backend may have set it as default during install
      } catch {
        // Setting as default is best-effort, don't fail the whole operation
      }
    }
  }, [installVersion, setGlobalVersion]);

  // Memoized handlers to prevent unnecessary re-renders
  const handleInstallVersion = useCallback(async (envType: string, version: string, providerId?: string) => {
    const targetEnvType = providerId ?? envType;
    await installVersion(targetEnvType, version, providerId);
  }, [installVersion]);

  const handleUninstallVersion = useCallback(async (envType: string, version: string) => {
    await uninstallVersion(envType, version);
  }, [uninstallVersion]);

  const handleSetGlobalVersion = useCallback(async (envType: string, version: string) => {
    await setGlobalVersion(envType, version);
  }, [setGlobalVersion]);

  const handleSetLocalVersion = useCallback(async (envType: string, version: string, projectPath: string) => {
    await setLocalVersion(envType, version, projectPath);
  }, [setLocalVersion]);

  const handleBatchInstall = useCallback(async (versions: { envType: string; version: string }[]) => {
    for (const v of versions) {
      await installVersion(v.envType, v.version);
    }
  }, [installVersion]);

  const handleBatchUninstall = useCallback(async (versions: { envType: string; version: string }[]) => {
    for (const v of versions) {
      await uninstallVersion(v.envType, v.version);
    }
  }, [uninstallVersion]);

  return (
    <EnvironmentErrorBoundary
      fallbackTitle={t('environments.errorBoundary.title')}
      fallbackDescription={t('environments.errorBoundary.description')}
      retryLabel={t('environments.errorBoundary.tryAgain')}
    >
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title={t('environments.title')}
          description={t('environments.description')}
          actions={(
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setProfileManagerOpen(true)} className="gap-2">
                <Bookmark className="h-4 w-4" />
                {t('environments.profiles.title')}
              </Button>
              <Button size="sm" onClick={openAddDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('environments.addEnvironment')}
              </Button>
            </div>
          )}
        />

        <EnvironmentToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRefresh={handleRefresh}
          onClearFilters={clearFilters}
          isLoading={loading}
          totalCount={environments.length}
          filteredCount={filteredEnvironments.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          t={t}
        />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && environments.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEnvironments.length === 0 ? (
        environments.length === 0 ? (
          <EmptyState onAddEnvironment={openAddDialog} t={t} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('environments.noMatchingEnvironments')}</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              {t('environments.toolbar.clearAll')}
            </Button>
          </div>
        )
      ) : (
        <div className={viewMode === 'grid' ? 'grid gap-4 grid-cols-1 lg:grid-cols-2' : 'space-y-3'}>
          {filteredEnvironments.map((env) => (
            <EnvironmentCardErrorBoundary key={env.env_type} envType={env.env_type} t={t}>
              <EnvironmentCard
                env={env}
                detectedVersion={getDetectedForEnv(env.env_type)}
                onInstall={(version, providerId) => handleInstallVersion(env.env_type, version, providerId)}
                onUninstall={(version) => handleUninstallVersion(env.env_type, version)}
                onSetGlobal={(version) => handleSetGlobalVersion(env.env_type, version)}
                onSetLocal={(version, projectPath) => handleSetLocalVersion(env.env_type, version, projectPath)}
                loading={loading}
                availableProviders={getProvidersForEnv(env.env_type)}
                onProviderChange={(providerId) => handleProviderChange(env.env_type, providerId)}
                selectedProviderId={getSelectedProvider(env.env_type)}
              />
            </EnvironmentCardErrorBoundary>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddEnvironmentDialog onAdd={handleAddEnvironment} />
      <InstallationProgressDialog />

      {/* Batch Operations */}
      <EnvironmentBatchOperations
        selectedVersions={selectedVersions}
        onBatchInstall={handleBatchInstall}
        onBatchUninstall={handleBatchUninstall}
        onClearSelection={clearVersionSelection}
      />

      {/* Profile Manager */}
      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={setProfileManagerOpen}
      />

      {/* Panels */}
      {currentBrowserEnv && (
        <VersionBrowserPanel
          envType={currentBrowserEnv.env_type}
          open={versionBrowserOpen}
          onOpenChange={(open) => !open && closeVersionBrowser()}
          onInstall={(version, providerId) => handleInstallVersion(currentBrowserEnv.env_type, version, providerId)}
          onUninstall={(version) => handleUninstallVersion(currentBrowserEnv.env_type, version)}
          installedVersions={currentBrowserEnv.installed_versions.map((v) => v.version)}
          providerId={getSelectedProvider(currentBrowserEnv.env_type)}
        />
      )}

      {currentDetailsEnv && (
        <EnvironmentDetailsPanel
          env={currentDetailsEnv}
          detectedVersion={getDetectedForEnv(currentDetailsEnv.env_type)}
          open={detailsPanelOpen}
          onOpenChange={(open) => !open && closeDetailsPanel()}
          onSetGlobal={(version) => handleSetGlobalVersion(currentDetailsEnv.env_type, version)}
          onSetLocal={(version, projectPath) => handleSetLocalVersion(currentDetailsEnv.env_type, version, projectPath)}
          onUninstall={(version) => handleUninstallVersion(currentDetailsEnv.env_type, version)}
          onRefresh={async () => {
            await fetchEnvironments();
          }}
        />
      )}
      </div>
    </EnvironmentErrorBoundary>
  );
}
