'use client';

import { BookOpen, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { OnboardingMode } from '@/lib/stores/onboarding';
import type { ModeSelectionStepProps } from '@/types/onboarding';

const MODE_OPTIONS: Array<{
  value: OnboardingMode;
  icon: typeof Zap;
  titleKey: string;
  descKey: string;
  pointKeys: [string, string];
}> = [
  {
    value: 'quick',
    icon: Zap,
    titleKey: 'onboarding.modeSelectionQuickTitle',
    descKey: 'onboarding.modeSelectionQuickDesc',
    pointKeys: [
      'onboarding.modeSelectionQuickPoint1',
      'onboarding.modeSelectionQuickPoint2',
    ],
  },
  {
    value: 'detailed',
    icon: BookOpen,
    titleKey: 'onboarding.modeSelectionDetailedTitle',
    descKey: 'onboarding.modeSelectionDetailedDesc',
    pointKeys: [
      'onboarding.modeSelectionDetailedPoint1',
      'onboarding.modeSelectionDetailedPoint2',
    ],
  },
];

export function ModeSelectionStep({
  t,
  selectedMode,
  onSelectMode,
}: ModeSelectionStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="space-y-2 max-w-lg">
        <h2 className="text-2xl font-bold tracking-tight">
          {t('onboarding.modeSelectionTitle')}
        </h2>
        <p className="text-muted-foreground">
          {t('onboarding.modeSelectionDesc')}
        </p>
      </div>

      <RadioGroup
        value={selectedMode ?? undefined}
        onValueChange={(value) => onSelectMode(value as OnboardingMode)}
        className="grid w-full max-w-2xl gap-4 md:grid-cols-2"
      >
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <Label
              key={option.value}
              htmlFor={`mode-${option.value}`}
              className={cn(
                'flex cursor-pointer flex-col gap-4 rounded-xl border-2 p-5 text-left font-normal transition-all',
                selectedMode === option.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-muted/20 hover:bg-muted/40',
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={`mode-${option.value}`}
                className="sr-only"
                aria-label={t(option.titleKey)}
              />
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold">{t(option.titleKey)}</div>
                  <div className="text-sm text-muted-foreground">{t(option.descKey)}</div>
                </div>
              </div>
              <ul className="space-y-1.5 pl-4 text-sm text-muted-foreground">
                {option.pointKeys.map((pointKey) => (
                  <li key={pointKey} className="list-disc">
                    {t(pointKey)}
                  </li>
                ))}
              </ul>
            </Label>
          );
        })}
      </RadioGroup>

      <Alert className="max-w-xl text-left">
        <AlertDescription className="text-sm">
          {t('onboarding.modeSelectionHint')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
