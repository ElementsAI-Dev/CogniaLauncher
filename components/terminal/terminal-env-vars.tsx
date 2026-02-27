'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Copy, RefreshCw } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import { categorizeVar, ENV_VAR_CATEGORY_LABELS, type EnvVarCategory } from '@/lib/constants/terminal';

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
      await navigator.clipboard.writeText(value);
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('terminal.shellEnvVars')}</CardTitle>
            <CardDescription>{t('terminal.shellEnvVarsDesc')}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onFetchShellEnvVars}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t('common.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('terminal.noEnvVars')}
          </p>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {(Object.entries(grouped) as [EnvVarCategory, [string, string][]][])
                .filter(([, vars]) => vars.length > 0)
                .map(([category, vars]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      {ENV_VAR_CATEGORY_LABELS[category]}
                      <Badge variant="secondary">{vars.length}</Badge>
                    </h4>
                    <div className="rounded-md border divide-y">
                      {vars.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between px-3 py-2 group"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm font-mono font-semibold text-primary shrink-0">
                              {key}
                            </span>
                            <span className="text-xs text-muted-foreground">=</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-mono truncate text-muted-foreground cursor-default">
                                  {value}
                                </span>
                              </TooltipTrigger>
                              {value.length > 50 && (
                                <TooltipContent side="bottom" className="max-w-md font-mono text-xs break-all">
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={() => handleCopy(key, value)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{t('terminal.copyValue')}</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
