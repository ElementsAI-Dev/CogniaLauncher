'use client';

import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { useTheme } from 'next-themes';
import { ONBOARDING_STEPS } from '@/lib/stores/onboarding';
import { STEP_ICONS } from '@/lib/constants/onboarding';
import { WelcomeStep } from './steps/welcome-step';
import { LanguageStep } from './steps/language-step';
import { ThemeStep } from './steps/theme-step';
import { EnvironmentDetectionStep } from './steps/environment-detection-step';
import { MirrorsStep } from './steps/mirrors-step';
import { ShellInitStep } from './steps/shell-init-step';
import { CompleteStep } from './steps/complete-step';
import { ChevronLeft, ChevronRight, SkipForward, Check } from 'lucide-react';
import type { OnboardingWizardProps } from '@/types/onboarding';

export function OnboardingWizard({
  open,
  currentStep,
  totalSteps,
  progress,
  isFirstStep,
  isLastStep,
  tourCompleted,
  onNext,
  onPrev,
  onGoTo,
  onComplete,
  onSkip,
  onStartTour,
  onClose,
}: OnboardingWizardProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();

  const currentStepId = ONBOARDING_STEPS[currentStep] ?? 'welcome';

  const handleStartTourAndClose = useCallback(() => {
    onComplete();
    onStartTour();
  }, [onComplete, onStartTour]);

  const renderStep = () => {
    switch (currentStepId) {
      case 'welcome':
        return <WelcomeStep t={t} />;
      case 'language':
        return <LanguageStep locale={locale} setLocale={setLocale} t={t} />;
      case 'theme':
        return <ThemeStep theme={theme} setTheme={setTheme} t={t} />;
      case 'environment-detection':
        return <EnvironmentDetectionStep t={t} />;
      case 'mirrors':
        return <MirrorsStep t={t} />;
      case 'shell-init':
        return <ShellInitStep t={t} />;
      case 'complete':
        return (
          <CompleteStep
            t={t}
            onStartTour={handleStartTourAndClose}
            tourCompleted={tourCompleted}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="sr-only">
            {t('onboarding.wizardTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('onboarding.wizardDesc')}
          </DialogDescription>
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {ONBOARDING_STEPS.map((stepId, idx) => {
              const Icon = STEP_ICONS[stepId];
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              const stepLabel = t(`onboarding.step${stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-./g, (m) => m[1].toUpperCase())}`);
              return (
                <Tooltip key={stepId}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onGoTo(idx)}
                      aria-label={stepLabel}
                      className={cn(
                        'flex items-center justify-center rounded-full transition-all',
                        isActive
                          ? 'h-9 w-9 bg-primary text-primary-foreground shadow-sm'
                          : isDone
                            ? 'h-7 w-7 bg-primary/20 text-primary hover:bg-primary/30'
                            : 'h-7 w-7 bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      <Icon className={isActive ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{stepLabel}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="pt-3">
            <Progress value={progress} className="h-1" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>
                {t('onboarding.stepOf', { current: currentStep + 1, total: totalSteps })}
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Step content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">
            {renderStep()}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 pb-6 pt-2 flex-row justify-between border-t">
          <div>
            {!isFirstStep && !isLastStep && (
              <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                <SkipForward className="h-4 w-4 mr-1.5" />
                {t('onboarding.skip')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={onPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('onboarding.back')}
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={onComplete}>
                <Check className="h-4 w-4 mr-1" />
                {t('onboarding.finish')}
              </Button>
            ) : (
              <Button onClick={onNext}>
                {t('onboarding.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
