'use client';

import { useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useLocale } from '@/components/providers/locale-provider';
import {
  AlertCircle,
  RefreshCw,
  ArrowUp,
  Pin,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import type {
  UpdateInfo,
  UpdateCheckProgress,
  UpdateCheckError,
  UpdateCheckCoverage,
  UpdateCheckProviderOutcome,
} from '@/lib/tauri';

export interface UpdatesTabProps {
  availableUpdates: UpdateInfo[];
  pinnedUpdates: UpdateInfo[];
  totalUpdates: number;
  isCheckingUpdates: boolean;
  updateCheckProgress: UpdateCheckProgress | null;
  updateCheckErrors: UpdateCheckError[];
  updateCheckCoverage: UpdateCheckCoverage | null;
  updateCheckProviderOutcomes: UpdateCheckProviderOutcome[] | null;
  lastUpdateCheck: number | null;
  installedPackagesCount: number;
  onCheckUpdates: () => void;
  onUpdatePackage: (name: string, version: string, provider?: string) => void;
  onUpdateAll: () => void;
  onPinPackage: (name: string, version?: string, provider?: string) => void;
  onUnpinPackage: (name: string, provider?: string) => void;
}

export function UpdatesTab({
  availableUpdates,
  pinnedUpdates,
  totalUpdates,
  isCheckingUpdates,
  updateCheckProgress,
  updateCheckErrors,
  updateCheckCoverage,
  updateCheckProviderOutcomes,
  lastUpdateCheck,
  installedPackagesCount,
  onCheckUpdates,
  onUpdatePackage,
  onUpdateAll,
  onPinPackage,
  onUnpinPackage,
}: UpdatesTabProps) {
  const { t } = useLocale();

  const unsupportedProviderOutcomes = useMemo(
    () => (updateCheckProviderOutcomes ?? []).filter((o) => o.status === 'unsupported'),
    [updateCheckProviderOutcomes],
  );
  const partialProviderOutcomes = useMemo(
    () => (updateCheckProviderOutcomes ?? []).filter((o) => o.status === 'partial'),
    [updateCheckProviderOutcomes],
  );

  const describeProviderOutcomeReason = useCallback((outcome: {
    reason: string | null;
    reason_code?: string | null;
  }) => {
    if (outcome.reason) return outcome.reason;
    switch (outcome.reason_code) {
      case 'platform_unsupported': return t('packages.updateReasonPlatformUnsupported');
      case 'missing_update_capability': return t('packages.updateReasonCapabilityMissing');
      case 'provider_executable_unavailable': return t('packages.updateReasonProviderUnavailable');
      case 'no_matching_installed_packages': return t('packages.updateReasonNoMatchingInstalled');
      case 'native_update_check_failed_with_fallback': return t('packages.updateReasonNativeFallback');
      case 'native_update_check_failed': return t('packages.updateReasonNativeFailed');
      case 'installed_package_enumeration_failed': return t('packages.updateReasonInstalledEnumerationFailed');
      default: return t('common.unknown');
    }
  }, [t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {totalUpdates > 0
              ? t('packages.updatesAvailable', { count: availableUpdates.length })
              : t('packages.clickToCheck')}
          </p>
          {updateCheckCoverage && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('packages.updateCheckCoverage', {
                supported: updateCheckCoverage.supported,
                partial: updateCheckCoverage.partial,
                unsupported: updateCheckCoverage.unsupported,
                error: updateCheckCoverage.error,
              })}
            </p>
          )}
          {pinnedUpdates.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('packages.pinnedPackagesSkipped', { count: pinnedUpdates.length })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdateCheck && !isCheckingUpdates && (
            <span className="text-xs text-muted-foreground">
              {t('packages.lastChecked', { time: new Date(lastUpdateCheck).toLocaleTimeString() })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckUpdates}
            disabled={isCheckingUpdates || installedPackagesCount === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
            {isCheckingUpdates ? t('packages.checking') : t('packages.checkForUpdates')}
          </Button>
          {availableUpdates.length > 0 && (
            <Button size="sm" onClick={onUpdateAll}>
              <ArrowUp className="h-4 w-4 mr-2" />
              {t('packages.updateAll')}
            </Button>
          )}
        </div>
      </div>

      {isCheckingUpdates ? (
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {updateCheckProgress?.phase === 'collecting'
                  ? t('packages.updateCheckCollecting')
                  : updateCheckProgress?.phase === 'checking' && updateCheckProgress.current_package
                    ? t('packages.updateCheckChecking', {
                        current: updateCheckProgress.current,
                        total: updateCheckProgress.total,
                        package: updateCheckProgress.current_package,
                      })
                    : t('packages.checking')}
              </span>
              {updateCheckProgress?.phase === 'checking' && updateCheckProgress.total > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round((updateCheckProgress.current / updateCheckProgress.total) * 100)}%
                </span>
              )}
            </div>
            <Progress
              value={
                updateCheckProgress?.phase === 'collecting'
                  ? undefined
                  : updateCheckProgress?.total
                    ? (updateCheckProgress.current / updateCheckProgress.total) * 100
                    : 0
              }
              className="h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {updateCheckProgress?.found_updates
                  ? t('packages.updatesFound', { count: updateCheckProgress.found_updates })
                  : t('packages.updateCheckProgress', {
                      current: updateCheckProgress?.current ?? 0,
                      total: updateCheckProgress?.total ?? 0,
                    })}
              </span>
              {(updateCheckProgress?.errors ?? 0) > 0 && (
                <span className="text-yellow-600">
                  {t('packages.updateCheckErrors', { count: updateCheckProgress?.errors ?? 0 })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : totalUpdates === 0 ? (
        <div className="space-y-4">
          <ProviderOutcomeAlerts
            partialOutcomes={partialProviderOutcomes}
            unsupportedOutcomes={unsupportedProviderOutcomes}
            errors={updateCheckErrors}
            describeReason={describeProviderOutcomeReason}
          />
          <Empty className="border-none py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle className="text-green-500" />
              </EmptyMedia>
              <EmptyTitle>{t('packages.allUpToDate')}</EmptyTitle>
              <EmptyDescription>{t('packages.noUpdates')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
          {/* Available Updates */}
          {availableUpdates.length > 0 && (
            <div className="space-y-2">
              {availableUpdates.map((update) => (
                <Card key={`${update.provider}:${update.name}`}>
                  <CardHeader className="py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base break-all sm:truncate" title={update.name}>
                            {update.name}
                          </CardTitle>
                          <CardDescription className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-mono text-xs break-all">{update.current_version}</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="font-mono text-xs text-green-600 font-medium break-all">{update.latest_version}</span>
                            <Badge className="bg-muted text-muted-foreground text-xs shrink-0">{update.provider}</Badge>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => onPinPackage(update.name, update.current_version, update.provider)}
                          title={t('packages.pinVersion')}
                        >
                          <Pin className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onUpdatePackage(update.name, update.latest_version, update.provider)}
                        >
                          <ArrowUp className="h-4 w-4 mr-1" />
                          {t('common.update')}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {/* Pinned Packages Section */}
          {pinnedUpdates.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Pin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('packages.pinnedPackages')}</span>
                <Badge variant="secondary">{pinnedUpdates.length}</Badge>
              </div>
              <div className="space-y-2">
                {pinnedUpdates.map((update) => (
                  <Card key={update.name} className="bg-muted/30">
                    <CardHeader className="py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <CardTitle className="text-base flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 break-all sm:truncate" title={update.name}>
                              {update.name}
                            </span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {t('packages.pinnedAt', { version: update.current_version })}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="break-all">
                            {t('packages.availableVersion')}: {update.latest_version}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 self-start sm:self-center"
                          onClick={() => onUnpinPackage(update.name, update.provider)}
                        >
                          {t('packages.unpin')}
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider Outcome Alerts (extracted for clarity)
// ---------------------------------------------------------------------------

function ProviderOutcomeAlerts({
  partialOutcomes,
  unsupportedOutcomes,
  errors,
  describeReason,
}: {
  partialOutcomes: UpdateCheckProviderOutcome[];
  unsupportedOutcomes: UpdateCheckProviderOutcome[];
  errors: UpdateCheckError[];
  describeReason: (outcome: { reason: string | null; reason_code?: string | null }) => string;
}) {
  const { t } = useLocale();

  return (
    <>
      {partialOutcomes.length > 0 && (
        <Alert className="border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('packages.updateCheckPartial', { count: partialOutcomes.length })}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
              <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                {partialOutcomes.slice(0, 5).map((outcome, i) => (
                  <li key={i}>{outcome.provider}: {describeReason(outcome)}</li>
                ))}
                {partialOutcomes.length > 5 && <li>...{partialOutcomes.length - 5} more</li>}
              </ul>
            </details>
          </AlertDescription>
        </Alert>
      )}
      {unsupportedOutcomes.length > 0 && (
        <Alert className="border-muted-foreground/30 bg-muted/40">
          <AlertDescription>
            {t('packages.updateCheckUnsupported', { count: unsupportedOutcomes.length })}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
              <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                {unsupportedOutcomes.slice(0, 5).map((outcome, i) => (
                  <li key={i}>{outcome.provider}: {describeReason(outcome)}</li>
                ))}
                {unsupportedOutcomes.length > 5 && <li>...{unsupportedOutcomes.length - 5} more</li>}
              </ul>
            </details>
          </AlertDescription>
        </Alert>
      )}
      {errors.length > 0 && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('packages.updateCheckErrors', { count: errors.length })}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs">{t('common.details')}</summary>
              <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                {errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err.provider}{err.package ? ` / ${err.package}` : ''}: {err.message}</li>
                ))}
                {errors.length > 5 && <li>...{errors.length - 5} more</li>}
              </ul>
            </details>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
