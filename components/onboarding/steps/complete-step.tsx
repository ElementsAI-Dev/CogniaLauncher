'use client';

import { PartyPopper, Map, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CompleteStepProps } from '@/types/onboarding';

export function CompleteStep({ t, onStartTour, tourCompleted }: CompleteStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
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
          <Card className="py-0">
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="gap-2 w-full"
                onClick={onStartTour}
              >
                <Map className="h-4 w-4" />
                {t('onboarding.completeTakeTour')}
              </Button>
            </CardContent>
          </Card>
        )}
        <Alert>
          <ArrowRight className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('onboarding.completeHint')}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
