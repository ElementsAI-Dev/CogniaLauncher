'use client';

import { cn } from '@/lib/utils';

interface TerminalQuickStatusProps {
  shellCount: number;
  profileCount: number;
  healthStatus: 'ok' | 'warning' | 'error' | 'unchecked';
  proxyMode: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  className?: string;
}

const HEALTH_COLORS: Record<string, string> = {
  ok: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-destructive',
  unchecked: 'text-muted-foreground',
};

const HEALTH_DOTS: Record<string, string> = {
  ok: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-destructive',
  unchecked: 'bg-muted-foreground/30',
};

export function TerminalQuickStatus({
  shellCount,
  profileCount,
  healthStatus,
  proxyMode,
  t,
  className,
}: TerminalQuickStatusProps) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3 text-xs', className)}>
      <p className="mb-2 font-medium text-muted-foreground">{t('terminal.quickStatus')}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('terminal.tabShells')}</span>
          <span>{shellCount} {t('terminal.detected')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('terminal.tabProfiles')}</span>
          <span>{profileCount} {t('terminal.saved')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('terminal.healthCheck')}</span>
          <span className={cn('flex items-center gap-1', HEALTH_COLORS[healthStatus])}>
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', HEALTH_DOTS[healthStatus])} />
            {t(`terminal.healthStatus.${healthStatus}`)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('terminal.tabProxy')}</span>
          <span className="text-muted-foreground">{proxyMode === 'none' ? t('terminal.proxyModeNone') : proxyMode}</span>
        </div>
      </div>
    </div>
  );
}
