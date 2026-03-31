'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/toolbox/use-toolbox';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { usePluginStore } from '@/lib/stores/plugin';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { BuiltInToolRenderer } from '@/components/toolbox/built-in-tool-renderer';
import { ToolRuntimeState } from '@/components/toolbox/tool-runtime-state';
import {
  evaluatePluginHealthStatus,
  mapGrantedPermissionsToCapabilities,
  type PluginHealthStatus,
} from '@/lib/plugin-governance';
import { ArrowLeft, Plug } from 'lucide-react';
import Link from 'next/link';
import { getPluginMarketplaceHref } from '@/lib/plugin-source';
import { resolveToolDetailRuntimeContext } from '@/lib/toolbox/tool-detail-runtime';
import { isTauri } from '@/lib/tauri';
import type { PluginSdkCapabilityCoverage } from '@/types/plugin';

export function ToolDetailPageClient({ toolId }: { toolId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const addRecent = useToolboxStore((s) => s.addRecent);
  const toolLifecycles = useToolboxStore((s) => s.toolLifecycles);
  const installedPlugins = usePluginStore((s) => s.installedPlugins);
  const pluginTools = usePluginStore((s) => s.pluginTools);
  const healthMap = usePluginStore((s) => s.healthMap);
  const permissionMode = usePluginStore((s) => s.permissionMode);
  const permissionStates = usePluginStore((s) => s.permissionStates);
  const { allTools } = useToolbox();

  const runtime = useMemo(
    () =>
      resolveToolDetailRuntimeContext({
        toolId,
        allTools,
        pluginTools,
        installedPlugins,
        healthMap,
        permissionMode,
        permissionStates,
        isDesktop: isTauri(),
        t,
      }),
    [allTools, healthMap, installedPlugins, permissionMode, permissionStates, pluginTools, t, toolId],
  );

  const tool = runtime.tool;
  const recoveryState = runtime.recoveryState;

  useEffect(() => {
    if (tool && !recoveryState) addRecent(tool.id);
  }, [addRecent, recoveryState, tool]);

  const lifecycle = tool ? toolLifecycles[tool.id] : undefined;
  const pluginGovernance = useMemo(() => {
    if (!tool?.pluginTool) return null;
    const pluginId = tool.pluginTool.pluginId;
    const pluginInfo = installedPlugins.find((plugin) => plugin.id === pluginId);
    const healthStatus = evaluatePluginHealthStatus(
      healthMap[pluginId],
      pluginInfo?.enabled ?? true,
    );
    const declaredCapabilities = [...new Set(tool.pluginTool.capabilityDeclarations ?? [])].sort();
    const grantedCapabilities = mapGrantedPermissionsToCapabilities([
      ...(permissionStates[pluginId]?.granted ?? []),
    ]);
    const missingCapabilities = grantedCapabilities.filter(
      (capability) => !declaredCapabilities.includes(capability),
    );
    const deprecationWarnings = [
      ...(pluginInfo?.deprecationWarnings ?? []),
      ...(tool.deprecationWarnings ?? []),
    ];

    return {
      pluginId,
      pluginPointId: tool.pluginTool.pluginPointId ?? null,
      healthStatus,
      declaredCapabilities,
      grantedCapabilities,
      missingCapabilities,
      deprecationWarnings,
      compatibilityReason:
        tool.pluginTool.compatibility && !tool.pluginTool.compatibility.compatible
          ? tool.pluginTool.compatibility.reason
          : null,
      sdkCapabilityCoverage: tool.pluginTool.sdkCapabilityCoverage ?? [],
    };
  }, [healthMap, installedPlugins, permissionStates, tool]);

  const recoveryActions = recoveryState ? (
    <>
      <Button variant="outline" size="sm" onClick={() => router.push('/toolbox')}>
        {t('toolbox.actions.backToToolbox')}
      </Button>
      {recoveryState.manageHref && (
        <Button variant="outline" size="sm" asChild>
          <Link href={recoveryState.manageHref}>{t('toolbox.marketplace.managePlugin')}</Link>
        </Button>
      )}
      {recoveryState.marketHref && (
        <Button size="sm" asChild>
          <Link href={recoveryState.marketHref}>{t('toolbox.marketplace.title')}</Link>
        </Button>
      )}
    </>
  ) : null;

  if (!tool) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t('toolbox.title')} />
        <ToolRuntimeState
          title={recoveryState?.title ?? t('toolbox.search.noResults')}
          description={recoveryState?.description ?? t('toolbox.empty.noResultsDesc')}
          actions={recoveryActions}
        />
      </div>
    );
  }

  const pluginInfo = tool.pluginTool
    ? installedPlugins.find((plugin) => plugin.id === tool.pluginTool?.pluginId)
    : null;
  const marketplaceHref = pluginInfo?.source ? getPluginMarketplaceHref(pluginInfo.source) : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {tool.name}
            {!tool.isBuiltIn && (
              <Badge variant="outline" className="text-xs gap-0.5">
                <Plug className="h-3 w-3" />
                {t('toolbox.plugin.external')}
              </Badge>
            )}
            {lifecycle && (
              <Badge variant="secondary" className="text-xs">
                {lifecycle.phase}
              </Badge>
            )}
          </span>
        }
        description={tool.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/toolbox">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('toolbox.actions.backToToolbox')}
              </Link>
            </Button>
            {tool.pluginTool && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/toolbox/plugins">{t('toolbox.marketplace.managePlugin')}</Link>
              </Button>
            )}
            {marketplaceHref && (
              <Button size="sm" asChild>
                <Link href={marketplaceHref}>{t('toolbox.marketplace.title')}</Link>
              </Button>
            )}
          </div>
        }
      />

      {pluginGovernance && (
        <div className="space-y-2 rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-xs dark:border-amber-700/40 dark:bg-amber-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t(getHealthStatusLabelKey(pluginGovernance.healthStatus))}</Badge>
                    <Badge variant="outline" className="font-mono">
              {permissionMode === 'strict'
                ? t('toolbox.plugin.permissionPolicyModeStrictTag')
                : t('toolbox.plugin.permissionPolicyModeCompatTag')}
                    </Badge>
                    <span className="font-mono">{pluginGovernance.pluginId}</span>
                    {pluginGovernance.pluginPointId && (
                      <Badge variant="outline" className="font-mono">
                        {pluginGovernance.pluginPointId}
                      </Badge>
                    )}
                  </div>
          {pluginGovernance.compatibilityReason && (
            <p className="text-red-700 dark:text-red-300">{pluginGovernance.compatibilityReason}</p>
          )}
          {pluginGovernance.deprecationWarnings.length > 0 && (
            <div className="space-y-1">
              {pluginGovernance.deprecationWarnings.slice(0, 2).map((warning) => (
                <p key={`${warning.code}:${warning.message}`}>{warning.message} {warning.guidance}</p>
              ))}
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="font-medium">{t('toolbox.plugin.declaredCapabilities')}</p>
              {pluginGovernance.declaredCapabilities.length === 0 ? (
                <p className="text-muted-foreground">{t('toolbox.plugin.capabilitiesEmpty')}</p>
              ) : (
                <p className="font-mono break-all">{pluginGovernance.declaredCapabilities.join(', ')}</p>
              )}
            </div>
            <div>
              <p className="font-medium">{t('toolbox.plugin.grantedCapabilities')}</p>
              {pluginGovernance.grantedCapabilities.length === 0 ? (
                <p className="text-muted-foreground">{t('toolbox.plugin.capabilitiesEmpty')}</p>
              ) : (
                <p className="font-mono break-all">{pluginGovernance.grantedCapabilities.join(', ')}</p>
              )}
            </div>
          </div>
          {permissionMode === 'strict' && pluginGovernance.missingCapabilities.length > 0 && (
            <p className="text-red-700 dark:text-red-300">
              {t('toolbox.plugin.capabilityPolicyMismatch')}: {pluginGovernance.missingCapabilities.join(', ')}
            </p>
          )}
          {pluginGovernance.sdkCapabilityCoverage.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium">SDK capability coverage</p>
              {pluginGovernance.sdkCapabilityCoverage.map((coverage) => (
                <div key={`${coverage.capabilityId}:${coverage.status}`} className="rounded-md border p-2 text-xs">
                  <p
                    className={coverage.status === 'covered' ? 'font-mono break-all' : 'break-all text-red-700 dark:text-red-300'}
                  >
                    {coverage.reason ?? `${coverage.capabilityId}: ${coverage.status}`}
                  </p>
                  {coverage.preferredWorkflow && (
                    <>
                      <p className="mt-1 text-muted-foreground">
                        {formatPreferredWorkflowLabel(coverage)}
                      </p>
                      {coverage.preferredWorkflow.workflowIntents?.length ? (
                        <p className="text-muted-foreground">
                          Intents: {coverage.preferredWorkflow.workflowIntents.join(', ')}
                        </p>
                      ) : null}
                    </>
                  )}
                  {coverage.status !== 'covered' && coverage.recoveryActions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {coverage.recoveryActions.map((action) => (
                        <Link key={`${coverage.capabilityId}:${action}`} href="/toolbox/plugins" className="underline">
                          {formatRecoveryActionLabel(action)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {recoveryState?.kind === 'unsupported' && (
        <ToolRuntimeState
          title={t('toolbox.runtime.desktopRequiredTitle')}
          description={recoveryState.description}
        />
      )}

      {!recoveryState && tool.isBuiltIn && tool.builtInDef ? (
        <BuiltInToolRenderer builtInId={tool.builtInDef.id} />
      ) : !recoveryState && tool.pluginTool ? (
        <PluginToolRunner tool={tool.pluginTool} />
      ) : !recoveryState ? (
        <div className="text-center text-muted-foreground py-8">
          {t('toolbox.search.noResults')}
        </div>
      ) : null}
    </div>
  );
}

function formatPreferredWorkflowLabel(coverage: PluginSdkCapabilityCoverage): string {
  const preferredWorkflow = coverage.preferredWorkflow;
  if (!preferredWorkflow) {
    return 'Preferred workflow: unavailable';
  }

  const workflowId = preferredWorkflow.toolId ?? preferredWorkflow.path;
  const interactionMode = preferredWorkflow.interactionMode ?? preferredWorkflow.surface;
  return `Preferred workflow: ${workflowId} (${interactionMode})`;
}

function formatRecoveryActionLabel(action: string): string {
  if (action === 'manage-plugin') {
    return 'Manage Plugin';
  }
  if (action === 'grant-permissions') {
    return 'Grant Permissions';
  }
  if (action === 'use-desktop') {
    return 'Use Desktop';
  }
  return 'Open Guidance';
}

function getHealthStatusLabelKey(status: PluginHealthStatus): string {
  if (status === 'critical') return 'toolbox.plugin.healthCritical';
  if (status === 'warning') return 'toolbox.plugin.healthWarning';
  return 'toolbox.plugin.healthGood';
}
