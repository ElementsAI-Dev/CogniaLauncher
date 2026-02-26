'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-5 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (shells.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Terminal className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('terminal.noShellsDetected')}</p>
        </CardContent>
      </Card>
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
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {shell.executablePath}
              </code>
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
                      <code className="truncate rounded bg-muted px-1 py-0.5">
                        {cf.path}
                      </code>
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
