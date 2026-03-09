'use client';

import { PartyPopper, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CompleteStepProps } from '@/types/onboarding';

export function CompleteStep({
  t,
  onStartTour,
  onRunAction,
  tourCompleted,
  mode = 'quick',
  summary,
  actions,
}: CompleteStepProps) {
  const isDetailed = mode === 'detailed';

  const summaryItems = [
    {
      label: t('onboarding.summaryMode'),
      value: summary.mode
        ? t(summary.mode === 'quick' ? 'settings.onboardingModeQuick' : 'settings.onboardingModeDetailed')
        : t('onboarding.summaryNotSet'),
    },
    {
      label: t('onboarding.summaryLanguage'),
      value: summary.locale ? summary.locale.toUpperCase() : t('onboarding.summaryNotSet'),
    },
    {
      label: t('onboarding.summaryTheme'),
      value: summary.theme
        ? t(`onboarding.theme${summary.theme.charAt(0).toUpperCase()}${summary.theme.slice(1)}`)
        : t('onboarding.summaryNotSet'),
    },
    {
      label: t('onboarding.summaryMirrors'),
      value: summary.mirrorPreset
        ? t(`onboarding.mirrorPresetDesc_${summary.mirrorPreset}`)
        : t('onboarding.summaryNotSet'),
    },
    {
      label: t('onboarding.summaryDetected'),
      value: t('onboarding.summaryDetectedCount', { count: summary.detectedCount }),
    },
    {
      label: t('onboarding.summaryShell'),
      value: summary.shellConfigured === true
        ? t('onboarding.summaryShellConfigured')
        : summary.shellConfigured === false
          ? t('onboarding.summaryShellNotConfigured')
          : t('onboarding.summaryNotSet'),
    },
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="relative">
        <div className="absolute inset-0 -inset-x-8 -inset-y-4 pointer-events-none" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="onboarding-confetti-particle absolute rounded-full"
              style={{
                width: 6 + (i % 3) * 2,
                height: 6 + (i % 3) * 2,
                left: `${15 + i * 10}%`,
                top: `${20 + (i % 4) * 15}%`,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i],
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 animate-in zoom-in-50 duration-500">
          <PartyPopper className="h-10 w-10" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {t('onboarding.completeTitle')}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t(isDetailed ? 'onboarding.completeDetailedDesc' : 'onboarding.completeDesc')}
        </p>
      </div>

      <Card className="w-full max-w-md py-0 text-left">
        <CardHeader className="pb-2 text-sm font-semibold">
          {t('onboarding.summaryTitle')}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-right font-medium">{item.value}</span>
            </div>
          ))}
          {summary.primaryEnvironment && (
            <div className="pt-1">
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('onboarding.summaryPrimaryEnvironment', { envType: summary.primaryEnvironment })}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 w-full max-w-md pt-1">
        {actions.map((action, index) => (
          <Button
            key={action.id}
            variant={index === 0 ? 'default' : 'outline'}
            className="w-full justify-between"
            onClick={() => {
              if (action.kind === 'tour' && !tourCompleted) {
                onStartTour();
                return;
              }
              onRunAction(action);
            }}
          >
            <span>{t(action.labelKey)}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Alert>
        <ArrowRight className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {t(isDetailed ? 'onboarding.completeDetailedHint' : 'onboarding.completeHint')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
