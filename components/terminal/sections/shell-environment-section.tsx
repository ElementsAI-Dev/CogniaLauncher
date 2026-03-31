'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalDetectedShells } from '@/components/terminal/terminal-detected-shells';
import { TerminalShellFramework } from '@/components/terminal/terminal-shell-framework';
import { TerminalEnvVars } from '@/components/terminal/terminal-env-vars';
import type { UseTerminalReturn } from '@/hooks/terminal/use-terminal';

interface ShellEnvironmentSectionProps {
  terminal: UseTerminalReturn;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ShellEnvironmentSection({ terminal, t }: ShellEnvironmentSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('terminal.sectionShellEnvironment')}</h2>
          <p className="text-sm text-muted-foreground">{t('terminal.sectionShellEnvironmentDesc')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { terminal.detectShells(); }}
          disabled={terminal.loading}
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', terminal.loading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Shells subsection — always open */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            {t('terminal.tabShells')}
            {terminal.shells.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{terminal.shells.length}</Badge>
            )}
          </div>
        </div>
        <div className="p-0">
          <TerminalDetectedShells
            shells={terminal.shells}
            loading={terminal.shellsLoading}
            startupMeasurements={terminal.startupMeasurements}
            shellReadouts={terminal.shellReadouts}
            measuringShellId={terminal.measuringShellId}
            onMeasureStartup={terminal.measureStartup}
            healthResults={terminal.healthResults}
            checkingHealthShellId={terminal.checkingHealthShellId}
            onCheckShellHealth={terminal.checkShellHealth}
            onGetShellInfo={terminal.getShellInfo}
          />
        </div>
      </div>

      {/* Frameworks subsection — collapsible */}
      <Collapsible>
        <div className="rounded-lg border">
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {t('terminal.tabFrameworks')}
              {terminal.frameworks.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{terminal.frameworks.length}</Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <TerminalShellFramework
                shells={terminal.shells}
                frameworks={terminal.frameworks}
                plugins={terminal.plugins}
                frameworkReadouts={terminal.frameworkReadouts}
                frameworkCacheStats={terminal.frameworkCacheStats}
                frameworkCacheLoading={terminal.frameworkCacheLoading}
                onDetectFrameworks={terminal.detectFrameworks}
                onFetchPlugins={terminal.fetchPlugins}
                onFetchCacheStats={terminal.fetchFrameworkCacheStats}
                onGetFrameworkCacheInfo={terminal.getSingleFrameworkCacheInfo}
                onCleanFrameworkCache={terminal.cleanFrameworkCache}
                loading={terminal.loading}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Env Vars subsection — collapsible */}
      <Collapsible>
        <div className="rounded-lg border">
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {t('terminal.tabEnvVars')}
              {terminal.shellEnvVars.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{terminal.shellEnvVars.length}</Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <TerminalEnvVars
                shellEnvVars={terminal.shellEnvVars}
                onFetchShellEnvVars={terminal.fetchShellEnvVars}
                onRevealShellEnvVar={terminal.revealShellEnvVar}
                loading={terminal.loading}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
