'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, ShieldCheck, Info, Loader2, Copy } from 'lucide-react';
import { writeClipboard } from '@/lib/clipboard';
import { toast } from 'sonner';
import { useLocale } from '@/components/providers/locale-provider';
import type { ProxyMode } from '@/types/terminal';

interface TerminalProxySettingsProps {
  proxyEnvVars: [string, string][];
  proxyMode: ProxyMode;
  globalProxy: string;
  customProxy: string;
  noProxy: string;
  saving: boolean;
  syncStatus?: 'idle' | 'loading' | 'success' | 'error';
  syncMessage?: string | null;
  onProxyModeChange: (mode: ProxyMode) => void;
  onCustomProxyChange: (value: string) => void;
  onCustomProxyBlur: () => void;
  onNoProxyChange: (value: string) => void;
  onNoProxyBlur: () => void;
  onRetrySync?: () => void;
  onClearSyncState?: () => void;
  loading?: boolean;
}

export function TerminalProxySettings({
  proxyEnvVars,
  proxyMode,
  globalProxy,
  customProxy,
  noProxy,
  saving,
  syncStatus = 'idle',
  syncMessage = null,
  onProxyModeChange,
  onCustomProxyChange,
  onCustomProxyBlur,
  onNoProxyChange,
  onNoProxyBlur,
  onRetrySync,
  onClearSyncState,
  loading,
}: TerminalProxySettingsProps) {
  const { t } = useLocale();
  const [urlError, setUrlError] = useState<string>('');

  const validateProxyUrl = (url: string) => {
    if (!url) { setUrlError(''); return; }
    try {
      const u = new URL(url);
      if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(u.protocol)) {
        setUrlError(t('terminal.invalidProxyProtocol'));
        return;
      }
      setUrlError('');
    } catch {
      setUrlError(t('terminal.invalidProxyUrl'));
    }
  };

  const getModeDescription = (mode: ProxyMode): string => {
    switch (mode) {
      case 'global': return t('terminal.proxyModeGlobalDesc');
      case 'custom': return t('terminal.proxyModeCustomDesc');
      case 'none': return t('terminal.proxyModeNoneDesc');
      default: return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('terminal.proxySettings')}
          <Badge variant={proxyMode === 'none' ? 'secondary' : 'default'} className="text-xs">
            {proxyMode}
          </Badge>
        </CardTitle>
        <CardDescription>{t('terminal.proxySettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>{t('terminal.proxyMode')}</Label>
          <Select value={proxyMode} onValueChange={(v) => onProxyModeChange(v as ProxyMode)} disabled={saving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  {t('terminal.proxyModeGlobal')}
                </div>
              </SelectItem>
              <SelectItem value="custom">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('terminal.proxyModeCustom')}
                </div>
              </SelectItem>
              <SelectItem value="none">{t('terminal.proxyModeNone')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{getModeDescription(proxyMode)}</p>
        </div>

        {proxyMode === 'global' && globalProxy && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('terminal.globalProxyActive')}</AlertTitle>
            <AlertDescription className="font-mono text-sm">{globalProxy}</AlertDescription>
          </Alert>
        )}

        {syncStatus === 'success' && syncMessage && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('terminal.proxySettings')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>{syncMessage}</span>
              {onClearSyncState && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onClearSyncState}
                >
                  {t('common.clear')}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {syncStatus === 'loading' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>{t('terminal.proxySettings')}</AlertTitle>
            <AlertDescription>{t('common.loading')}</AlertDescription>
          </Alert>
        )}

        {syncStatus === 'error' && syncMessage && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>{t('terminal.proxySettings')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>{syncMessage}</span>
              {onRetrySync && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onRetrySync}
                >
                  {t('common.refresh')}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {proxyMode === 'global' && !globalProxy && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>{t('terminal.noGlobalProxy')}</AlertTitle>
          </Alert>
        )}

        {proxyMode === 'custom' && (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="custom-proxy">{t('terminal.customProxyUrl')}</Label>
              <Input
                id="custom-proxy"
                value={customProxy}
                onChange={(e) => onCustomProxyChange(e.target.value)}
                onBlur={() => { onCustomProxyBlur(); validateProxyUrl(customProxy); }}
                placeholder="http://proxy.example.com:8080"
                className="font-mono text-sm"
                disabled={saving}
              />
              {urlError && <p className="text-xs text-destructive mt-1">{urlError}</p>}
            </div>
          </div>
        )}

        {proxyMode !== 'none' && (
          <div className="grid gap-2">
            <Label htmlFor="no-proxy">{t('terminal.noProxyList')}</Label>
            <Input
              id="no-proxy"
              value={noProxy}
              onChange={(e) => onNoProxyChange(e.target.value)}
              onBlur={onNoProxyBlur}
              placeholder="localhost,127.0.0.1,.internal.com"
              className="font-mono text-sm"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{t('terminal.noProxyHint')}</p>
          </div>
        )}

        {proxyEnvVars.length > 0 && (
          <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              {t('terminal.activeProxyVars')}
              <Badge variant="secondary">{proxyEnvVars.length}</Badge>
            </h4>
            <div className="rounded-md border p-2 space-y-1">
              {proxyEnvVars.map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-primary font-semibold min-w-[100px]">{key}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="truncate">{value}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={async () => {
                      try {
                        await writeClipboard(value);
                        toast.success(t('terminal.copied'));
                      } catch { /* ignore */ }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          </>
        )}

        {proxyEnvVars.length === 0 && proxyMode !== 'none' && (
          <p className="text-xs text-muted-foreground">{t('terminal.noActiveProxy')}</p>
        )}
      </CardContent>
    </Card>
  );
}
