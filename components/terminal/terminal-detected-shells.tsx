'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Terminal, Star, Timer, Loader2, Stethoscope, CheckCircle2, AlertTriangle, XCircle,
  MoreHorizontal, ChevronDown,
} from 'lucide-react';
import type { ShellInfo, ShellStartupMeasurement, ShellHealthResult } from '@/types/tauri';
import { getShellIcon } from '@/components/terminal/shared/shell-icon';
import type { TerminalShellReadout } from '@/types/terminal';
import { useLocale } from '@/components/providers/locale-provider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

function getFilename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function getStartupColorClass(ms: number): string {
  if (ms < 100) return 'text-green-600 dark:text-green-400';
  if (ms <= 300) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function HealthBadge({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> healthy
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3" /> warning
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3 w-3" /> error
        </span>
      );
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailShell, setDetailShell] = useState<ShellInfo | null>(null);
  const [expandedShellId, setExpandedShellId] = useState<string | null>(null);

  const handleOpenDetails = async (shell: ShellInfo) => {
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

  if (loading) {
    return (
      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
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

  const activeShell = detailShell ?? shells[0];

  const getReadoutStatusKey = (status: TerminalShellReadout['status']) =>
    `terminal.readoutStatus${status
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('')}`;

  const getReadoutStatusVariant = (
    status: TerminalShellReadout['status'],
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (status === 'failed') return 'destructive';
    if (status === 'stale') return 'secondary';
    if (status === 'missing-config' || status === 'unsupported') return 'outline';
    return 'default';
  };

  return (
    <>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">{t('terminal.shell')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('terminal.path')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('terminal.startup')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('terminal.health')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('terminal.actions')}</th>
            </tr>
          </thead>
          {shells.map((shell) => {
              const measurement = startupMeasurements[shell.id];
              const health = healthResults[shell.id];
              const readout = shellReadouts[shell.id];
              const issues = health?.issues ?? [];
              const isMeasuring = measuringShellId === shell.id;
              const isChecking = checkingHealthShellId === shell.id;
              const isExpanded = expandedShellId === shell.id;

              return (
                <Collapsible
                  key={shell.id}
                  asChild
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedShellId(open ? shell.id : null)}
                >
                  <tbody className="border-b last:border-b-0">
                    <tr className={cn('group', shell.isDefault && 'bg-primary/[0.02]')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {getShellIcon(shell.shellType)}
                          <div>
                            <div className="flex items-center gap-1.5 font-medium">
                              {shell.name}
                              {shell.isDefault && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                  <Star className="mr-0.5 h-2.5 w-2.5" />
                                  {t('terminal.default')}
                                </Badge>
                              )}
                              {readout && readout.status !== 'ready' && (
                                <Badge
                                  variant={getReadoutStatusVariant(readout.status)}
                                  className="h-4 px-1 text-[10px]"
                                >
                                  {t(getReadoutStatusKey(readout.status))}
                                </Badge>
                              )}
                            </div>
                            {shell.version && (
                              <span className="text-xs text-muted-foreground">v{shell.version}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {getFilename(shell.executablePath)}
                            </code>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                            {shell.executablePath}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isMeasuring ? (
                          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : measurement ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn('text-xs font-medium', getStartupColorClass(measurement.withProfileMs))}>
                                {measurement.withProfileMs}ms
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {t('terminal.startupWithProfile')}: {measurement.withProfileMs}ms
                              {' | '}
                              {t('terminal.startupWithoutProfile')}: {measurement.withoutProfileMs}ms
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isChecking ? (
                          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : health ? (
                          <HealthBadge status={health.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(issues.length > 0 || shell.configFiles.length > 0 || readout?.degradedReason) && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onMeasureStartup && (
                                <DropdownMenuItem
                                  onClick={() => onMeasureStartup(shell.id)}
                                  disabled={isMeasuring}
                                >
                                  <Timer className="mr-2 h-4 w-4" />
                                  {t('terminal.measureStartup')}
                                </DropdownMenuItem>
                              )}
                              {onCheckShellHealth && (
                                <DropdownMenuItem
                                  onClick={() => onCheckShellHealth(shell.id)}
                                  disabled={isChecking}
                                >
                                  <Stethoscope className="mr-2 h-4 w-4" />
                                  {t('terminal.healthCheck')}
                                </DropdownMenuItem>
                              )}
                              {onGetShellInfo && (
                                <DropdownMenuItem onClick={() => void handleOpenDetails(shell)}>
                                  <Terminal className="mr-2 h-4 w-4" />
                                  {t('terminal.viewShellDetails')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={5} className="border-t bg-muted/20 px-4 py-3">
                          <div className="space-y-2 text-xs">
                            {readout?.degradedReason && (
                              <div className="rounded-md border border-amber-300/60 bg-amber-50/70 px-2 py-1.5 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                                {readout.degradedReason}
                              </div>
                            )}
                            {issues.length > 0 && (
                              <div>
                                <p className="mb-1 font-medium text-muted-foreground">{t('terminal.healthIssues', { count: issues.length })}</p>
                                <ul className="space-y-1">
                                  {issues.map((issue, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <span className={cn(
                                        'mt-0.5 h-1.5 w-1.5 rounded-full shrink-0',
                                        issue.severity === 'warning' ? 'bg-yellow-500' : issue.severity === 'error' ? 'bg-destructive' : 'bg-blue-400',
                                      )} />
                                      <span className="text-muted-foreground">{issue.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {shell.configFiles.length > 0 && (
                              <div>
                                <p className="mb-1 font-medium text-muted-foreground">{t('terminal.configFilesCount', { count: shell.configFiles.length })}</p>
                                <ul className="space-y-1">
                                  {shell.configFiles.map((cf) => (
                                    <li key={cf.path} className="flex items-center gap-2">
                                      <span className={cn('h-1.5 w-1.5 rounded-full', cf.exists ? 'bg-green-500' : 'bg-muted-foreground/30')} />
                                      <code className="rounded bg-muted px-1 py-0.5 font-mono">{cf.path}</code>
                                      {cf.exists && cf.sizeBytes > 0 && (
                                        <span className="text-muted-foreground">({(cf.sizeBytes / 1024).toFixed(1)} KB)</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </tbody>
                </Collapsible>
              );
            })}
        </table>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailLoading(false);
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
              {startupMeasurements[activeShell.id] && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('terminal.measureStartup')}</p>
                  <p>{startupMeasurements[activeShell.id].withProfileMs}ms / {startupMeasurements[activeShell.id].withoutProfileMs}ms</p>
                </div>
              )}
              {healthResults[activeShell.id] && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t('terminal.healthCheck')}</p>
                  <p>{healthResults[activeShell.id].status}</p>
                </div>
              )}
              {shellReadouts[activeShell.id]?.degradedReason && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Readout status</p>
                  <p>{shellReadouts[activeShell.id].degradedReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
