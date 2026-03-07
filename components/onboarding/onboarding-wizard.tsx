'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
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
import { STEP_ICONS } from '@/lib/constants/onboarding';
import { MIRROR_PRESETS } from '@/lib/constants/mirrors';
import { isTauri } from '@/lib/tauri';
import { ModeSelectionStep } from './steps/mode-selection-step';
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
  stepIds,
  mode,
  totalSteps,
  progress,
  isFirstStep,
  isLastStep,
  tourCompleted,
  onNext,
  onPrev,
  onGoTo,
  onSelectMode,
  onComplete,
  onSkip,
  onStartTour,
  onClose,
}: OnboardingWizardProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();

  const currentStepId = stepIds[currentStep] ?? stepIds[0] ?? 'mode-selection';
  const isModeSelectionStep = currentStepId === 'mode-selection';
  const nextDisabled = isModeSelectionStep && !mode;
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (currentStep > prevStepRef.current) setDirection('forward');
    else if (currentStep < prevStepRef.current) setDirection('back');
    prevStepRef.current = currentStep;
  }, [currentStep]);

  const handleAdvance = useCallback(() => {
    if (nextDisabled) {
      return;
    }

    if (isLastStep) {
      onComplete();
      return;
    }

    onNext();
  }, [isLastStep, nextDisabled, onComplete, onNext]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        handleAdvance();
      } else if (event.key === 'ArrowLeft') {
        if (!isFirstStep) onPrev();
      } else if (event.key === 'Escape') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleAdvance, isFirstStep, onPrev, onSkip]);

  const handleStartTourAndClose = useCallback(() => {
    onComplete();
    onStartTour();
  }, [onComplete, onStartTour]);

  const handleApplyMirrorPreset = useCallback(async (presetKey: string) => {
    const preset = MIRROR_PRESETS[presetKey];
    if (!preset || !isTauri()) return;

    try {
      const { configSet } = await import('@/lib/tauri');
      await Promise.all([
        configSet('mirrors.npm', preset.npm),
        configSet('mirrors.pypi', preset.pypi),
        configSet('mirrors.crates', preset.crates),
        configSet('mirrors.go', preset.go),
      ]);
    } catch {
      // Non-critical: user can configure mirrors later in Settings.
    }
  }, []);

  const renderStep = () => {
    switch (currentStepId) {
      case 'mode-selection':
        return (
          <ModeSelectionStep
            t={t}
            selectedMode={mode}
            onSelectMode={onSelectMode}
          />
        );
      case 'welcome':
        return <WelcomeStep t={t} />;
      case 'language':
        return <LanguageStep locale={locale} setLocale={setLocale} t={t} />;
      case 'theme':
        return <ThemeStep theme={theme} setTheme={setTheme} t={t} />;
      case 'environment-detection':
        return <EnvironmentDetectionStep mode={mode ?? 'quick'} t={t} />;
      case 'mirrors':
        return (
          <MirrorsStep
            mode={mode ?? 'quick'}
            t={t}
            onApplyPreset={handleApplyMirrorPreset}
          />
        );
      case 'shell-init':
        return <ShellInitStep mode={mode ?? 'quick'} t={t} />;
      case 'complete':
        return (
          <CompleteStep
            mode={mode ?? 'quick'}
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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="sr-only">
            {t('onboarding.wizardTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('onboarding.wizardDesc')}
          </DialogDescription>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {stepIds.map((stepId, index) => {
              const Icon = STEP_ICONS[stepId];
              const isActive = index === currentStep;
              const isDone = index < currentStep;
              const stepLabel = t(`onboarding.step${stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-./g, (match) => match[1].toUpperCase())}`);

              return (
                <Tooltip key={stepId}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onGoTo(index)}
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

        <ScrollArea className="flex-1 min-h-0">
          <div
            key={`${mode ?? 'unselected'}-${currentStepId}`}
            className={cn(
              'px-6 py-4 animate-in fade-in-0 duration-200',
              direction === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4',
            )}
          >
            {renderStep()}
          </div>
        </ScrollArea>

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
              <Button onClick={handleAdvance} disabled={nextDisabled}>
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
