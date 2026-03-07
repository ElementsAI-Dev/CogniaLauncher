import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type OnboardingMode = 'quick' | 'detailed';

export type OnboardingStepId =
  | 'mode-selection'
  | 'welcome'
  | 'language'
  | 'theme'
  | 'environment-detection'
  | 'mirrors'
  | 'shell-init'
  | 'complete';

export const ONBOARDING_STEP_SEQUENCES: Record<OnboardingMode, OnboardingStepId[]> = {
  quick: [
    'mode-selection',
    'language',
    'theme',
    'environment-detection',
    'mirrors',
    'shell-init',
    'complete',
  ],
  detailed: [
    'mode-selection',
    'welcome',
    'language',
    'theme',
    'environment-detection',
    'mirrors',
    'shell-init',
    'complete',
  ],
};

const MODE_SELECTION_STEPS: OnboardingStepId[] = ['mode-selection'];

export const ONBOARDING_STEPS: OnboardingStepId[] = ONBOARDING_STEP_SEQUENCES.detailed;

export function getOnboardingSteps(mode: OnboardingMode | null | undefined): OnboardingStepId[] {
  return mode ? ONBOARDING_STEP_SEQUENCES[mode] : MODE_SELECTION_STEPS;
}

function clampStepIndex(step: number, steps: OnboardingStepId[]): number {
  if (steps.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(step, steps.length - 1));
}

function addVisitedStep(visitedSteps: string[], stepId?: string): string[] {
  if (!stepId || visitedSteps.includes(stepId)) {
    return visitedSteps;
  }

  return [...visitedSteps, stepId];
}

export interface OnboardingState {
  mode: OnboardingMode | null;
  completed: boolean;
  skipped: boolean;
  currentStep: number;
  visitedSteps: string[];
  wizardOpen: boolean;
  tourCompleted: boolean;
  tourActive: boolean;
  tourStep: number;
  version: number;
  dismissedHints: string[];
  hintsEnabled: boolean;
  setWizardOpen: (open: boolean) => void;
  selectMode: (mode: OnboardingMode) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepVisited: (stepId: string) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  completeTour: () => void;
  stopTour: () => void;
  dismissHint: (hintId: string) => void;
  dismissAllHints: (allHintIds?: string[]) => void;
  resetHints: () => void;
  setHintsEnabled: (enabled: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      mode: null,
      completed: false,
      skipped: false,
      currentStep: 0,
      visitedSteps: [],
      wizardOpen: false,
      tourCompleted: false,
      tourActive: false,
      tourStep: 0,
      version: 3,
      dismissedHints: [],
      hintsEnabled: true,

      setWizardOpen: (wizardOpen) => set({ wizardOpen }),

      selectMode: (mode) =>
        set((state) => {
          if (state.mode === mode) {
            return {
              mode,
              visitedSteps: addVisitedStep(state.visitedSteps, 'mode-selection'),
            };
          }

          return {
            mode,
            currentStep: 0,
            visitedSteps: ['mode-selection'],
          };
        }),

      goToStep: (step) =>
        set((state) => {
          const steps = getOnboardingSteps(state.mode);
          const nextStep = clampStepIndex(step, steps);
          const stepId = steps[nextStep];

          return {
            currentStep: nextStep,
            visitedSteps: addVisitedStep(state.visitedSteps, stepId),
          };
        }),

      nextStep: () =>
        set((state) => {
          const steps = getOnboardingSteps(state.mode);
          if (steps.length <= 1) {
            return state;
          }

          const nextStep = clampStepIndex(state.currentStep + 1, steps);
          const stepId = steps[nextStep];

          return {
            currentStep: nextStep,
            visitedSteps: addVisitedStep(state.visitedSteps, stepId),
          };
        }),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),

      markStepVisited: (stepId) =>
        set((state) => ({
          visitedSteps: addVisitedStep(state.visitedSteps, stepId),
        })),

      completeOnboarding: () =>
        set((state) => ({
          completed: true,
          skipped: false,
          wizardOpen: false,
          currentStep: getOnboardingSteps(state.mode).length - 1,
        })),

      skipOnboarding: () =>
        set({
          skipped: true,
          wizardOpen: false,
        }),

      resetOnboarding: () =>
        set({
          mode: null,
          completed: false,
          skipped: false,
          currentStep: 0,
          visitedSteps: [],
          wizardOpen: true,
          tourCompleted: false,
          tourActive: false,
          tourStep: 0,
        }),

      startTour: () =>
        set((state) => (
          state.tourActive
            ? state
            : {
                tourActive: true,
                tourStep: 0,
              }
        )),

      nextTourStep: () =>
        set((state) => ({
          tourStep: state.tourStep + 1,
        })),

      prevTourStep: () =>
        set((state) => ({
          tourStep: Math.max(state.tourStep - 1, 0),
        })),

      completeTour: () =>
        set({
          tourCompleted: true,
          tourActive: false,
          tourStep: 0,
        }),

      stopTour: () =>
        set({
          tourActive: false,
          tourStep: 0,
        }),

      dismissHint: (hintId) =>
        set((state) => ({
          dismissedHints: state.dismissedHints.includes(hintId)
            ? state.dismissedHints
            : [...state.dismissedHints, hintId],
        })),

      dismissAllHints: (allHintIds?: string[]) =>
        set((state) => ({
          dismissedHints: allHintIds ?? state.dismissedHints,
        })),

      resetHints: () =>
        set({ dismissedHints: [] }),

      setHintsEnabled: (hintsEnabled) =>
        set({ hintsEnabled }),
    }),
    {
      name: 'cognia-onboarding',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;

        if (version < 1) {
          if (!('tourCompleted' in state)) state.tourCompleted = false;
          if (!('visitedSteps' in state)) state.visitedSteps = [];
          if (!('version' in state)) state.version = 1;
        }

        if (version < 2) {
          if (!('dismissedHints' in state)) state.dismissedHints = [];
          if (!('hintsEnabled' in state)) state.hintsEnabled = true;
          state.version = 2;
        }

        if (version < 3) {
          if (!('mode' in state)) state.mode = null;

          const completed = Boolean(state.completed);
          const skipped = Boolean(state.skipped);
          if (!completed && !skipped) {
            state.currentStep = 0;
            state.visitedSteps = [];
          }

          state.version = 3;
        }

        return state as unknown as OnboardingState;
      },
      partialize: (state) => ({
        mode: state.mode,
        completed: state.completed,
        skipped: state.skipped,
        currentStep: state.currentStep,
        visitedSteps: state.visitedSteps,
        tourCompleted: state.tourCompleted,
        dismissedHints: state.dismissedHints,
        hintsEnabled: state.hintsEnabled,
        version: state.version,
      }),
    },
  ),
);
