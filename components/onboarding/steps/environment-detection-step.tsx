'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as tauri from '@/lib/tauri';
import { getLogicalEnvType, useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironmentDetection } from '@/hooks/use-environment-detection';
import { formatDetectionSource } from '@/lib/environment-detection';
import type { DetectedEnv, EnvironmentDetectionStepProps } from '@/types/onboarding';

function mergeRetainedSystemRows(previous: DetectedEnv[], next: DetectedEnv[]): DetectedEnv[] {
  const rows = new Map<string, DetectedEnv>();

  for (const row of next) {
    rows.set(row.envType ?? row.name, row);
  }

  for (const row of previous) {
    if (row.scope !== 'system') {
      continue;
    }

    const key = row.envType ?? row.name;
    if (!rows.has(key)) {
      rows.set(key, row);
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function EnvironmentDetectionStep({
  t,
  mode = 'quick',
  onDetectionSummaryChange,
}: EnvironmentDetectionStepProps) {
  const isDesktop = tauri.isTauri();
  const router = useRouter();
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedEnv[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const runningRef = useRef(false);
  const storeEnvironments = useEnvironmentStore((s) => s.environments);
  const storeProviders = useEnvironmentStore((s) => s.availableProviders);
  const setEnvironments = useEnvironmentStore((s) => s.setEnvironments);
  const setAvailableProviders = useEnvironmentStore((s) => s.setAvailableProviders);
  const setWorkflowContext = useEnvironmentStore((s) => s.setWorkflowContext);
  const { detectSystemEnvironments, buildOnboardingDetections } = useEnvironmentDetection({
    availableProviders: storeProviders,
  });

  const runDetection = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setDetecting(true);
    setDetectError(null);
    try {
      if (!isDesktop) {
        setDetected([]);
        return;
      }

      const [systemResult, environmentsResult, providersResult] = await Promise.allSettled([
        detectSystemEnvironments(),
        tauri.envList(),
        tauri.envListProviders(),
      ]);

      const systemDetected = systemResult.status === 'fulfilled'
        ? systemResult.value
        : [];
      const systemError = systemResult.status === 'rejected'
        ? (systemResult.reason instanceof Error ? systemResult.reason.message : String(systemResult.reason))
        : null;
      const environments = environmentsResult.status === 'fulfilled'
        ? environmentsResult.value
        : storeEnvironments;
      const providers = providersResult.status === 'fulfilled'
        ? providersResult.value
        : storeProviders;

      if (environmentsResult.status === 'fulfilled') {
        setEnvironments(environmentsResult.value);
      }
      if (providersResult.status === 'fulfilled') {
        setAvailableProviders(providersResult.value);
      }

      const nextDetections = buildOnboardingDetections({
        environments,
        systemDetections: systemDetected,
        providers,
      });

      if (systemError) {
        setDetectError(systemError);
      }

      setDetected((previous) => (
        systemError
          ? mergeRetainedSystemRows(previous, nextDetections)
          : nextDetections
      ));
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : String(error));
      setDetected((previous) => previous);
    } finally {
      runningRef.current = false;
      setDetecting(false);
      setHasRun(true);
    }
  }, [
    buildOnboardingDetections,
    detectSystemEnvironments,
    isDesktop,
    setAvailableProviders,
    setEnvironments,
    storeEnvironments,
    storeProviders,
  ]);

  // Seed from cache for quick first paint, then run full detection once.
  useEffect(() => {
    if (hasRun) return;

    if (!isDesktop) {
      setDetected([]);
      setHasRun(true);
      return;
    }

    if (storeEnvironments.length > 0) {
      setDetected(
        buildOnboardingDetections({
          environments: storeEnvironments,
          providers: storeProviders,
        }),
      );
    }

    void runDetection();
  }, [
    buildOnboardingDetections,
    hasRun,
    isDesktop,
    runDetection,
    storeEnvironments,
    storeProviders,
  ]);

  const detectedCount = detected.filter((e) => e.available).length;

  useEffect(() => {
    if (!onDetectionSummaryChange) {
      return;
    }

    const manageableEnvironments = Array.from(new Set(
      detected
        .filter((env) => env.available && typeof env.envType === 'string' && env.envType.length > 0)
        .map((env) => env.envType as string),
    ));

    onDetectionSummaryChange({
      detectedCount,
      primaryEnvironment: manageableEnvironments[0] ?? null,
      manageableEnvironments,
    });
  }, [detected, detectedCount, onDetectionSummaryChange]);

  const handleManageEnvironment = useCallback((envType: string) => {
    const logicalEnvType = getLogicalEnvType(envType, storeProviders);
    setWorkflowContext({
      envType: logicalEnvType,
      origin: 'onboarding',
      returnHref: '/environments',
      updatedAt: Date.now(),
    });
    router.push(`/environments/${logicalEnvType}`);
  }, [router, setWorkflowContext, storeProviders]);

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Layers className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('onboarding.envDetectionTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('onboarding.envDetectionDesc')}
        </p>
      </div>

      {mode === 'detailed' && (
        <div className="w-full max-w-md space-y-3 text-left">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('onboarding.envDetailedPurpose')}
            </AlertDescription>
          </Alert>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('onboarding.envDetailedRecommendation')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {detecting ? (
        <div className="w-full max-w-sm space-y-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <p className="text-sm text-muted-foreground text-center pt-2">
            {t('onboarding.envDetecting')}
          </p>
        </div>
      ) : (
        <>
          {isDesktop && hasRun && (
            <p className="text-sm font-medium">
              {t('onboarding.envDetectedCount', { count: detectedCount })}
            </p>
          )}
          {isDesktop ? (
            <>
              {detectError && (
                <Alert className="w-full max-w-sm text-left">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {t('onboarding.envDetectionError', { message: detectError })}
                  </AlertDescription>
                </Alert>
              )}
              <div className="w-full max-w-sm space-y-2">
                {detected.map((env) => {
                  const envType = env.envType;
                  return (
                    <Card
                      key={env.name}
                      className="py-0"
                    >
                    <CardContent className="flex items-center gap-3 p-3">
                      {env.available ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{env.name}</div>
                        {env.version && (
                          <div className="text-xs text-muted-foreground">{env.version}</div>
                        )}
                        {env.source && (
                          <div className="text-xs text-muted-foreground">
                            {t('onboarding.envSourceLabel', {
                              source: formatDetectionSource(env.source),
                            })}
                          </div>
                        )}
                        {env.sourcePath && (
                          <div
                            className="text-[11px] text-muted-foreground/80 truncate"
                            title={env.sourcePath}
                          >
                            {env.sourcePath}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={env.available ? 'default' : 'secondary'}>
                            {env.available ? t('onboarding.envAvailable') : t('onboarding.envNotFound')}
                          </Badge>
                          {env.scope && (
                            <Badge variant="outline">
                              {env.scope === 'system'
                                ? t('onboarding.envScopeSystem')
                                : t('onboarding.envScopeManaged')}
                            </Badge>
                          )}
                        </div>
                        {env.available && envType && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleManageEnvironment(envType)}
                          >
                            {t('onboarding.envManageAction')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runDetection}
                disabled={detecting}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t('onboarding.envRescan')}
              </Button>
            </>
          ) : (
            <Alert className="max-w-sm">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t('onboarding.envWebModeNote')}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
