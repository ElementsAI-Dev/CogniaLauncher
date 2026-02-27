'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Terminal, Star } from 'lucide-react';
import type { ShellInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalDetectedShellsProps {
  shells: ShellInfo[];
  loading?: boolean;
}

export function TerminalDetectedShells({ shells, loading }: TerminalDetectedShellsProps) {
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (shells.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Terminal />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            {t('terminal.noShellsDetected')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shells.map((shell) => (
        <Card key={shell.id} className={cn(shell.isDefault && 'border-primary/50')}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4" />
                {shell.name}
              </CardTitle>
              {shell.isDefault && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" />
                  {t('terminal.default')}
                </Badge>
              )}
            </div>
            {shell.version && (
              <CardDescription>v{shell.version}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t('terminal.path')}: </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs truncate max-w-[200px] inline-block align-bottom">
                    {shell.executablePath}
                  </code>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                  {shell.executablePath}
                </TooltipContent>
              </Tooltip>
            </div>
            {shell.configFiles.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t('terminal.configFiles')}: </span>
                <div className="mt-1 space-y-1">
                  {shell.configFiles.map((cf) => (
                    <div key={cf.path} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        cf.exists ? 'bg-green-500' : 'bg-muted-foreground/30'
                      )} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <code className="truncate rounded bg-muted px-1 py-0.5 max-w-[200px] inline-block align-bottom">
                            {cf.path}
                          </code>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                          {cf.path}
                        </TooltipContent>
                      </Tooltip>
                      {cf.exists && cf.sizeBytes > 0 && (
                        <span className="text-muted-foreground">
                          ({(cf.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
