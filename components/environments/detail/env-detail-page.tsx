'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EnvDetailHeader,
  EnvDetailOverview,
  EnvDetailVersions,
  EnvDetailPackages,
  EnvDetailSettings,
  EnvDetailShell,
  EnvDetailShims,
  RustToolchainPanel,
  CondaEnvironmentPanel,
  GoToolsPanel,
} from '@/components/environments/detail';
import { ENV_TYPE_TO_PROVIDERS } from '@/components/environments/detail/env-detail-packages';
import { VersionBrowserPanel } from '@/components/environments/version-browser-panel';
import { InstallationProgressDialog } from '@/components/environments/installation-progress-dialog';
import { EnvironmentWorkflowBanner } from '@/components/environments/environment-workflow-banner';
import { useEnvironments } from '@/hooks/environments/use-environments';
import { useEnvironmentDetection } from '@/hooks/environments/use-environment-detection';
import { useEnvironmentWorkflow } from '@/hooks/environments/use-environment-workflow';
import { useEnvironmentStore, getLogicalEnvType } from '@/lib/stores/environment';
import { useTerminalStore } from '@/lib/stores/terminal';
import { useAutoVersionSwitch, useProjectPath } from '@/hooks/environments/use-auto-version';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { LayoutDashboard, Layers, Package, Settings2, Terminal, Link2, Monitor, Wrench } from 'lucide-react';
import { isTauri, terminalLaunchProfile } from '@/lib/tauri';

interface EnvDetailPageClientProps {
  envType: string;
}

export function EnvDetailPageClient({ envType }: EnvDetailPageClientProps) {
  const isDesktop = isTauri();
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
    cleanupVersions,
  } = useEnvironments();

  const {
    versionBrowserOpen,
    closeVersionBrowser,
    openVersionBrowser,
    getSelectedProvider,
    setSelectedProvider,
  } = useEnvironmentStore();
  const { syncWorkflowContext, setWorkflowActionState } = useEnvironmentWorkflow();
  const defaultProfileId = useTerminalStore((state) => state.defaultProfileId);
  const terminalStoreLoading = useTerminalStore((state) => state.loading);
  const hydrateTerminalStore = useTerminalStore((state) => state.hydrate);
  const markProfileLaunched = useTerminalStore((state) => state.markProfileLaunched);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getProjectDetectedForEnv } = useEnvironmentDetection({
    detectedVersions,
    availableProviders,
  });

  // Project path and auto version switch
  const { projectPath } = useProjectPath();
  useAutoVersionSwitch({ projectPath, enabled: isDesktop });

  // Track initialization
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isDesktop || initializedRef.current) return;
    initializedRef.current = true;
    fetchEnvironments();
    fetchProviders();
    detectVersions(projectPath || '.');
  }, [fetchEnvironments, fetchProviders, detectVersions, isDesktop, projectPath]);

  useEffect(() => {
    if (!isDesktop || defaultProfileId || terminalStoreLoading) return;
    void hydrateTerminalStore();
  }, [
    defaultProfileId,
    hydrateTerminalStore,
    isDesktop,
    terminalStoreLoading,
  ]);

  // Find current environment data
  // Backend returns env_type as provider ID (e.g., "fnm"), but URL uses language type (e.g., "node")
  // So we need to match by resolving each env's provider ID to its logical language type
  const env = environments.find((e) => {
    if (e.env_type === envType) return true;
    return getLogicalEnvType(e.env_type, availableProviders) === envType;
  }) || null;

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

  const currentProviderId = getSelectedProvider(envType, env?.provider_id || envType);
  const detectedVersion = getProjectDetectedForEnv(
    envType,
    env?.provider_id ?? currentProviderId,
  );
  const hasPackagesTab = (ENV_TYPE_TO_PROVIDERS[envType]?.length ?? 0) > 0;
  const hasRustToolchainTab = envType === 'rust';
  const hasCondaPanelTab = envType === 'python' && envProviders().some((provider) => provider.id === 'conda');
  const hasGoToolsTab = envType === 'go';

  useEffect(() => {
    syncWorkflowContext(envType, {
      returnHref: '/environments',
      projectPath: projectPath || null,
      providerId: currentProviderId,
    });
  }, [currentProviderId, envType, projectPath, syncWorkflowContext]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setWorkflowActionState(envType, 'refresh', 'running', {
      providerId: currentProviderId,
      projectPath: projectPath || null,
    });
    try {
      await fetchEnvironments(true);
      await detectVersions(projectPath || '.', { force: true });
      setWorkflowActionState(envType, 'refresh', 'success', {
        providerId: currentProviderId,
        projectPath: projectPath || null,
      });
    } catch (error) {
      setWorkflowActionState(envType, 'refresh', 'error', {
        providerId: currentProviderId,
        projectPath: projectPath || null,
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    currentProviderId,
    detectVersions,
    envType,
    fetchEnvironments,
    projectPath,
    setWorkflowActionState,
  ]);

  const handleInstallVersion = useCallback(
    async (version: string, providerId?: string) => {
      const targetProviderId = providerId ?? currentProviderId;
      await installVersion(envType, version, targetProviderId);
    },
    [envType, currentProviderId, installVersion],
  );

  const handleUninstallVersion = useCallback(
    async (version: string) => {
      await uninstallVersion(envType, version, currentProviderId);
    },
    [currentProviderId, envType, uninstallVersion],
  );

  const handleSetGlobalVersion = useCallback(
    async (version: string) => {
      await setGlobalVersion(envType, version, currentProviderId);
    },
    [currentProviderId, envType, setGlobalVersion],
  );

  const handleSetLocalVersion = useCallback(
    async (version: string, path: string) => {
      await setLocalVersion(envType, version, path, currentProviderId);
    },
    [currentProviderId, envType, setLocalVersion],
  );

  const handleOpenVersionBrowser = useCallback(() => {
    openVersionBrowser(envType);
  }, [envType, openVersionBrowser]);

  const handleOpenInTerminal = useCallback(async () => {
    if (!defaultProfileId) {
      toast.error(t('environments.detail.openInTerminalMissingDefaultProfile'));
      return;
    }

    await terminalLaunchProfile(defaultProfileId, {
      envType,
      envVersion: env?.current_version ?? detectedVersion?.version ?? undefined,
      cwd: projectPath || undefined,
    });
    markProfileLaunched(defaultProfileId);
  }, [
    defaultProfileId,
    detectedVersion?.version,
    env?.current_version,
    envType,
    markProfileLaunched,
    projectPath,
    t,
  ]);

  if (!isDesktop) {
    return (
      <div className="p-4 md:p-6">
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Monitor />
            </EmptyMedia>
            <EmptyTitle>{t("environments.desktopOnly")}</EmptyTitle>
            <EmptyDescription>{t("environments.desktopOnlyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <EnvDetailHeader
        envType={envType}
        env={env}
        detectedVersion={detectedVersion}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onOpenVersionBrowser={handleOpenVersionBrowser}
        onOpenInTerminal={handleOpenInTerminal}
        t={t}
      />
      <EnvironmentWorkflowBanner
        envType={envType}
        projectPath={projectPath}
        providerLabel={env?.provider || currentProviderId}
        onRefresh={handleRefresh}
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
          {hasPackagesTab && (
            <TabsTrigger value="packages" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {t('environments.detail.tabPackages')}
            </TabsTrigger>
          )}
          {hasRustToolchainTab && (
            <TabsTrigger value="rustToolchain" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t('environments.detail.tabRustToolchain')}
            </TabsTrigger>
          )}
          {hasCondaPanelTab && (
            <TabsTrigger value="conda" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t('environments.detail.tabConda')}
            </TabsTrigger>
          )}
          {hasGoToolsTab && (
            <TabsTrigger value="goTools" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t('environments.detail.tabGoTools')}
            </TabsTrigger>
          )}
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {t('environments.detail.tabSettings')}
          </TabsTrigger>
          <TabsTrigger value="shell" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            {t('environments.detail.tabShell')}
          </TabsTrigger>
          <TabsTrigger value="shims" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            {t('environments.detail.tabShims')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <EnvDetailOverview
            envType={envType}
            env={env}
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
            onProviderChange={(providerId) => setSelectedProvider(envType, providerId)}
            loading={loading}
            onCleanup={(versions) => cleanupVersions(envType, versions)}
            t={t}
          />
        </TabsContent>

        {hasPackagesTab && (
          <TabsContent value="packages">
            <EnvDetailPackages envType={envType} t={t} />
          </TabsContent>
        )}

        {hasRustToolchainTab && (
          <TabsContent value="rustToolchain">
            <RustToolchainPanel />
          </TabsContent>
        )}

        {hasCondaPanelTab && (
          <TabsContent value="conda">
            <CondaEnvironmentPanel />
          </TabsContent>
        )}

        {hasGoToolsTab && (
          <TabsContent value="goTools">
            <GoToolsPanel />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <EnvDetailSettings envType={envType} t={t} />
        </TabsContent>

        <TabsContent value="shell">
          <EnvDetailShell
            envType={envType}
            currentVersion={env?.current_version}
            t={t}
          />
        </TabsContent>

        <TabsContent value="shims">
          <EnvDetailShims envType={envType} t={t} />
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
