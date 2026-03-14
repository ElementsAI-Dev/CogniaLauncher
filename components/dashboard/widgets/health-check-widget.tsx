'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { useHealthCheck } from '@/hooks/use-health-check';
import { isTauri } from '@/lib/tauri';
import {
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { HEALTH_STATUS_CONFIG } from '@/lib/constants/dashboard';
import type { HealthStatus } from '@/types/tauri';
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardEmptyState,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';

interface HealthCheckWidgetProps {
  className?: string;
}

export function HealthCheckWidget({ className }: HealthCheckWidgetProps) {
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

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
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
      <CardContent>
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
              <DashboardMetricGrid columns={4} className="mb-3">
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthHealthy')}
                  value={healthyCount}
                  valueClassName="text-lg text-green-600"
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthWarnings')}
                  value={warningCount}
                  valueClassName="text-lg text-yellow-600"
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthErrors')}
                  value={errorCount}
                  valueClassName="text-lg text-red-600"
                />
                <DashboardMetricItem
                  label={t('dashboard.widgets.healthUnavailable')}
                  value={unavailableCount}
                  valueClassName="text-lg text-slate-600"
                />
              </DashboardMetricGrid>
            )}

            {/* Top Issues */}
            {systemHealth.system_issues.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {systemHealth.system_issues.slice(0, 3).map((issue, i) => (
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
      <CardFooter className="border-t pt-4">
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
