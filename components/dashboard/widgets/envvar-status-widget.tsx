'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { useEnvVar } from '@/hooks/envvar/use-envvar';
import { DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard/dashboard-primitives';
import { RefreshCw, Variable, AlertCircle, Route, ExternalLink, ShieldAlert, History } from 'lucide-react';

interface EnvVarStatusWidgetProps {
  className?: string;
}

function formatSnapshotTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function EnvVarStatusWidget({ className }: EnvVarStatusWidgetProps) {
  const { t } = useLocale();
  const { overview, overviewLoading, overviewError, getOverview } = useEnvVar();

  useEffect(() => {
    void getOverview();
  }, [getOverview]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t('dashboard.widgets.envvarStatus')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.widgets.envvarStatusDesc')}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void getOverview({ forceRefresh: true })}
            disabled={overviewLoading}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${overviewLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {overviewError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('dashboard.widgets.sectionNeedsAttention')}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{overviewError}</p>
              <Button variant="outline" size="sm" onClick={() => void getOverview({ forceRefresh: true })}>
                {t('dashboard.widgets.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!overview && !overviewError ? (
          <DashboardEmptyState
            className="py-4"
            icon={<Variable className="h-8 w-8 text-muted-foreground/70" />}
            message={t('dashboard.widgets.envvarStatusPrompt')}
          />
        ) : null}

        {overview ? (
          <>
            <DashboardMetricGrid columns={3}>
              <Link
                href="/envvar?tab=variables"
                className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
                aria-label={t('dashboard.widgets.envvarMetricTotal')}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Variable className="h-3.5 w-3.5" />
                  <span>{t('dashboard.widgets.envvarMetricTotal')}</span>
                </div>
                <div className="mt-1 text-lg font-semibold leading-none">{overview.totalVars}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {overview.processCount}/{overview.userCount}/{overview.systemCount}
                </div>
              </Link>

              <Link
                href="/envvar?tab=variables"
                className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
                aria-label={t('dashboard.widgets.envvarMetricConflicts')}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>{t('dashboard.widgets.envvarMetricConflicts')}</span>
                </div>
                <div className="mt-1 text-lg font-semibold leading-none">{overview.conflictCount}</div>
              </Link>

              <Link
                href="/envvar?tab=path"
                className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
                aria-label={t('dashboard.widgets.envvarMetricPathIssues')}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Route className="h-3.5 w-3.5" />
                  <span>{t('dashboard.widgets.envvarMetricPathIssues')}</span>
                </div>
                <div className="mt-1 text-lg font-semibold leading-none">{overview.pathIssueCount}</div>
              </Link>
            </DashboardMetricGrid>

            <div className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                <span>{t('dashboard.widgets.envvarMetricLatestSnapshot')}</span>
              </div>
              <div className="mt-1 text-sm font-medium leading-none">
                {formatSnapshotTime(overview.latestSnapshotAt)}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href="/envvar">
            <ExternalLink className="h-3.5 w-3.5" />
            {t('nav.envvar')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
