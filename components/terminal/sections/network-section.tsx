'use client';

import { TerminalProxySettings } from '@/components/terminal/terminal-proxy-settings';
import type { UseTerminalReturn } from '@/hooks/terminal/use-terminal';

interface NetworkSectionProps {
  terminal: UseTerminalReturn;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function NetworkSection({ terminal, t }: NetworkSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('terminal.sectionNetwork')}</h2>
        <p className="text-sm text-muted-foreground">{t('terminal.sectionNetworkDesc')}</p>
      </div>

      <TerminalProxySettings
        proxyEnvVars={terminal.proxyEnvVars}
        proxyMode={terminal.proxyMode}
        globalProxy={terminal.globalProxy}
        customProxy={terminal.customProxy}
        noProxy={terminal.noProxy}
        saving={terminal.proxyConfigSaving}
        syncStatus={terminal.proxySyncState.status}
        syncMessage={terminal.proxySyncState.message}
        onProxyModeChange={terminal.updateProxyMode}
        onCustomProxyChange={terminal.updateCustomProxy}
        onCustomProxyBlur={terminal.saveCustomProxy}
        onNoProxyChange={terminal.updateNoProxy}
        onNoProxyBlur={terminal.saveNoProxy}
        onRetrySync={() => terminal.loadProxyConfig()}
        onClearSyncState={terminal.clearProxySyncState}
        loading={terminal.loading}
      />
    </div>
  );
}
