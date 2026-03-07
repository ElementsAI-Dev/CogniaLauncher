'use client';

import { useEffect, useCallback } from 'react';
import {
  useOnboardingStore,
  getOnboardingSteps,
  type OnboardingStepId,
  type OnboardingMode,
} from '@/lib/stores/onboarding';
import { useOnboardingHydration } from './use-onboarding-hydration';

export interface UseOnboardingReturn {
  isHydrated: boolean;
  shouldShowWizard: boolean;
  mode: OnboardingMode | null;
  isCompleted: boolean;
  isSkipped: boolean;
  currentStep: number;
  currentStepId: OnboardingStepId;
  stepIds: OnboardingStepId[];
  totalSteps: number;
  progress: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  wizardOpen: boolean;
  tourActive: boolean;
  tourCompleted: boolean;
  tourStep: number;
  openWizard: () => void;
  closeWizard: () => void;
  selectMode: (mode: OnboardingMode) => void;
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
    mode,
    completed,
    skipped,
    currentStep,
    wizardOpen,
    tourCompleted,
    tourActive,
    tourStep,
    setWizardOpen,
    selectMode: selectModeAction,
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

  useEffect(() => {
    if (!isHydrated) return;
    if (!completed && !skipped && !wizardOpen && !tourActive) {
      setWizardOpen(true);
    }
  }, [isHydrated, completed, skipped, wizardOpen, tourActive, setWizardOpen]);

  const stepIds = getOnboardingSteps(mode);
  const totalSteps = stepIds.length;
  const normalizedCurrentStep = Math.min(currentStep, Math.max(totalSteps - 1, 0));
  const currentStepId = stepIds[normalizedCurrentStep] ?? 'mode-selection';
  const progress = mode && totalSteps > 1
    ? Math.round((normalizedCurrentStep / (totalSteps - 1)) * 100)
    : 0;
  const isFirstStep = normalizedCurrentStep === 0;
  const isLastStep = mode !== null && normalizedCurrentStep === totalSteps - 1;

  const openWizard = useCallback(() => setWizardOpen(true), [setWizardOpen]);
  const closeWizard = useCallback(() => skipOnboarding(), [skipOnboarding]);

  const shouldShowWizard = isHydrated && wizardOpen;

  return {
    isHydrated,
    shouldShowWizard,
    mode,
    isCompleted: completed,
    isSkipped: skipped,
    currentStep: normalizedCurrentStep,
    currentStepId,
    stepIds,
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
    selectMode: selectModeAction,
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
