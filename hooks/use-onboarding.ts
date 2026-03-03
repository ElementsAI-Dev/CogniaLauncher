import { useEffect, useCallback } from 'react';
import { useOnboardingStore, ONBOARDING_STEPS, type OnboardingStepId } from '@/lib/stores/onboarding';
import { useOnboardingHydration } from './use-onboarding-hydration';

export interface UseOnboardingReturn {
  /** Whether onboarding state has been hydrated from persisted storage */
  isHydrated: boolean;
  /** Whether the wizard should be shown (first run or manually opened) */
  shouldShowWizard: boolean;
  /** Whether onboarding has been completed */
  isCompleted: boolean;
  /** Whether onboarding was skipped */
  isSkipped: boolean;
  /** Current step index */
  currentStep: number;
  /** Current step ID */
  currentStepId: OnboardingStepId;
  /** Total number of steps */
  totalSteps: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether we're on the first step */
  isFirstStep: boolean;
  /** Whether we're on the last step */
  isLastStep: boolean;
  /** Whether wizard dialog is open */
  wizardOpen: boolean;
  /** Guided tour state */
  tourActive: boolean;
  tourCompleted: boolean;
  tourStep: number;

  // Actions
  openWizard: () => void;
  closeWizard: () => void;
  next: () => void;
  prev: () => void;
  goTo: (step: number) => void;
  complete: () => void;
  skip: () => void;
  reset: () => void;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  completeTour: () => void;
  stopTour: () => void;
}

export function useOnboarding(): UseOnboardingReturn {
  const isHydrated = useOnboardingHydration();
  const {
    completed,
    skipped,
    currentStep,
    wizardOpen,
    tourCompleted,
    tourActive,
    tourStep,
    setWizardOpen,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    startTour: startTourAction,
    nextTourStep: nextTourStepAction,
    prevTourStep: prevTourStepAction,
    completeTour: completeTourAction,
    stopTour: stopTourAction,
  } = useOnboardingStore();

  // Auto-open wizard on first run, only after persist hydration has completed.
  useEffect(() => {
    if (!isHydrated) return;
    if (!completed && !skipped && !wizardOpen && !tourActive) {
      setWizardOpen(true);
    }
  }, [isHydrated, completed, skipped, wizardOpen, tourActive, setWizardOpen]);

  const currentStepId = ONBOARDING_STEPS[currentStep] ?? 'welcome';
  const totalSteps = ONBOARDING_STEPS.length;
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const openWizard = useCallback(() => setWizardOpen(true), [setWizardOpen]);
  const closeWizard = useCallback(() => skipOnboarding(), [skipOnboarding]);

  const shouldShowWizard = isHydrated && wizardOpen;

  return {
    isHydrated,
    shouldShowWizard,
    isCompleted: completed,
    isSkipped: skipped,
    currentStep,
    currentStepId,
    totalSteps,
    progress,
    isFirstStep,
    isLastStep,
    wizardOpen,
    tourActive,
    tourCompleted,
    tourStep,

    openWizard,
    closeWizard,
    next: nextStep,
    prev: prevStep,
    goTo: goToStep,
    complete: completeOnboarding,
    skip: skipOnboarding,
    reset: resetOnboarding,
    startTour: startTourAction,
    nextTourStep: nextTourStepAction,
    prevTourStep: prevTourStepAction,
    completeTour: completeTourAction,
    stopTour: stopTourAction,
  };
}
