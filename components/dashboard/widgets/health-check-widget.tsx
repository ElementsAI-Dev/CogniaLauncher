'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { useHealthCheck } from '@/hooks/health/use-health-check';
import { isTauri } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { HEALTH_STATUS_CONFIG } from '@/lib/constants/dashboard';
import type { HealthStatus } from '@/types/tauri';
import type { DashboardPresentation } from '@/lib/stores/dashboard';
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardEmptyState,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';

interface HealthCheckWidgetProps {
  className?: string;
  presentation?: DashboardPresentation;
}

export function HealthCheckWidget({
  className,
  presentation = { density: 'comfortable', emphasis: 'balanced' },
}: HealthCheckWidgetProps) {
  const { t } = useLocale();
  const { systemHealth, loading, error, summary, checkAll } = useHealthCheck();
  const hasAutoCheckedRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || hasAutoCheckedRef.current) return;
    hasAutoCheckedRef.current = true;
    checkAll();
  }, [checkAll]);

  const overallStatus: HealthStatus = systemHealth?.overall_status ?? 'unknown';
  const config = HEALTH_STATUS_CONFIG[overallStatus];
  const StatusIcon = config.icon;

  const envCount = summary.environmentCount;
  const healthyCount = summary.healthyCount;
  const warningCount = summary.warningCount;
  const errorCount = summary.errorCount;
  const unavailableCount = summary.unavailableCount;
  const issueCount = summary.issueCount;
  const topIssues = [
    ...(systemHealth?.envvar_issues ?? []),
    ...(systemHealth?.system_issues ?? []),
  ];

  return (
    <Card
      className={cn(
        presentation.emphasis === 'strong' && 'border-primary/20 shadow-sm',
        className,
      )}
      data-density={presentation.density}
      data-emphasis={presentation.emphasis}
    >
      <CardHeader className={cn('pb-3', presentation.density === 'compact' && 'pb-2')}>
        <CardTitle className="text-base font-medium">
          {t('dashboard.widgets.healthCheck')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.widgets.healthCheckDesc')}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => checkAll({ force: true })}
            disabled={loading}
            aria-label={t('dashboard.widgets.healthCheckRun')}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={cn(presentation.density === 'compact' && 'pt-0')}>
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t('dashboard.widgets.sectionNeedsAttention')}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => checkAll({ force: true })}>
                {t('dashboard.widgets.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!systemHealth && (
          <DashboardEmptyState
            className="py-4"
            icon={loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" /> : <StatusIcon className={`h-8 w-8 ${config.color}`} />}
            message={loading ? t('dashboard.widgets.sectionLoading') : t('dashboard.widgets.healthCheckPrompt')}
            action={!loading ? (
              <Button size="sm" className="mt-1 gap-2" onClick={() => checkAll({ force: true })}>
                <RefreshCw className="h-4 w-4" />
                {t('dashboard.widgets.healthCheckRun')}
              </Button>
            ) : undefined}
          />
        )}

        {systemHealth && (
          <>
            {/* Overall Status */}
            <Alert
              variant={overallStatus === 'error' ? 'destructive' : 'default'}
              className="mb-3"
            >
              <StatusIcon className={`h-5 w-5 ${config.color}`} />
              <AlertTitle className={config.color}>
                {t(`dashboard.widgets.healthStatus_${overallStatus}`)}
              </AlertTitle>
              {issueCount > 0 && (
                <AlertDescription>
                  {t('dashboard.widgets.healthIssues', { count: issueCount })}
                </AlertDescription>
              )}
            </Alert>

            {/* Environment Breakdown */}
            {envCount > 0 && (
              <DashboardMetricGrid
                columns={4}
                className={cn('mb-3', presentation.density === 'compact' && 'gap-2')}
              >
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthHealthy')}
                  value={healthyCount}
                  className={cn(presentation.density === 'compact' && 'px-2.5 py-2')}
                  valueClassName={cn(
                    'text-lg text-green-600',
                    presentation.density === 'compact' && 'text-base',
                  )}
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthWarnings')}
                  value={warningCount}
                  className={cn(presentation.density === 'compact' && 'px-2.5 py-2')}
                  valueClassName={cn(
                    'text-lg text-yellow-600',
                    presentation.density === 'compact' && 'text-base',
                  )}
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthErrors')}
                  value={errorCount}
                  className={cn(presentation.density === 'compact' && 'px-2.5 py-2')}
                  valueClassName={cn(
                    'text-lg text-red-600',
                    presentation.density === 'compact' && 'text-base',
                  )}
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthUnavailable')}
                  value={unavailableCount}
                  className={cn(presentation.density === 'compact' && 'px-2.5 py-2')}
                  valueClassName={cn(
                    'text-lg text-slate-600',
                    presentation.density === 'compact' && 'text-base',
                  )}
                />
              </DashboardMetricGrid>
            )}

            {/* Top Issues */}
            {topIssues.length > 0 && (
              <div className={cn('mb-3 space-y-1.5', presentation.density === 'compact' && 'space-y-1')}>
                {topIssues.slice(0, 3).map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <DashboardStatusBadge
                      tone={issue.severity === 'critical' || issue.severity === 'error'
                        ? 'danger'
                        : issue.severity === 'warning'
                          ? 'warning'
                          : 'muted'}
                      className="shrink-0"
                    >
                      {issue.severity}
                    </DashboardStatusBadge>
                    <span className="text-muted-foreground line-clamp-1">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className={cn('border-t pt-4', presentation.density === 'compact' && 'pt-3')}>
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href="/health">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('dashboard.widgets.healthViewDetails')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
