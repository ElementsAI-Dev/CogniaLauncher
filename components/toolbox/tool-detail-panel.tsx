'use client';

import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { PluginToolRunner } from '@/components/toolbox/plugin-tool-runner';
import { BuiltInToolRenderer } from '@/components/toolbox/built-in-tool-renderer';
import { Button } from '@/components/ui/button';
import { usePluginStore } from '@/lib/stores/plugin';
import {
  evaluatePluginHealthStatus,
  mapGrantedPermissionsToCapabilities,
  type PluginHealthStatus,
} from '@/lib/plugin-governance';
import { Plug, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import type { UnifiedTool } from '@/hooks/use-toolbox';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

interface ToolDetailPanelProps {
  tool: UnifiedTool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolDetailPanel({ tool, open, onOpenChange }: ToolDetailPanelProps) {
  const { t } = useLocale();
  const installedPlugins = usePluginStore((s) => s.installedPlugins);
  const healthMap = usePluginStore((s) => s.healthMap);
  const permissionMode = usePluginStore((s) => s.permissionMode);
  const permissionStates = usePluginStore((s) => s.permissionStates);
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

    return {
      pluginId,
      healthStatus,
      declaredCapabilities,
      grantedCapabilities,
      missingCapabilities,
    };
  }, [healthMap, installedPlugins, permissionStates, tool]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="tool-detail-panel-content"
        className="w-[min(94vw,980px)] max-w-none gap-0 overflow-hidden p-0 sm:w-[min(88vw,980px)] sm:max-w-none md:w-[min(82vw,980px)]"
      >
        {tool ? (
          <div className="flex h-full min-h-0 flex-col">
            <div data-testid="tool-detail-panel-header" className="border-b bg-muted/20">
              <SheetHeader className="gap-2 px-6 pb-3 pt-6">
                <SheetTitle className="flex items-center gap-2 text-base leading-tight">
                  {tool.name}
                  {!tool.isBuiltIn && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Plug className="h-3 w-3" />
                      {t('toolbox.plugin.external')}
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="leading-relaxed">{tool.description}</SheetDescription>
              </SheetHeader>
              <div data-testid="tool-detail-panel-actions" className="px-6 pb-4">
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={getToolboxDetailPath(tool.id)} onClick={() => onOpenChange(false)}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    {t('toolbox.actions.openFullPage')}
                  </Link>
                </Button>
              </div>
            </div>

            <div data-testid="tool-detail-panel-body" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {pluginGovernance && (
                <div className="mb-4 space-y-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2 text-xs dark:border-amber-700/40 dark:bg-amber-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t(getHealthStatusLabelKey(pluginGovernance.healthStatus))}</Badge>
                    <Badge variant="outline" className="font-mono">
                      {permissionMode === 'strict'
                        ? t('toolbox.plugin.permissionPolicyModeStrictTag')
                        : t('toolbox.plugin.permissionPolicyModeCompatTag')}
                    </Badge>
                    <span className="font-mono">{pluginGovernance.pluginId}</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="font-medium">{t('toolbox.plugin.declaredCapabilities')}</p>
                      <p className="font-mono break-all">
                        {pluginGovernance.declaredCapabilities.length > 0
                          ? pluginGovernance.declaredCapabilities.join(', ')
                          : t('toolbox.plugin.capabilitiesEmpty')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">{t('toolbox.plugin.grantedCapabilities')}</p>
                      <p className="font-mono break-all">
                        {pluginGovernance.grantedCapabilities.length > 0
                          ? pluginGovernance.grantedCapabilities.join(', ')
                          : t('toolbox.plugin.capabilitiesEmpty')}
                      </p>
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
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-muted-foreground">
            {t('toolbox.search.noResults')}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function getHealthStatusLabelKey(status: PluginHealthStatus): string {
  if (status === 'critical') return 'toolbox.plugin.healthCritical';
  if (status === 'warning') return 'toolbox.plugin.healthWarning';
  return 'toolbox.plugin.healthGood';
}
