import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type OnboardingStepId =
  | 'welcome'
  | 'language'
  | 'theme'
  | 'environment-detection'
  | 'mirrors'
  | 'shell-init'
  | 'complete';

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  'welcome',
  'language',
  'theme',
  'environment-detection',
  'mirrors',
  'shell-init',
  'complete',
];

export interface OnboardingState {
  /** Whether the onboarding wizard has ever been completed */
  completed: boolean;
  /** Whether onboarding was explicitly skipped */
  skipped: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Set of step IDs that have been visited */
  visitedSteps: string[];
  /** Whether the wizard dialog is currently open */
  wizardOpen: boolean;
  /** Whether the guided tour has been completed */
  tourCompleted: boolean;
  /** Whether the guided tour is currently active */
  tourActive: boolean;
  /** Current tour step index */
  tourStep: number;
  /** Store version for migrations */
  version: number;
  /** IDs of bubble hints the user has dismissed */
  dismissedHints: string[];
  /** Whether contextual bubble hints are enabled */
  hintsEnabled: boolean;

  // Actions
  setWizardOpen: (open: boolean) => void;
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
      completed: false,
      skipped: false,
      currentStep: 0,
      visitedSteps: [],
      wizardOpen: false,
      tourCompleted: false,
      tourActive: false,
      tourStep: 0,
      version: 2,
      dismissedHints: [],
      hintsEnabled: true,

      setWizardOpen: (wizardOpen) => set({ wizardOpen }),

      goToStep: (step) =>
        set((state) => {
          const stepId = ONBOARDING_STEPS[step];
          const visitedSteps = stepId && !state.visitedSteps.includes(stepId)
            ? [...state.visitedSteps, stepId]
            : state.visitedSteps;
          return { currentStep: step, visitedSteps };
        }),

      nextStep: () =>
        set((state) => {
          const next = Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1);
          const stepId = ONBOARDING_STEPS[next];
          const visitedSteps = stepId && !state.visitedSteps.includes(stepId)
            ? [...state.visitedSteps, stepId]
            : state.visitedSteps;
          return { currentStep: next, visitedSteps };
        }),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),

      markStepVisited: (stepId) =>
        set((state) => ({
          visitedSteps: state.visitedSteps.includes(stepId)
            ? state.visitedSteps
            : [...state.visitedSteps, stepId],
        })),

      completeOnboarding: () =>
        set({
          completed: true,
          skipped: false,
          wizardOpen: false,
          currentStep: ONBOARDING_STEPS.length - 1,
        }),

      skipOnboarding: () =>
        set({
          skipped: true,
          wizardOpen: false,
        }),

      resetOnboarding: () =>
        set({
          completed: false,
          skipped: false,
          currentStep: 0,
          visitedSteps: [],
          wizardOpen: true,
          tourCompleted: false,
        }),

      startTour: () =>
        set({
          tourActive: true,
          tourStep: 0,
        }),

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
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 1) {
          // v0 → v1: ensure all fields exist
          if (!('tourCompleted' in state)) state.tourCompleted = false;
          if (!('visitedSteps' in state)) state.visitedSteps = [];
          if (!('version' in state)) state.version = 1;
        }
        if (version < 2) {
          // v1 → v2: add bubble hint fields
          if (!('dismissedHints' in state)) state.dismissedHints = [];
          if (!('hintsEnabled' in state)) state.hintsEnabled = true;
          state.version = 2;
        }
        return state as unknown as OnboardingState;
      },
      partialize: (state) => ({
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
