'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EnvDetailHeader,
  EnvDetailOverview,
  EnvDetailVersions,
  EnvDetailPackages,
  EnvDetailSettings,
} from '@/components/environments/detail';
import { VersionBrowserPanel } from '@/components/environments/version-browser-panel';
import { InstallationProgressDialog } from '@/components/environments/installation-progress-dialog';
import { useEnvironments } from '@/hooks/use-environments';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useAutoVersionSwitch, useProjectPath } from '@/hooks/use-auto-version';
import { useLocale } from '@/components/providers/locale-provider';
import { LayoutDashboard, Layers, Package, Settings2 } from 'lucide-react';

interface EnvDetailPageClientProps {
  envType: string;
}

export function EnvDetailPageClient({ envType }: EnvDetailPageClientProps) {
  const { t } = useLocale();

  const {
    environments,
    detectedVersions,
    availableProviders,
    loading,
    fetchEnvironments,
    installVersion,
    uninstallVersion,
    setGlobalVersion,
    setLocalVersion,
    detectVersions,
    fetchProviders,
  } = useEnvironments();

  const {
    versionBrowserOpen,
    closeVersionBrowser,
    openVersionBrowser,
  } = useEnvironmentStore();

  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Project path and auto version switch
  const { projectPath } = useProjectPath();
  useAutoVersionSwitch({ projectPath, enabled: true });

  // Track initialization
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchEnvironments();
      fetchProviders();
      detectVersions('.');
    }
  }, [fetchEnvironments, fetchProviders, detectVersions]);

  // Find current environment data
  const env = environments.find((e) => e.env_type === envType) || null;
  const detectedVersion =
    detectedVersions.find((d) => d.env_type === envType) || null;

  // Get providers for this env type
  const getEnvKey = useCallback(
    (et: string) => {
      const provider = availableProviders.find((item) => item.id === et);
      return provider?.env_type ?? et;
    },
    [availableProviders],
  );

  const envProviders = useCallback(() => {
    const envKey = getEnvKey(envType);
    return availableProviders
      .filter((p) => p.env_type === envKey)
      .map((p) => ({ id: p.id, name: p.display_name }));
  }, [availableProviders, envType, getEnvKey]);

  const currentProviderId = selectedProviderId || env?.provider_id || envType;

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchEnvironments();
      await detectVersions('.');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEnvironments, detectVersions]);

  const handleInstallVersion = useCallback(
    async (version: string, providerId?: string) => {
      const targetProviderId = providerId ?? currentProviderId;
      await installVersion(envType, version, targetProviderId);
    },
    [envType, currentProviderId, installVersion],
  );

  const handleUninstallVersion = useCallback(
    async (version: string) => {
      await uninstallVersion(envType, version);
    },
    [envType, uninstallVersion],
  );

  const handleSetGlobalVersion = useCallback(
    async (version: string) => {
      await setGlobalVersion(envType, version);
    },
    [envType, setGlobalVersion],
  );

  const handleSetLocalVersion = useCallback(
    async (version: string, path: string) => {
      await setLocalVersion(envType, version, path);
    },
    [envType, setLocalVersion],
  );

  const handleOpenVersionBrowser = useCallback(() => {
    openVersionBrowser(envType);
  }, [envType, openVersionBrowser]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <EnvDetailHeader
        envType={envType}
        env={env}
        detectedVersion={detectedVersion}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onOpenVersionBrowser={handleOpenVersionBrowser}
        t={t}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('environments.detail.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {t('environments.detail.tabVersions')}
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {t('environments.detail.tabPackages')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {t('environments.detail.tabSettings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <EnvDetailOverview
            envType={envType}
            env={env}
            detectedVersion={detectedVersion}
            t={t}
          />
        </TabsContent>

        <TabsContent value="versions">
          <EnvDetailVersions
            envType={envType}
            env={env}
            onInstall={handleInstallVersion}
            onUninstall={handleUninstallVersion}
            onSetGlobal={handleSetGlobalVersion}
            onSetLocal={handleSetLocalVersion}
            onOpenVersionBrowser={handleOpenVersionBrowser}
            availableProviders={envProviders()}
            selectedProviderId={currentProviderId}
            onProviderChange={setSelectedProviderId}
            loading={loading}
            t={t}
          />
        </TabsContent>

        <TabsContent value="packages">
          <EnvDetailPackages envType={envType} t={t} />
        </TabsContent>

        <TabsContent value="settings">
          <EnvDetailSettings envType={envType} t={t} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <InstallationProgressDialog />

      {/* Version Browser Panel */}
      {env && (
        <VersionBrowserPanel
          envType={env.env_type}
          open={versionBrowserOpen}
          onOpenChange={(open) => !open && closeVersionBrowser()}
          onInstall={handleInstallVersion}
          onUninstall={handleUninstallVersion}
          installedVersions={env.installed_versions.map((v) => v.version)}
          providerId={currentProviderId}
        />
      )}
    </div>
  );
}
