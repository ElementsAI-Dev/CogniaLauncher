'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as tauri from '@/lib/tauri';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironmentDetection } from '@/hooks/use-environment-detection';
import { formatDetectionSource } from '@/lib/environment-detection';
import type { DetectedEnv, EnvironmentDetectionStepProps } from '@/types/onboarding';

export function EnvironmentDetectionStep({ t }: EnvironmentDetectionStepProps) {
  const isDesktop = tauri.isTauri();
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedEnv[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const runningRef = useRef(false);
  const storeEnvironments = useEnvironmentStore((s) => s.environments);
  const storeProviders = useEnvironmentStore((s) => s.availableProviders);
  const setEnvironments = useEnvironmentStore((s) => s.setEnvironments);
  const setAvailableProviders = useEnvironmentStore((s) => s.setAvailableProviders);
  const { detectSystemEnvironments, buildOnboardingDetections } = useEnvironmentDetection({
    availableProviders: storeProviders,
  });

  const runDetection = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setDetecting(true);
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

      setDetected(
        buildOnboardingDetections({
          environments,
          systemDetections: systemDetected,
          providers,
        }),
      );
    } catch {
      setDetected([]);
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
              <div className="w-full max-w-sm space-y-2">
                {detected.map((env) => (
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
                    </CardContent>
                  </Card>
                ))}
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
