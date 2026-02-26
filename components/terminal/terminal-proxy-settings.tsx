'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, ShieldCheck } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/platform';
import * as tauri from '@/lib/tauri';

interface TerminalProxySettingsProps {
  proxyEnvVars: [string, string][];
  onFetchProxyEnvVars: () => Promise<void>;
  loading?: boolean;
}

export function TerminalProxySettings({
  proxyEnvVars,
  onFetchProxyEnvVars,
  loading,
}: TerminalProxySettingsProps) {
  const { t } = useLocale();
  const [proxyMode, setProxyMode] = useState<string>('global');
  const [customProxy, setCustomProxy] = useState('');
  const [noProxy, setNoProxy] = useState('');
  const [globalProxy, setGlobalProxy] = useState('');
  const [saving, setSaving] = useState(false);

  // Load settings from backend
  useEffect(() => {
    if (!isTauri()) return;
    const load = async () => {
      try {
        const config = await tauri.configList();
        const configMap: Record<string, string> = {};
        for (const [k, v] of config) {
          configMap[k] = v;
        }
        setProxyMode(configMap['terminal.proxy_mode'] || 'global');
        setCustomProxy(configMap['terminal.custom_proxy'] || '');
        setNoProxy(configMap['terminal.no_proxy'] || '');
        setGlobalProxy(configMap['network.proxy'] || '');
      } catch {
        // fallback to defaults
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void onFetchProxyEnvVars();
  }, [onFetchProxyEnvVars]);

  const handleProxyModeChange = useCallback(async (mode: string) => {
    setProxyMode(mode);
    if (!isTauri()) return;
    setSaving(true);
    try {
      await tauri.configSet('terminal.proxy_mode', mode);
      await onFetchProxyEnvVars();
    } finally {
      setSaving(false);
    }
  }, [onFetchProxyEnvVars]);

  const handleCustomProxyBlur = useCallback(async () => {
    if (!isTauri()) return;
    setSaving(true);
    try {
      await tauri.configSet('terminal.custom_proxy', customProxy);
      await onFetchProxyEnvVars();
    } finally {
      setSaving(false);
    }
  }, [customProxy, onFetchProxyEnvVars]);

  const handleNoProxyBlur = useCallback(async () => {
    if (!isTauri()) return;
    setSaving(true);
    try {
      await tauri.configSet('terminal.no_proxy', noProxy);
      await onFetchProxyEnvVars();
    } finally {
      setSaving(false);
    }
  }, [noProxy, onFetchProxyEnvVars]);

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
        </CardTitle>
        <CardDescription>{t('terminal.proxySettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>{t('terminal.proxyMode')}</Label>
          <Select value={proxyMode} onValueChange={handleProxyModeChange} disabled={saving}>
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
        </div>

        {proxyMode === 'global' && globalProxy && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t('terminal.globalProxyActive')}</span>
            <p className="text-sm font-mono mt-0.5">{globalProxy}</p>
          </div>
        )}

        {proxyMode === 'global' && !globalProxy && (
          <p className="text-xs text-muted-foreground">{t('terminal.noGlobalProxy')}</p>
        )}

        {proxyMode === 'custom' && (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="custom-proxy">{t('terminal.customProxyUrl')}</Label>
              <Input
                id="custom-proxy"
                value={customProxy}
                onChange={(e) => setCustomProxy(e.target.value)}
                onBlur={handleCustomProxyBlur}
                placeholder="http://proxy.example.com:8080"
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}

        {proxyMode !== 'none' && (
          <div className="grid gap-2">
            <Label htmlFor="no-proxy">{t('terminal.noProxyList')}</Label>
            <Input
              id="no-proxy"
              value={noProxy}
              onChange={(e) => setNoProxy(e.target.value)}
              onBlur={handleNoProxyBlur}
              placeholder="localhost,127.0.0.1,.internal.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('terminal.noProxyHint')}</p>
          </div>
        )}

        {proxyEnvVars.length > 0 && (
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
                </div>
              ))}
            </div>
          </div>
        )}

        {proxyEnvVars.length === 0 && proxyMode !== 'none' && (
          <p className="text-xs text-muted-foreground">{t('terminal.noActiveProxy')}</p>
        )}
      </CardContent>
    </Card>
  );
}
