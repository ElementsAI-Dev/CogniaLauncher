'use client';

import { PartyPopper, Map, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompleteStepProps {
  t: (key: string) => string;
  onStartTour: () => void;
  tourCompleted: boolean;
}

export function CompleteStep({ t, onStartTour, tourCompleted }: CompleteStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
        <PartyPopper className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {t('onboarding.completeTitle')}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t('onboarding.completeDesc')}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm pt-2">
        {!tourCompleted && (
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={onStartTour}
          >
            <Map className="h-4 w-4" />
            {t('onboarding.completeTakeTour')}
          </Button>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
          <ArrowRight className="h-4 w-4" />
          <span>{t('onboarding.completeHint')}</span>
        </div>
      </div>
    </div>
  );
}
