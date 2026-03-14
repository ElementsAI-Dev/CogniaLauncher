'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/components/providers/locale-provider';
import { useUpdateCheck } from '@/hooks/use-update-check';
import {
  ArrowUpCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Package,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import {
  DashboardEmptyState,
  DashboardStatusBadge,
} from '@/components/dashboard/dashboard-primitives';

interface UpdatesWidgetProps {
  className?: string;
}

export function UpdatesWidget({ className }: UpdatesWidgetProps) {
  const { t } = useLocale();
  const {
    availableUpdates,
    isCheckingUpdates,
    updateCheckProgress,
    lastUpdateCheck,
    error,
    progressPercent,
    lastCheckFormatted,
    handleCheckUpdates,
  } = useUpdateCheck();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {t('dashboard.widgets.updatesAvailable')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.widgets.updatesAvailableDesc')}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdates}
            aria-label={t('dashboard.widgets.updatesCheckNow')}
          >
            {isCheckingUpdates ? (
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
              <Button variant="outline" size="sm" onClick={handleCheckUpdates}>
                {t('dashboard.widgets.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Checking progress */}
        {isCheckingUpdates && updateCheckProgress && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{updateCheckProgress.current_package || updateCheckProgress.phase}</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        )}

        {!isCheckingUpdates && availableUpdates.length === 0 && !lastUpdateCheck && !error && (
          <DashboardEmptyState
            className="py-4"
            icon={<ArrowUpCircle className="h-8 w-8 text-muted-foreground/70" />}
            message={t('dashboard.widgets.updatesCheckPrompt')}
            action={(
              <Button size="sm" className="mt-1 gap-2" onClick={handleCheckUpdates}>
                <RefreshCw className="h-4 w-4" />
                {t('dashboard.widgets.updatesCheckNow')}
              </Button>
            )}
          />
        )}

        {/* Results */}
        {!isCheckingUpdates && availableUpdates.length > 0 && (
          <>
            <Alert className="mb-3">
              <ArrowUpCircle className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-700 dark:text-orange-400">
                {t('dashboard.widgets.updatesCount', { count: availableUpdates.length })}
              </AlertTitle>
            </Alert>

            <div className="space-y-1.5 mb-3">
              {availableUpdates.slice(0, 5).map((update) => (
                <div
                  key={`${update.provider}-${update.name}`}
                  className="flex items-center justify-between text-sm rounded-md border px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{update.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DashboardStatusBadge className="font-mono">
                      {update.current_version}
                    </DashboardStatusBadge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <DashboardStatusBadge tone="success" className="font-mono">
                      {update.latest_version}
                    </DashboardStatusBadge>
                  </div>
                </div>
              ))}
              {availableUpdates.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{availableUpdates.length - 5} {t('common.more')}
                </p>
              )}
            </div>
          </>
        )}

        {/* No updates */}
        {!isCheckingUpdates && availableUpdates.length === 0 && lastUpdateCheck && (
          <DashboardEmptyState
            className="py-4"
            icon={<CheckCircle2 className="h-8 w-8 text-green-500" />}
            message={t('dashboard.widgets.updatesUpToDate')}
          />
        )}

        {/* Error */}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center justify-between w-full">
          {lastCheckFormatted && (
            <span className="text-[10px] text-muted-foreground">
              {t('dashboard.lastUpdated', { time: lastCheckFormatted })}
            </span>
          )}
          <Button variant="outline" size="sm" className="gap-2 ml-auto" asChild>
            <Link href="/packages">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('dashboard.packageList.viewAll')}
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
