'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isTauri } from '@/lib/tauri';
import type { DetectedEnv, EnvironmentDetectionStepProps } from '@/types/onboarding';

export function EnvironmentDetectionStep({ t }: EnvironmentDetectionStepProps) {
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedEnv[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const runDetection = useCallback(async () => {
    setDetecting(true);
    try {
      if (isTauri()) {
        const { envDetectSystemAll } = await import('@/lib/tauri');
        const result = await envDetectSystemAll();
        setDetected(
          result.map((env) => ({
            name: env.env_type || 'Unknown',
            version: env.version || '',
            available: true,
          })),
        );
      } else {
        // Web mode: simulate detection with common tools
        await new Promise((r) => setTimeout(r, 1500));
        setDetected([
          { name: 'Node.js', version: '(web mode)', available: false },
          { name: 'Python', version: '(web mode)', available: false },
          { name: 'Rust', version: '(web mode)', available: false },
        ]);
      }
    } catch {
      setDetected([]);
    } finally {
      setDetecting(false);
      setHasRun(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRun) {
      runDetection();
    }
  }, [hasRun, runDetection]);

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
          {hasRun && (
            <p className="text-sm font-medium">
              {t('onboarding.envDetectedCount', { count: detectedCount })}
            </p>
          )}
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
                  </div>
                  <Badge variant={env.available ? 'default' : 'secondary'} className="shrink-0">
                    {env.available ? t('onboarding.envAvailable') : t('onboarding.envNotFound')}
                  </Badge>
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
          {!isTauri() && hasRun && (
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
