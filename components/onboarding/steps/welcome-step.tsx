'use client';

import { Layers, Sparkles } from 'lucide-react';

interface WelcomeStepProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WelcomeStep({ t }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Layers className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {t('onboarding.welcomeTitle')}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t('onboarding.welcomeDesc')}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg pt-2">
        {[
          {
            icon: '🌐',
            titleKey: 'onboarding.welcomeFeature1Title',
            descKey: 'onboarding.welcomeFeature1Desc',
          },
          {
            icon: '📦',
            titleKey: 'onboarding.welcomeFeature2Title',
            descKey: 'onboarding.welcomeFeature2Desc',
          },
          {
            icon: '⚡',
            titleKey: 'onboarding.welcomeFeature3Title',
            descKey: 'onboarding.welcomeFeature3Desc',
          },
        ].map((feature) => (
          <div
            key={feature.titleKey}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 bg-muted/30"
          >
            <span className="text-2xl">{feature.icon}</span>
            <span className="text-sm font-medium">{t(feature.titleKey)}</span>
            <span className="text-xs text-muted-foreground text-center">
              {t(feature.descKey)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
        <Sparkles className="h-4 w-4" />
        <span>{t('onboarding.welcomeHint')}</span>
      </div>
    </div>
  );
}
