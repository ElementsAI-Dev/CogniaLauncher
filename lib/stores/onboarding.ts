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

export type OnboardingSessionState =
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'skipped';

export interface OnboardingSessionSummary {
  mode: OnboardingMode | null;
  locale: string | null;
  theme: string | null;
  mirrorPreset: string | null;
  detectedCount: number;
  primaryEnvironment: string | null;
  manageableEnvironments: string[];
  shellType: string | null;
  shellConfigured: boolean | null;
}

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

function buildDefaultSessionSummary(mode: OnboardingMode | null): OnboardingSessionSummary {
  return {
    mode,
    locale: null,
    theme: null,
    mirrorPreset: 'default',
    detectedCount: 0,
    primaryEnvironment: null,
    manageableEnvironments: [],
    shellType: null,
    shellConfigured: null,
  };
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

function normalizeOnboardingMode(mode: unknown): OnboardingMode | null {
  return mode === 'quick' || mode === 'detailed' ? mode : null;
}

function normalizeSessionSummary(
  rawSummary: unknown,
  mode: OnboardingMode | null,
): OnboardingSessionSummary {
  const defaults = buildDefaultSessionSummary(mode);
  if (!rawSummary || typeof rawSummary !== 'object') {
    return defaults;
  }

  const summary = rawSummary as Record<string, unknown>;
  const manageableEnvironments = Array.isArray(summary.manageableEnvironments)
    ? Array.from(new Set(summary.manageableEnvironments.filter((env): env is string => typeof env === 'string' && env.length > 0)))
    : defaults.manageableEnvironments;

  const primaryEnvironment = typeof summary.primaryEnvironment === 'string'
    ? summary.primaryEnvironment
    : manageableEnvironments[0] ?? null;

  return {
    mode,
    locale: typeof summary.locale === 'string' ? summary.locale : defaults.locale,
    theme: typeof summary.theme === 'string' ? summary.theme : defaults.theme,
    mirrorPreset: typeof summary.mirrorPreset === 'string' ? summary.mirrorPreset : defaults.mirrorPreset,
    detectedCount: typeof summary.detectedCount === 'number' ? Math.max(0, summary.detectedCount) : defaults.detectedCount,
    primaryEnvironment,
    manageableEnvironments,
    shellType: typeof summary.shellType === 'string' ? summary.shellType : defaults.shellType,
    shellConfigured:
      typeof summary.shellConfigured === 'boolean'
        ? summary.shellConfigured
        : defaults.shellConfigured,
  };
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
  sessionState: OnboardingSessionState;
  lastActiveStepId: OnboardingStepId | null;
  lastActiveAt: number | null;
  canResume: boolean;
  sessionSummary: OnboardingSessionSummary;
  dismissedHints: string[];
  hintsEnabled: boolean;
  setWizardOpen: (open: boolean) => void;
  selectMode: (mode: OnboardingMode) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepVisited: (stepId: string) => void;
  pauseOnboarding: (stepId?: OnboardingStepId) => void;
  resumeOnboarding: () => void;
  updateSessionSummary: (summary: Partial<OnboardingSessionSummary>) => void;
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
      version: 4,
      sessionState: 'idle',
      lastActiveStepId: null,
      lastActiveAt: null,
      canResume: false,
      sessionSummary: buildDefaultSessionSummary(null),
      dismissedHints: [],
      hintsEnabled: true,

      setWizardOpen: (wizardOpen) =>
        set((state) => ({
          wizardOpen,
          sessionState:
            wizardOpen && !state.completed && !state.skipped
              ? 'active'
              : state.sessionState,
        })),

      selectMode: (mode) =>
        set((state) => {
          if (state.mode === mode) {
            const now = Date.now();
            return {
              mode,
              visitedSteps: addVisitedStep(state.visitedSteps, 'mode-selection'),
              sessionState: 'active' as OnboardingSessionState,
              canResume: false,
              lastActiveStepId: 'mode-selection' as OnboardingStepId,
              lastActiveAt: now,
              sessionSummary: {
                ...state.sessionSummary,
                mode,
              },
            };
          }

          const now = Date.now();
          return {
            mode,
            currentStep: 0,
            visitedSteps: ['mode-selection'],
            sessionState: 'active' as OnboardingSessionState,
            canResume: false,
            lastActiveStepId: 'mode-selection' as OnboardingStepId,
            lastActiveAt: now,
            sessionSummary: {
              ...state.sessionSummary,
              mode,
            },
          };
        }),

      goToStep: (step) =>
        set((state) => {
          const steps = getOnboardingSteps(state.mode);
          const nextStep = clampStepIndex(step, steps);
          const stepId = steps[nextStep];
          const now = Date.now();

          return {
            currentStep: nextStep,
            visitedSteps: addVisitedStep(state.visitedSteps, stepId),
            lastActiveStepId: stepId,
            lastActiveAt: now,
            sessionState:
              state.completed || state.skipped
                ? state.sessionState
                : ('active' as OnboardingSessionState),
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
          const now = Date.now();

          return {
            currentStep: nextStep,
            visitedSteps: addVisitedStep(state.visitedSteps, stepId),
            lastActiveStepId: stepId,
            lastActiveAt: now,
            sessionState: 'active' as OnboardingSessionState,
          };
        }),

      prevStep: () =>
        set((state) => {
          const steps = getOnboardingSteps(state.mode);
          const nextStep = clampStepIndex(state.currentStep - 1, steps);
          const stepId = steps[nextStep] ?? state.lastActiveStepId;
          return {
            currentStep: nextStep,
            lastActiveStepId: stepId,
            lastActiveAt: Date.now(),
            sessionState:
              state.completed || state.skipped
                ? state.sessionState
                : ('active' as OnboardingSessionState),
          };
        }),

      markStepVisited: (stepId) =>
        set((state) => ({
          visitedSteps: addVisitedStep(state.visitedSteps, stepId),
          lastActiveStepId:
            (getOnboardingSteps(state.mode).includes(stepId as OnboardingStepId)
              ? (stepId as OnboardingStepId)
              : state.lastActiveStepId),
          lastActiveAt: Date.now(),
        })),

      pauseOnboarding: (stepId) =>
        set((state) => {
          if (state.completed || state.skipped) {
            return {
              wizardOpen: false,
            };
          }

          const steps = getOnboardingSteps(state.mode);
          const resolvedStepId =
            stepId
            ?? steps[clampStepIndex(state.currentStep, steps)]
            ?? state.lastActiveStepId
            ?? 'mode-selection';

          return {
            wizardOpen: false,
            sessionState: 'paused' as OnboardingSessionState,
            canResume: true,
            lastActiveStepId: resolvedStepId,
            lastActiveAt: Date.now(),
          };
        }),

      resumeOnboarding: () =>
        set((state) => {
          if (state.completed || state.skipped) {
            return state;
          }

          const steps = getOnboardingSteps(state.mode);
          const indexedStep = state.lastActiveStepId
            ? steps.indexOf(state.lastActiveStepId)
            : -1;
          const nextStep = indexedStep >= 0
            ? indexedStep
            : clampStepIndex(state.currentStep, steps);
          const stepId = steps[nextStep] ?? 'mode-selection';

          return {
            wizardOpen: true,
            currentStep: nextStep,
            visitedSteps: addVisitedStep(state.visitedSteps, stepId),
            sessionState: 'active' as OnboardingSessionState,
            canResume: false,
            lastActiveStepId: stepId,
            lastActiveAt: Date.now(),
          };
        }),

      updateSessionSummary: (summary) =>
        set((state) => {
          const merged = {
            ...state.sessionSummary,
            ...summary,
            mode: summary.mode ?? state.sessionSummary.mode ?? state.mode,
          };

          const manageableEnvironments = Array.isArray(merged.manageableEnvironments)
            ? Array.from(new Set(merged.manageableEnvironments.filter(Boolean)))
            : [];
          const primaryEnvironment = merged.primaryEnvironment
            ?? manageableEnvironments[0]
            ?? null;

          return {
            sessionSummary: {
              ...merged,
              manageableEnvironments,
              primaryEnvironment,
            },
          };
        }),

      completeOnboarding: () =>
        set((state) => ({
          completed: true,
          skipped: false,
          wizardOpen: false,
          currentStep: getOnboardingSteps(state.mode).length - 1,
          sessionState: 'completed',
          canResume: false,
          lastActiveStepId:
            getOnboardingSteps(state.mode)[getOnboardingSteps(state.mode).length - 1]
            ?? state.lastActiveStepId,
          lastActiveAt: Date.now(),
          sessionSummary: {
            ...state.sessionSummary,
            mode: state.mode,
          },
        })),

      skipOnboarding: () =>
        set((state) => ({
          skipped: true,
          completed: false,
          wizardOpen: false,
          sessionState: 'skipped',
          canResume: false,
          lastActiveStepId:
            getOnboardingSteps(state.mode)[clampStepIndex(state.currentStep, getOnboardingSteps(state.mode))]
            ?? state.lastActiveStepId,
          lastActiveAt: Date.now(),
        })),

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
          sessionState: 'active',
          canResume: false,
          lastActiveStepId: 'mode-selection',
          lastActiveAt: Date.now(),
          sessionSummary: buildDefaultSessionSummary(null),
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
      version: 4,
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

        if (version < 4) {
          const mode = normalizeOnboardingMode(state.mode);
          const steps = getOnboardingSteps(mode);
          const currentStep = clampStepIndex(
            typeof state.currentStep === 'number' ? state.currentStep : 0,
            steps,
          );
          const completed = Boolean(state.completed);
          const skipped = Boolean(state.skipped);
          const defaultStepId = steps[currentStep] ?? 'mode-selection';

          state.mode = mode;
          state.currentStep = currentStep;
          state.lastActiveStepId = defaultStepId;
          state.lastActiveAt = typeof state.lastActiveAt === 'number' ? state.lastActiveAt : null;
          state.sessionState = completed
            ? 'completed'
            : skipped
              ? 'skipped'
              : 'paused';
          state.canResume = !completed && !skipped;
          state.sessionSummary = normalizeSessionSummary(state.sessionSummary, mode);
          state.version = 4;
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
        sessionState: state.sessionState,
        lastActiveStepId: state.lastActiveStepId,
        lastActiveAt: state.lastActiveAt,
        canResume: state.canResume,
        sessionSummary: state.sessionSummary,
      }),
    },
  ),
);
