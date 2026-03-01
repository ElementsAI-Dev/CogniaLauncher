'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Terminal, Star, Timer, Loader2, Stethoscope, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { ShellInfo, ShellStartupMeasurement, ShellHealthResult } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalDetectedShellsProps {
  shells: ShellInfo[];
  loading?: boolean;
  startupMeasurements?: Record<string, ShellStartupMeasurement>;
  measuringShellId?: string | null;
  onMeasureStartup?: (shellId: string) => void;
  healthResults?: Record<string, ShellHealthResult>;
  checkingHealthShellId?: string | null;
  onCheckShellHealth?: (shellId: string) => void;
}

const STATUS_ICONS = {
  healthy: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  unknown: null,
};

export function TerminalDetectedShells({ shells, loading, startupMeasurements = {}, measuringShellId, onMeasureStartup, healthResults = {}, checkingHealthShellId, onCheckShellHealth }: TerminalDetectedShellsProps) {
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
            {onMeasureStartup && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onMeasureStartup(shell.id)}
                  disabled={measuringShellId === shell.id}
                >
                  {measuringShellId === shell.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Timer className="h-3 w-3" />
                  )}
                  {t('terminal.measureStartup')}
                </Button>
                {startupMeasurements[shell.id] && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {startupMeasurements[shell.id].withProfileMs}ms
                    </Badge>
                    {startupMeasurements[shell.id].differenceMs > 50 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{startupMeasurements[shell.id].differenceMs}ms
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {t('terminal.startupWithProfile')}: {startupMeasurements[shell.id].withProfileMs}ms | {t('terminal.startupWithoutProfile')}: {startupMeasurements[shell.id].withoutProfileMs}ms
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            )}
            {onCheckShellHealth && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onCheckShellHealth(shell.id)}
                  disabled={checkingHealthShellId === shell.id}
                >
                  {checkingHealthShellId === shell.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Stethoscope className="h-3 w-3" />
                  )}
                  {t('terminal.healthCheck')}
                </Button>
                {healthResults[shell.id] && (
                  <div className="flex items-center gap-1">
                    {STATUS_ICONS[healthResults[shell.id].status]}
                    <span className="text-xs text-muted-foreground">
                      {healthResults[shell.id].issues.length === 0
                        ? t('terminal.healthHealthy')
                        : t('terminal.healthIssues', { count: healthResults[shell.id].issues.length })}
                    </span>
                  </div>
                )}
              </div>
            )}
            {healthResults[shell.id]?.issues.length > 0 && (
              <div className="space-y-1">
                {healthResults[shell.id].issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs">
                    <span className={cn(
                      'mt-0.5 h-1.5 w-1.5 rounded-full shrink-0',
                      issue.severity === 'warning' ? 'bg-yellow-500' : issue.severity === 'error' ? 'bg-destructive' : 'bg-blue-400'
                    )} />
                    <span className="text-muted-foreground">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
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
