'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface HealthCheckWidgetProps {
  className?: string;
}

export function HealthCheckWidget({ className }: HealthCheckWidgetProps) {
  const { t } = useLocale();
  const { systemHealth, loading, checkAll } = useHealthCheck();

  useEffect(() => {
    if (isTauri()) {
      checkAll();
    }
  }, [checkAll]);

  const overallStatus: HealthStatus = systemHealth?.overall_status ?? 'unknown';
  const config = HEALTH_STATUS_CONFIG[overallStatus];
  const StatusIcon = config.icon;

  const envCount = systemHealth?.environments.length ?? 0;
  const healthyCount = systemHealth?.environments.filter((e) => e.status === 'healthy').length ?? 0;
  const warningCount = systemHealth?.environments.filter((e) => e.status === 'warning').length ?? 0;
  const errorCount = systemHealth?.environments.filter((e) => e.status === 'error').length ?? 0;
  const issueCount = systemHealth?.system_issues.length ?? 0;

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
            onClick={checkAll}
            disabled={loading}
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
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center rounded-md border p-2">
              <div className="text-lg font-bold text-green-600">{healthyCount}</div>
              <div className="text-[10px] text-muted-foreground">{t('dashboard.widgets.healthHealthy')}</div>
            </div>
            <div className="text-center rounded-md border p-2">
              <div className="text-lg font-bold text-yellow-600">{warningCount}</div>
              <div className="text-[10px] text-muted-foreground">{t('dashboard.widgets.healthWarnings')}</div>
            </div>
            <div className="text-center rounded-md border p-2">
              <div className="text-lg font-bold text-red-600">{errorCount}</div>
              <div className="text-[10px] text-muted-foreground">{t('dashboard.widgets.healthErrors')}</div>
            </div>
          </div>
        )}

        {/* Top Issues */}
        {systemHealth && systemHealth.system_issues.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {systemHealth.system_issues.slice(0, 3).map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge
                  variant={issue.severity === 'critical' || issue.severity === 'error' ? 'destructive' : 'secondary'}
                  className="text-[10px] shrink-0"
                >
                  {issue.severity}
                </Badge>
                <span className="text-muted-foreground line-clamp-1">{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href="/environments">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('dashboard.widgets.healthViewDetails')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
