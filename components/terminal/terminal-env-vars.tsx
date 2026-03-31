'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Search, RefreshCw, ExternalLink } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { categorizeVar, ENV_VAR_CATEGORY_KEYS, type EnvVarCategory } from '@/lib/constants/terminal';
import { EnvVarKvEditor } from '@/components/envvar/shared/env-var-kv-editor';
import type { TerminalEnvVarSummary } from '@/types/tauri';

interface TerminalEnvVarsProps {
  shellEnvVars: TerminalEnvVarSummary[];
  onFetchShellEnvVars: () => Promise<void>;
  onRevealShellEnvVar?: (key: string) => Promise<string | null>;
  loading?: boolean;
}

export function TerminalEnvVars({
  shellEnvVars,
  onFetchShellEnvVars,
  onRevealShellEnvVar,
  loading,
}: TerminalEnvVarsProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (!search) return shellEnvVars;
    const query = search.toLowerCase();
    return shellEnvVars.filter(
      ({ key, value }) =>
        key.toLowerCase().includes(query)
        || (revealedValues[key] ?? value.displayValue).toLowerCase().includes(query),
    );
  }, [revealedValues, search, shellEnvVars]);

  const pathVarCount = useMemo(
    () => shellEnvVars.filter(({ key }) => key.toLowerCase().includes('path')).length,
    [shellEnvVars],
  );

  const grouped = useMemo(() => {
    const groups: Record<EnvVarCategory, TerminalEnvVarSummary[]> = {
      path: [],
      language: [],
      system: [],
      other: [],
    };
    for (const entry of filtered) {
      groups[categorizeVar(entry.key)].push(entry);
    }
    return groups;
  }, [filtered]);

  const revealValue = useCallback(async (key: string) => {
    if (!onRevealShellEnvVar) {
      return null;
    }
    const revealed = await onRevealShellEnvVar(key);
    if (revealed != null) {
      setRevealedValues((current) => ({ ...current, [key]: revealed }));
    }
    return revealed;
  }, [onRevealShellEnvVar]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{t('terminal.shellEnvVars')}</CardTitle>
          {shellEnvVars.length > 0 && (
            <Badge variant="secondary" className="text-xs">{shellEnvVars.length}</Badge>
          )}
        </div>
        <CardDescription>{t('terminal.shellEnvVarsDesc')}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onFetchShellEnvVars}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/envvar" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('nav.envvar')}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {shellEnvVars.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t('terminal.totalVars')}: <strong className="text-foreground">{shellEnvVars.length}</strong></span>
            {pathVarCount > 0 && (
              <span>{t('terminal.pathLikeVars')}: <strong className="text-foreground">{pathVarCount}</strong></span>
            )}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('terminal.searchEnvVars')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {shellEnvVars.length === 0 ? (
          <Empty className="border-dashed py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('terminal.noEnvVars')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              {(Object.entries(grouped) as [EnvVarCategory, TerminalEnvVarSummary[]][])
                .filter(([, vars]) => vars.length > 0)
                .map(([category, vars]) => (
                  <div key={category}>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                      {t(ENV_VAR_CATEGORY_KEYS[category])}
                      <Badge variant="secondary">{vars.length}</Badge>
                    </h4>
                    <EnvVarKvEditor
                      items={vars.map(({ key, value }) => ({
                        key,
                        value: revealedValues[key] ?? value.displayValue,
                        masked: value.masked && revealedValues[key] == null,
                      }))}
                      readOnly
                      revealable
                      onReveal={revealValue}
                      labels={{
                        empty: t('terminal.noEnvVars'),
                        copy: t('terminal.copyValue'),
                        copyError: 'Failed to copy',
                        reveal: t('terminal.revealSensitiveValue'),
                      }}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
