'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Terminal, Star, Timer, Loader2, Stethoscope, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, Shield, Fish, Monitor, Atom,
} from 'lucide-react';
import type { ShellInfo, ShellStartupMeasurement, ShellHealthResult, ShellType } from '@/types/tauri';
import type { TerminalShellReadout } from '@/types/terminal';
import { useLocale } from '@/components/providers/locale-provider';

interface TerminalDetectedShellsProps {
  shells: ShellInfo[];
  loading?: boolean;
  startupMeasurements?: Record<string, ShellStartupMeasurement>;
  measuringShellId?: string | null;
  onMeasureStartup?: (shellId: string) => void;
  healthResults?: Record<string, ShellHealthResult>;
  shellReadouts?: Record<string, TerminalShellReadout>;
  checkingHealthShellId?: string | null;
  onCheckShellHealth?: (shellId: string) => void;
  onGetShellInfo?: (shellId: string) => Promise<ShellInfo | null> | ShellInfo | null | void;
}

const STATUS_ICONS = {
  healthy: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  unknown: null,
};

function getShellIcon(shellType: ShellType) {
  switch (shellType) {
    case 'powershell':
      return <Shield className="h-4 w-4 text-blue-500" />;
    case 'fish':
      return <Fish className="h-4 w-4 text-orange-500" />;
    case 'cmd':
      return <Monitor className="h-4 w-4 text-gray-500" />;
    case 'nushell':
      return <Atom className="h-4 w-4 text-purple-500" />;
    case 'zsh':
      return <Terminal className="h-4 w-4 text-emerald-500" />;
    case 'bash':
    default:
      return <Terminal className="h-4 w-4" />;
  }
}

function getFilename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function getStartupColorClass(ms: number): string {
  if (ms < 100) return 'text-green-600 dark:text-green-400';
  if (ms <= 300) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function TerminalDetectedShells({
  shells,
  loading,
  startupMeasurements = {},
  measuringShellId,
  onMeasureStartup,
  healthResults = {},
  shellReadouts = {},
  checkingHealthShellId,
  onCheckShellHealth,
  onGetShellInfo,
}: TerminalDetectedShellsProps) {
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

  const healthyCount = Object.values(healthResults).filter(r => r.status === 'healthy').length;
  const defaultShell = shells.find(s => s.isDefault);

  return (
    <div className="space-y-4">
      {shells.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t('terminal.shellsSummary', { count: shells.length })}
          </Badge>
          {Object.keys(healthResults).length > 0 && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {t('terminal.healthySummary', { count: healthyCount })}
            </Badge>
          )}
          {defaultShell && (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3" />
              {defaultShell.name}
            </Badge>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shells.map((shell) => (
          <ShellCard
            key={shell.id}
            shell={shell}
            startupMeasurement={startupMeasurements[shell.id]}
            shellReadout={shellReadouts[shell.id]}
            measuringShellId={measuringShellId}
            onMeasureStartup={onMeasureStartup}
            healthResult={healthResults[shell.id]}
            checkingHealthShellId={checkingHealthShellId}
            onCheckShellHealth={onCheckShellHealth}
            onGetShellInfo={onGetShellInfo}
          />
        ))}
      </div>
    </div>
  );
}

function ShellCard({
  shell,
  startupMeasurement,
  shellReadout,
  measuringShellId,
  onMeasureStartup,
  healthResult,
  checkingHealthShellId,
  onCheckShellHealth,
  onGetShellInfo,
}: {
  shell: ShellInfo;
  startupMeasurement?: ShellStartupMeasurement;
  shellReadout?: TerminalShellReadout;
  measuringShellId?: string | null;
  onMeasureStartup?: (shellId: string) => void;
  healthResult?: ShellHealthResult;
  checkingHealthShellId?: string | null;
  onCheckShellHealth?: (shellId: string) => void;
  onGetShellInfo?: (shellId: string) => Promise<ShellInfo | null> | ShellInfo | null | void;
}) {
  const { t } = useLocale();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailShell, setDetailShell] = useState<ShellInfo | null>(null);

  const hasActions = !!onMeasureStartup || !!onCheckShellHealth || !!onGetShellInfo;
  const issues = healthResult?.issues ?? [];

  const activeShell = detailShell ?? shell;

  const handleOpenDetails = async () => {
    setDetailOpen(true);
    if (!onGetShellInfo) {
      setDetailShell(shell);
      return;
    }

    setDetailLoading(true);
    try {
      const info = await onGetShellInfo(shell.id);
      setDetailShell(info ?? shell);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Card className={cn('flex flex-col', shell.isDefault && 'border-primary/50')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getShellIcon(shell.shellType)}
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
      <CardContent className="flex-1 space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">{t('terminal.path')}: </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="rounded bg-muted px-1 py-0.5 text-xs truncate max-w-[200px] inline-block align-bottom">
                {getFilename(shell.executablePath)}
              </code>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
              {shell.executablePath}
            </TooltipContent>
          </Tooltip>
        </div>
        {startupMeasurement && (
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getStartupColorClass(startupMeasurement.withProfileMs))}>
              {startupMeasurement.withProfileMs}ms
            </Badge>
            {startupMeasurement.differenceMs > 50 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    +{startupMeasurement.differenceMs}ms
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t('terminal.startupWithProfile')}: {startupMeasurement.withProfileMs}ms | {t('terminal.startupWithoutProfile')}: {startupMeasurement.withoutProfileMs}ms
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
        {healthResult && (
          <div className="flex items-center gap-1">
            {STATUS_ICONS[healthResult.status]}
            <span className="text-xs text-muted-foreground">
              {issues.length === 0
                ? t('terminal.healthHealthy')
                : t('terminal.healthIssues', { count: issues.length })}
            </span>
          </div>
        )}
        {shellReadout?.degradedReason && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50/70 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            {shellReadout.degradedReason}
          </div>
        )}
        {issues.length > 0 && (
          <Collapsible open={issuesOpen} onOpenChange={setIssuesOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={cn('h-3 w-3 transition-transform', issuesOpen && 'rotate-180')} />
              {t('terminal.healthIssues', { count: issues.length })}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 space-y-1">
                {issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-xs">
                    <span className={cn(
                      'mt-0.5 h-1.5 w-1.5 rounded-full shrink-0',
                      issue.severity === 'warning' ? 'bg-yellow-500' : issue.severity === 'error' ? 'bg-destructive' : 'bg-blue-400'
                    )} />
                    <span className="text-muted-foreground">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
        {shell.configFiles.length > 0 && (
          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={cn('h-3 w-3 transition-transform', configOpen && 'rotate-180')} />
              {t('terminal.configFilesCount', { count: shell.configFiles.length })}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 space-y-1">
                {shell.configFiles.map((cf) => (
                  <li key={cf.path} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      cf.exists ? 'bg-green-500' : 'bg-muted-foreground/30'
                    )} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <code className="truncate rounded bg-muted px-1 py-0.5 max-w-[200px] inline-block align-bottom">
                          {getFilename(cf.path)}
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
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      {hasActions && (
        <CardFooter className="flex gap-2 border-t pt-3">
          {onMeasureStartup && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onMeasureStartup(shell.id)}
              disabled={measuringShellId === shell.id}
              aria-label={`${t('terminal.measureStartup')} ${shell.name}`}
            >
              {measuringShellId === shell.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Timer className="h-3 w-3" />
              )}
              {t('terminal.measureStartup')}
            </Button>
          )}
          {onCheckShellHealth && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onCheckShellHealth(shell.id)}
              disabled={checkingHealthShellId === shell.id}
              aria-label={`${t('terminal.healthCheck')} ${shell.name}`}
            >
              {checkingHealthShellId === shell.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Stethoscope className="h-3 w-3" />
              )}
              {t('terminal.healthCheck')}
            </Button>
          )}
          {onGetShellInfo && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => void handleOpenDetails()}
            >
              {t('terminal.viewShellDetails')}
            </Button>
          )}
        </CardFooter>
      )}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('terminal.shellDetailsTitle')}</DialogTitle>
            <DialogDescription>{activeShell.name}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('terminal.path')}</p>
                <p className="font-mono break-all">{activeShell.executablePath}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeShell.isDefault && <Badge variant="secondary">{t('terminal.default')}</Badge>}
                {activeShell.version && <Badge variant="outline">v{activeShell.version}</Badge>}
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">{t('terminal.configFilesCount', { count: activeShell.configFiles.length })}</p>
                <div className="rounded-md border divide-y">
                  {activeShell.configFiles.map((configFile) => (
                    <div key={configFile.path} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="font-mono text-xs break-all">{configFile.path}</span>
                      <Badge variant={configFile.exists ? 'secondary' : 'outline'}>
                        {configFile.exists ? t('terminal.exists') : t('terminal.notExists')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              {startupMeasurement && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('terminal.measureStartup')}</p>
                  <p>{startupMeasurement.withProfileMs}ms / {startupMeasurement.withoutProfileMs}ms</p>
                </div>
              )}
              {healthResult && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('terminal.healthCheck')}</p>
                  <p>{healthResult.status}</p>
                </div>
              )}
              {shellReadout?.degradedReason && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Readout status</p>
                  <p>{shellReadout.degradedReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
