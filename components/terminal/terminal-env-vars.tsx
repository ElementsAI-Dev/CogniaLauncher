'use client';

import { useState, useMemo } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import Link from 'next/link';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Search, Copy, RefreshCw, ExternalLink, ChevronRight } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import { categorizeVar, ENV_VAR_CATEGORY_KEYS, type EnvVarCategory } from '@/lib/constants/terminal';

interface TerminalEnvVarsProps {
  shellEnvVars: [string, string][];
  onFetchShellEnvVars: () => Promise<void>;
  loading?: boolean;
}


export function TerminalEnvVars({
  shellEnvVars,
  onFetchShellEnvVars,
  loading,
}: TerminalEnvVarsProps) {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return shellEnvVars;
    const q = search.toLowerCase();
    return shellEnvVars.filter(
      ([key, value]) =>
        key.toLowerCase().includes(q) || value.toLowerCase().includes(q),
    );
  }, [shellEnvVars, search]);

  const pathVarCount = useMemo(
    () => shellEnvVars.filter(([k]) => k.toLowerCase().includes('path')).length,
    [shellEnvVars],
  );

  const grouped = useMemo(() => {
    const groups: Record<EnvVarCategory, [string, string][]> = {
      path: [],
      language: [],
      system: [],
      other: [],
    };
    for (const entry of filtered) {
      const cat = categorizeVar(entry[0]);
      groups[cat].push(entry);
    }
    return groups;
  }, [filtered]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await writeClipboard(value);
      toast.success(t('terminal.copyValue') || `Copied ${key}`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
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
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
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
            onChange={(e) => setSearch(e.target.value)}
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
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {(Object.entries(grouped) as [EnvVarCategory, [string, string][]][])
                .filter(([, vars]) => vars.length > 0)
                .map(([category, vars]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      {t(ENV_VAR_CATEGORY_KEYS[category])}
                      <Badge variant="secondary">{vars.length}</Badge>
                    </h4>
                    <div className="rounded-md border divide-y overflow-hidden">
                      {vars.map(([key, value]) => (
                        <div
                          key={key}
                          className="relative px-3 py-2 group overflow-hidden"
                        >
                          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-mono font-semibold text-primary truncate shrink-0 max-w-[200px] cursor-default">
                                  {key}
                                </span>
                              </TooltipTrigger>
                              {key.length > 30 && (
                                <TooltipContent side="top" className="font-mono text-xs">
                                  {key}
                                </TooltipContent>
                              )}
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  onClick={() => handleCopy(key, value)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{t('terminal.copyValue')}</TooltipContent>
                            </Tooltip>
                          </div>
                          {key.toLowerCase() === 'path' ? (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 mt-0.5 px-1">
                                  <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-state=open]>svg&]:rotate-90" />
                                  {value.split(';').filter(Boolean).length} {t('terminal.pathEntries')}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-muted">
                                  {value.split(';').filter(Boolean).map((entry, i) => (
                                    <div key={i} className="font-mono text-xs text-muted-foreground truncate" title={entry}>
                                      {entry}
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : value.length > 80 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate max-w-sm inline-block align-bottom cursor-help">
                                  {value.slice(0, 80)}…
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-lg font-mono text-xs break-all whitespace-pre-wrap">
                                {value}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate min-w-0 w-full cursor-default">
                              {value || <span className="italic opacity-50">(empty)</span>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
