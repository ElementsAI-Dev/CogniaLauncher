'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { useWslStatus } from '@/hooks/wsl/use-wsl-status';
import { useWslStore } from '@/lib/stores/wsl';
import { buildWslOverviewHref } from '@/lib/wsl/workflow';
import { Terminal, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';

export function WslStatusWidget() {
  const { t } = useLocale();
  const {
    available,
    distros,
    status,
    runningCount,
    completeness,
    runtimeSnapshot,
  } = useWslStatus();
  const overviewContext = useWslStore((state) => state.overviewContext);

  if (available === null) {
    return (
      <Card>
        <CardContent className="py-6">
          <DashboardEmptyState
            className="py-0"
            icon={<Loader2 className="h-8 w-8 animate-spin opacity-70" />}
            message={t('common.loading')}
          />
        </CardContent>
      </Card>
    );
  }

  if (available === false) {
    return (
      <Card>
        <CardContent className="py-6">
          <DashboardEmptyState
            className="py-0"
            icon={<Terminal className="h-8 w-8 opacity-60" />}
            message={runtimeSnapshot?.reason || t('wsl.notAvailable')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t('wsl.title')}
        </CardTitle>
        <CardDescription>
          {t('wsl.kernelVersion')}: {status?.version ?? '—'}
        </CardDescription>
        {completeness.state === 'degraded' && (
          <p className="text-xs text-amber-600">
            {runtimeSnapshot?.degradedReasons[0] ?? completeness.degradedReasons[0]}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <DashboardMetricGrid className="mb-3">
          <DashboardMetricItem
            label={t('wsl.distros')}
            value={distros.length}
            valueClassName="text-2xl"
          />
          <DashboardMetricItem
            label={t('wsl.running')}
            value={runningCount}
            valueClassName="text-2xl text-green-600"
          />
        </DashboardMetricGrid>

        {distros.length > 0 && (
          <>
            <Separator className="mb-3" />
            <div className="space-y-1.5">
              {distros.slice(0, 4).map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm px-1">
                  <span className="truncate font-medium">{d.name}</span>
                  <DashboardStatusBadge tone={d.state.toLowerCase() === 'running' ? 'success' : 'muted'}>
                    {d.state.toLowerCase() === 'running' ? t('wsl.running') : t('wsl.stopped')}
                  </DashboardStatusBadge>
                </div>
              ))}
              {distros.length > 4 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{distros.length - 4} {t('common.more')}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <Link href={buildWslOverviewHref({ ...overviewContext, origin: 'widget' })}>
            <ExternalLink className="h-3.5 w-3.5" />
            {t('wsl.title')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
