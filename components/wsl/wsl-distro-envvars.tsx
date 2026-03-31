'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EnvVarKvEditor } from '@/components/envvar';
import type { WslDistroEnvReadResult, WslEnvEntry, WslExportWindowsEnvResult } from '@/types/tauri';
import { RefreshCw, Upload } from 'lucide-react';

interface WslDistroEnvvarsProps {
  distroName: string;
  readDistroEnv: (distro: string) => Promise<WslDistroEnvReadResult | null>;
  exportWindowsEnv: (distro: string) => Promise<WslExportWindowsEnvResult | null>;
  getWslenv: () => Promise<WslEnvEntry[]>;
  setWslenv: (entries: WslEnvEntry[]) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslDistroEnvvars({
  distroName,
  readDistroEnv,
  exportWindowsEnv,
  getWslenv,
  setWslenv,
  t,
}: WslDistroEnvvarsProps) {
  const [envResult, setEnvResult] = useState<WslDistroEnvReadResult | null>(null);
  const [wslenvEntries, setWslenvEntries] = useState<WslEnvEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newWslenvKey, setNewWslenvKey] = useState('');
  const [newWslenvFlags, setNewWslenvFlags] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextEnv, nextWslenv] = await Promise.all([
          readDistroEnv(distroName),
          getWslenv(),
        ]);
        if (!active) return;
        setEnvResult(nextEnv);
        setWslenvEntries(nextWslenv);
      } catch (err) {
        if (!active) return;
        setError(String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [distroName, getWslenv, readDistroEnv]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextEnv = await readDistroEnv(distroName);
      setEnvResult(nextEnv);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleImportWindowsEnv = async () => {
    setLoading(true);
    setError(null);
    try {
      await exportWindowsEnv(distroName);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const persistWslenv = async (entries: WslEnvEntry[]) => {
    setWslenvEntries(entries);
    try {
      await setWslenv(entries);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAddWslenv = async () => {
    const key = newWslenvKey.trim();
    if (!key) return;
    const flags = newWslenvFlags
      .split(',')
      .map((flag) => flag.trim())
      .filter(Boolean);
    await persistWslenv([...wslenvEntries, { key, flags }]);
    setNewWslenvKey('');
    setNewWslenvFlags('');
  };

  const envItems = envResult?.variables.map((entry) => ({
    key: entry.key,
    value: entry.value,
  })) ?? [];

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{t('wsl.detail.envvarsTitle')}</CardTitle>
              <CardDescription>{t('wsl.detail.envvarsDesc')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleImportWindowsEnv} disabled={loading}>
                <Upload className="mr-1 h-3.5 w-3.5" />
                {t('wsl.detail.importWindowsEnv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <EnvVarKvEditor
            items={envItems}
            readOnly
            revealable
            sensitiveKeys={[/token/i, /secret/i, /password/i, /key/i]}
            onReveal={async (key) => envResult?.variables.find((entry) => entry.key === key)?.value ?? null}
            labels={{
              empty: t('wsl.detail.noEnvVars'),
              copy: t('envvar.table.copy'),
              copyError: t('common.error'),
              reveal: t('envvar.table.reveal'),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WSLENV</CardTitle>
          <CardDescription>{t('wsl.detail.wslenvDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EnvVarKvEditor
            items={wslenvEntries.map((entry) => ({
              key: entry.key,
              value: entry.flags.join(','),
            }))}
            readOnly
            labels={{
              empty: t('wsl.detail.noWslenvEntries'),
              copy: t('envvar.table.copy'),
              copyError: t('common.error'),
            }}
          />

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="wslenv-key">{t('wsl.detail.wslenvKey')}</Label>
              <Input
                id="wslenv-key"
                value={newWslenvKey}
                onChange={(event) => setNewWslenvKey(event.target.value)}
                placeholder="JAVA_HOME"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wslenv-flags">{t('wsl.detail.wslenvFlags')}</Label>
              <Input
                id="wslenv-flags"
                value={newWslenvFlags}
                onChange={(event) => setNewWslenvFlags(event.target.value)}
                placeholder="p,u"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddWslenv} disabled={!newWslenvKey.trim()}>
                {t('common.add')}
              </Button>
            </div>
          </div>

          {wslenvEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wslenvEntries.map((entry) => (
                <Button
                  key={entry.key}
                  size="sm"
                  variant="outline"
                  onClick={() => void persistWslenv(wslenvEntries.filter((item) => item.key !== entry.key))}
                >
                  {t('wsl.detail.removeWslenv').replace('{key}', entry.key)}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
