'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { TerminalShellConfig } from '@/components/terminal/terminal-shell-config';
import { TerminalPsManagement } from '@/components/terminal/terminal-ps-management';
import { TerminalPsModulesTable } from '@/components/terminal/terminal-ps-modules-table';
import type { UseTerminalReturn } from '@/hooks/terminal/use-terminal';

interface ConfigRefreshIntent {
  signal: number;
  configEntries: boolean;
  configMetadata: boolean;
}

interface ConfigurationSectionProps {
  terminal: UseTerminalReturn;
  configDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onRequestDiscard: () => void;
  discardSignal: number;
  refreshIntent: ConfigRefreshIntent;
  onRefreshHandled: (handled: { configEntries: boolean; configMetadata: boolean }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ConfigurationSection({
  terminal,
  configDirty,
  onDirtyChange,
  onRequestDiscard,
  discardSignal,
  refreshIntent,
  onRefreshHandled,
  t,
}: ConfigurationSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('terminal.sectionConfiguration')}</h2>
        <p className="text-sm text-muted-foreground">{t('terminal.sectionConfigurationDesc')}</p>
      </div>

      {/* Shell Config Editor — default open */}
      <Collapsible defaultOpen>
        <div className="rounded-lg border">
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {t('terminal.tabConfig')}
              {configDirty && (
                <Badge variant="outline" className="h-4 border-amber-500/50 px-1 text-[10px] text-amber-500">
                  {t('terminal.unsaved')}
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <TerminalShellConfig
                shells={terminal.shells}
                onReadConfig={terminal.readShellConfig}
                onFetchConfigEntries={terminal.fetchConfigEntries}
                onParseConfigContent={terminal.parseConfigContent}
                onValidateConfigContent={terminal.validateConfigContent}
                onBackupConfig={terminal.backupShellConfig}
                onWriteConfig={terminal.writeShellConfig}
                onGetConfigEditorMetadata={terminal.getConfigEditorMetadata}
                onRestoreConfigSnapshot={terminal.restoreConfigSnapshot}
                mutationStatus={terminal.configMutationState.status}
                mutationMessage={terminal.configMutationState.message}
                mutationResult={terminal.configMutationState.result}
                onClearMutationState={terminal.clearConfigMutationState}
                onDirtyChange={onDirtyChange}
                onRequestDiscard={onRequestDiscard}
                discardSignal={discardSignal}
                refreshIntent={refreshIntent}
                onRefreshHandled={onRefreshHandled}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* PowerShell Management — collapsible */}
      <Collapsible>
        <div className="rounded-lg border">
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {t('terminal.tabPowerShell')}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4 space-y-4">
              <TerminalPsManagement
                psProfiles={terminal.psProfiles}
                executionPolicy={terminal.executionPolicy}
                onFetchPSProfiles={terminal.fetchPSProfiles}
                onReadPSProfile={terminal.readPSProfile}
                onWritePSProfile={terminal.writePSProfile}
                onFetchExecutionPolicy={terminal.fetchExecutionPolicy}
                onSetExecutionPolicy={terminal.setExecutionPolicy}
                loading={terminal.loading}
              />
              <TerminalPsModulesTable
                modules={terminal.psModules}
                scripts={terminal.psScripts}
                onFetchModules={terminal.fetchPSModules}
                onFetchScripts={terminal.fetchPSScripts}
                onInstallModule={terminal.installPSModule}
                onUninstallModule={terminal.uninstallPSModule}
                onUpdateModule={terminal.updatePSModule}
                onSearchModules={terminal.searchPSModules}
                loading={terminal.loading}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
