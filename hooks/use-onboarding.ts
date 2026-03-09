'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  useOnboardingStore,
  getOnboardingSteps,
  type OnboardingStepId,
  type OnboardingMode,
  type OnboardingSessionState,
  type OnboardingSessionSummary,
} from '@/lib/stores/onboarding';
import type { OnboardingNextAction } from '@/types/onboarding';
import { useOnboardingHydration } from './use-onboarding-hydration';

function buildNextActions(
  summary: OnboardingSessionSummary,
  tourCompleted: boolean,
): OnboardingNextAction[] {
  const actions: OnboardingNextAction[] = [];

  if (summary.primaryEnvironment) {
    actions.push({
      id: 'manage-primary-environment',
      kind: 'environment',
      labelKey: 'onboarding.completeActionManageEnvironment',
      descriptionKey: 'onboarding.completeActionManageEnvironmentDesc',
      envType: summary.primaryEnvironment,
    });
  }

  if (!tourCompleted) {
    actions.push({
      id: 'start-guided-tour',
      kind: 'tour',
      labelKey: 'onboarding.completeActionTour',
      descriptionKey: 'onboarding.completeActionTourDesc',
    });
  }

  actions.push({
    id: 'review-settings',
    kind: 'route',
    labelKey: 'onboarding.completeActionSettings',
    descriptionKey: 'onboarding.completeActionSettingsDesc',
    route: '/settings',
  });

  return actions;
}

export interface UseOnboardingReturn {
  isHydrated: boolean;
  shouldShowWizard: boolean;
  mode: OnboardingMode | null;
  sessionState: OnboardingSessionState;
  canResume: boolean;
  sessionSummary: OnboardingSessionSummary;
  nextActions: OnboardingNextAction[];
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
  updateSummary: (summary: Partial<OnboardingSessionSummary>) => void;
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
  const pausedInRuntimeRef = useRef(false);
  const {
    mode,
    completed,
    skipped,
    currentStep,
    wizardOpen,
    tourCompleted,
    tourActive,
    tourStep,
    sessionState,
    canResume,
    sessionSummary,
    selectMode: selectModeAction,
    updateSessionSummary,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    pauseOnboarding,
    resumeOnboarding,
    startTour: startTourAction,
    nextTourStep: nextTourStepAction,
    prevTourStep: prevTourStepAction,
    completeTour: completeTourAction,
    stopTour: stopTourAction,
  } = useOnboardingStore();

  const stepIds = getOnboardingSteps(mode);
  const totalSteps = stepIds.length;
  const normalizedCurrentStep = Math.min(currentStep, Math.max(totalSteps - 1, 0));
  const currentStepId = stepIds[normalizedCurrentStep] ?? 'mode-selection';

  useEffect(() => {
    if (!isHydrated || wizardOpen || tourActive) return;
    if (completed || skipped) return;

    const resumeBlockedInRuntime = sessionState === 'paused' && pausedInRuntimeRef.current;
    if (resumeBlockedInRuntime) return;

    const canAutoOpen =
      sessionState === 'idle'
      || sessionState === 'active'
      || (sessionState === 'paused' && canResume);

    if (canAutoOpen) {
      resumeOnboarding();
    }
  }, [
    isHydrated,
    wizardOpen,
    tourActive,
    completed,
    skipped,
    sessionState,
    canResume,
    resumeOnboarding,
  ]);

  const progress = mode && totalSteps > 1
    ? Math.round((normalizedCurrentStep / (totalSteps - 1)) * 100)
    : 0;
  const isFirstStep = normalizedCurrentStep === 0;
  const isLastStep = mode !== null && normalizedCurrentStep === totalSteps - 1;

  const openWizard = useCallback(() => {
    pausedInRuntimeRef.current = false;
    resumeOnboarding();
  }, [resumeOnboarding]);

  const closeWizard = useCallback(() => {
    pausedInRuntimeRef.current = true;
    pauseOnboarding(currentStepId);
  }, [pauseOnboarding, currentStepId]);

  const skip = useCallback(() => {
    pausedInRuntimeRef.current = false;
    skipOnboarding();
  }, [skipOnboarding]);

  const shouldShowWizard = isHydrated && wizardOpen;

  const nextActions = useMemo(
    () => buildNextActions(sessionSummary, tourCompleted),
    [sessionSummary, tourCompleted],
  );

  const selectMode = useCallback((nextMode: OnboardingMode) => {
    selectModeAction(nextMode);
    updateSessionSummary({ mode: nextMode });
  }, [selectModeAction, updateSessionSummary]);

  return {
    isHydrated,
    shouldShowWizard,
    mode,
    sessionState,
    canResume,
    sessionSummary,
    nextActions,
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
    selectMode,
    updateSummary: updateSessionSummary,
    next: nextStep,
    prev: prevStep,
    goTo: goToStep,
    complete: completeOnboarding,
    skip,
    reset: resetOnboarding,
    startTour: startTourAction,
    nextTourStep: nextTourStepAction,
    prevTourStep: prevTourStepAction,
    completeTour: completeTourAction,
    stopTour: stopTourAction,
  };
}
