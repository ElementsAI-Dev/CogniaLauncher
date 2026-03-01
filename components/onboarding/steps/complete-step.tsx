'use client';

import { PartyPopper, Map, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CompleteStepProps } from '@/types/onboarding';

export function CompleteStep({ t, onStartTour, tourCompleted }: CompleteStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="relative">
        {/* Celebration particles */}
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
