'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/use-toolbox';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { usePluginStore } from '@/lib/stores/plugin';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { BuiltInToolRenderer } from '@/components/toolbox/built-in-tool-renderer';
import {
  evaluatePluginHealthStatus,
  getDiscoverabilityDiagnostic,
  mapGrantedPermissionsToCapabilities,
  type PluginHealthStatus,
} from '@/lib/plugin-governance';
import { ArrowLeft, Plug } from 'lucide-react';
import Link from 'next/link';
import { getPluginMarketplaceHref } from '@/lib/plugin-source';

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

  const tool = useMemo(() => {
    if (!toolId) return undefined;
    const exact = allTools.find((t) => t.id === toolId);
    if (exact) return exact;
    return allTools.find((t) => t.isBuiltIn && t.builtInDef?.id === toolId);
  }, [toolId, allTools]);

  const blockedToolState = useMemo(() => {
    if (tool || !toolId.startsWith('plugin:')) return null;
    const [, pluginId, pluginToolId] = toolId.split(':');
    if (!pluginId || !pluginToolId) return null;

    const rawTool = pluginTools.find(
      (candidate) => candidate.pluginId === pluginId && candidate.toolId === pluginToolId,
    );
    if (!rawTool) return null;

    const pluginInfo = installedPlugins.find((plugin) => plugin.id === pluginId);
    const permissionState = permissionStates[pluginId];
    const discoverability = getDiscoverabilityDiagnostic(rawTool, healthMap[pluginId], {
      pluginEnabled: pluginInfo?.enabled ?? true,
      permissionMode,
      grantedPermissions: permissionState ? [...permissionState.granted] : [],
    });

    return {
      pluginId,
      toolName: rawTool.nameZh ?? rawTool.nameEn,
      reason: discoverability.reason ?? t('toolbox.marketplace.unavailable'),
      manageHref: '/toolbox/plugins',
      marketHref: pluginInfo ? getPluginMarketplaceHref(pluginInfo.source) : null,
    };
  }, [healthMap, installedPlugins, permissionMode, permissionStates, pluginTools, t, tool, toolId]);

  useEffect(() => {
    if (tool) addRecent(tool.id);
  }, [tool, addRecent]);

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
      healthStatus,
      declaredCapabilities,
      grantedCapabilities,
      missingCapabilities,
      deprecationWarnings,
      compatibilityReason:
        tool.pluginTool.compatibility && !tool.pluginTool.compatibility.compatible
          ? tool.pluginTool.compatibility.reason
          : null,
    };
  }, [healthMap, installedPlugins, permissionStates, tool]);

  if (!tool) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title={t('toolbox.title')} />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>{blockedToolState?.toolName ?? t('toolbox.search.noResults')}</p>
          <p className="mt-2 text-sm max-w-md text-center">
            {blockedToolState?.reason ?? t('toolbox.empty.noResultsDesc')}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/toolbox')}>
              {t('toolbox.actions.backToToolbox')}
            </Button>
            {blockedToolState && (
              <Button variant="outline" size="sm" asChild>
                <Link href={blockedToolState.manageHref}>{t('toolbox.marketplace.managePlugin')}</Link>
              </Button>
            )}
            {blockedToolState?.marketHref && (
              <Button size="sm" asChild>
                <Link href={blockedToolState.marketHref}>{t('toolbox.marketplace.title')}</Link>
              </Button>
            )}
          </div>
        </div>
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
        </div>
      )}

      {tool.isBuiltIn && tool.builtInDef ? (
        <BuiltInToolRenderer builtInId={tool.builtInDef.id} />
      ) : tool.pluginTool ? (
        <PluginToolRunner tool={tool.pluginTool} />
      ) : (
        <div className="text-center text-muted-foreground py-8">
          {t('toolbox.search.noResults')}
        </div>
      )}
    </div>
  );
}

function getHealthStatusLabelKey(status: PluginHealthStatus): string {
  if (status === 'critical') return 'toolbox.plugin.healthCritical';
  if (status === 'warning') return 'toolbox.plugin.healthWarning';
  return 'toolbox.plugin.healthGood';
}
