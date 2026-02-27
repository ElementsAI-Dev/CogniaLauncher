'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {update.current_version}
                    </Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Badge variant="default" className="font-mono text-[10px]">
                      {update.latest_version}
                    </Badge>
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
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">{t('dashboard.widgets.updatesUpToDate')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive mb-3">{error}</p>
        )}
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
