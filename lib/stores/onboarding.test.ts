import {
  useOnboardingStore,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_SEQUENCES,
  getOnboardingSteps,
} from './onboarding';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const state = useOnboardingStore.getState();
    state.resetOnboarding();
    // After reset, wizardOpen is true — close it for clean state
    useOnboardingStore.getState().setWizardOpen(false);
    localStorage.clear();
  });

  describe('initial state', () => {
    it('has mode as null', () => {
      expect(useOnboardingStore.getState().mode).toBeNull();
    });

    it('has completed as false', () => {
      expect(useOnboardingStore.getState().completed).toBe(false);
    });

    it('has skipped as false', () => {
      expect(useOnboardingStore.getState().skipped).toBe(false);
    });

    it('has currentStep as 0', () => {
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it('has empty visitedSteps', () => {
      expect(useOnboardingStore.getState().visitedSteps).toEqual([]);
    });

    it('has tourCompleted as false', () => {
      expect(useOnboardingStore.getState().tourCompleted).toBe(false);
    });

    it('has tourActive as false', () => {
      expect(useOnboardingStore.getState().tourActive).toBe(false);
    });
  });

  describe('wizard navigation', () => {
    it('does not advance before a mode is selected', () => {
      useOnboardingStore.getState().nextStep();
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toEqual([]);
    });

    it('nextStep advances currentStep and marks visited', () => {
      useOnboardingStore.getState().selectMode('quick');
      useOnboardingStore.getState().nextStep();
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(1);
      expect(state.visitedSteps).toContain(ONBOARDING_STEP_SEQUENCES.quick[1]);
    });

    it('prevStep decrements currentStep', () => {
      useOnboardingStore.getState().selectMode('quick');
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it('prevStep does not go below 0', () => {
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it('nextStep does not exceed max step', () => {
      useOnboardingStore.getState().selectMode('quick');
      const maxStep = ONBOARDING_STEP_SEQUENCES.quick.length - 1;
      for (let i = 0; i < ONBOARDING_STEP_SEQUENCES.quick.length + 5; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(maxStep);
    });

    it('goToStep sets currentStep and marks visited', () => {
      useOnboardingStore.getState().selectMode('detailed');
      useOnboardingStore.getState().goToStep(3);
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(3);
      expect(state.visitedSteps).toContain(ONBOARDING_STEP_SEQUENCES.detailed[3]);
    });

    it('does not duplicate visitedSteps', () => {
      useOnboardingStore.getState().selectMode('detailed');
      useOnboardingStore.getState().goToStep(2);
      useOnboardingStore.getState().goToStep(2);
      const visited = useOnboardingStore.getState().visitedSteps.filter(
        (s) => s === ONBOARDING_STEP_SEQUENCES.detailed[2]
      );
      expect(visited.length).toBe(1);
    });
  });

  describe('mode selection', () => {
    it('stores the selected mode without advancing the wizard', () => {
      useOnboardingStore.getState().selectMode('detailed');
      const state = useOnboardingStore.getState();

      expect(state.mode).toBe('detailed');
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toContain('mode-selection');
    });

    it('switching mode resets step progress to mode selection', () => {
      useOnboardingStore.getState().selectMode('detailed');
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();

      useOnboardingStore.getState().selectMode('quick');
      const state = useOnboardingStore.getState();

      expect(state.mode).toBe('quick');
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toEqual(['mode-selection']);
    });
  });

  describe('wizard dialog', () => {
    it('setWizardOpen toggles wizardOpen', () => {
      useOnboardingStore.getState().setWizardOpen(true);
      expect(useOnboardingStore.getState().wizardOpen).toBe(true);
      useOnboardingStore.getState().setWizardOpen(false);
      expect(useOnboardingStore.getState().wizardOpen).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('sets completed to true and closes wizard', () => {
      useOnboardingStore.getState().selectMode('quick');
      useOnboardingStore.getState().setWizardOpen(true);
      useOnboardingStore.getState().completeOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(true);
      expect(state.skipped).toBe(false);
      expect(state.wizardOpen).toBe(false);
      expect(state.currentStep).toBe(ONBOARDING_STEP_SEQUENCES.quick.length - 1);
    });
  });

  describe('skipOnboarding', () => {
    it('sets skipped to true and closes wizard', () => {
      useOnboardingStore.getState().setWizardOpen(true);
      useOnboardingStore.getState().skipOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.skipped).toBe(true);
      expect(state.wizardOpen).toBe(false);
    });
  });

  describe('resetOnboarding', () => {
    it('resets all wizard state and opens wizard', () => {
      useOnboardingStore.getState().selectMode('detailed');
      useOnboardingStore.getState().completeOnboarding();
      useOnboardingStore.getState().resetOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.mode).toBeNull();
      expect(state.completed).toBe(false);
      expect(state.skipped).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toEqual([]);
      expect(state.wizardOpen).toBe(true);
      expect(state.tourCompleted).toBe(false);
      expect(state.tourActive).toBe(false);
      expect(state.tourStep).toBe(0);
    });
  });

  describe('guided tour', () => {
    it('startTour activates tour at step 0', () => {
      useOnboardingStore.getState().startTour();
      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(true);
      expect(state.tourStep).toBe(0);
    });

    it('nextTourStep advances tour step', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().nextTourStep();
      expect(useOnboardingStore.getState().tourStep).toBe(1);
    });

    it('prevTourStep decrements tour step', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().nextTourStep();
      useOnboardingStore.getState().nextTourStep();
      useOnboardingStore.getState().prevTourStep();
      expect(useOnboardingStore.getState().tourStep).toBe(1);
    });

    it('prevTourStep does not go below 0', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().prevTourStep();
      expect(useOnboardingStore.getState().tourStep).toBe(0);
    });

    it('completeTour sets tourCompleted and deactivates', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().completeTour();
      const state = useOnboardingStore.getState();
      expect(state.tourCompleted).toBe(true);
      expect(state.tourActive).toBe(false);
      expect(state.tourStep).toBe(0);
    });

    it('stopTour deactivates without completing', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().nextTourStep();
      useOnboardingStore.getState().stopTour();
      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(false);
      expect(state.tourCompleted).toBe(false);
      expect(state.tourStep).toBe(0);
    });

    it('startTour is idempotent while already active', () => {
      useOnboardingStore.getState().startTour();
      useOnboardingStore.getState().nextTourStep();
      useOnboardingStore.getState().startTour();
      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(true);
      expect(state.tourStep).toBe(1);
    });
  });

  describe('markStepVisited', () => {
    it('adds step ID to visitedSteps', () => {
      useOnboardingStore.getState().markStepVisited('language');
      expect(useOnboardingStore.getState().visitedSteps).toContain('language');
    });

    it('does not duplicate step IDs', () => {
      useOnboardingStore.getState().markStepVisited('language');
      useOnboardingStore.getState().markStepVisited('language');
      const count = useOnboardingStore.getState().visitedSteps.filter(
        (s) => s === 'language'
      ).length;
      expect(count).toBe(1);
    });
  });

  describe('bubble hints', () => {
    it('has hintsEnabled true by default', () => {
      expect(useOnboardingStore.getState().hintsEnabled).toBe(true);
    });

    it('has empty dismissedHints by default', () => {
      expect(useOnboardingStore.getState().dismissedHints).toEqual([]);
    });

    it('dismissHint adds hint ID to dismissedHints', () => {
      useOnboardingStore.getState().dismissHint('test-hint');
      expect(useOnboardingStore.getState().dismissedHints).toContain('test-hint');
    });

    it('dismissHint does not duplicate IDs', () => {
      useOnboardingStore.getState().dismissHint('test-hint');
      useOnboardingStore.getState().dismissHint('test-hint');
      const count = useOnboardingStore.getState().dismissedHints.filter(
        (id) => id === 'test-hint'
      ).length;
      expect(count).toBe(1);
    });

    it('dismissAllHints sets all provided IDs', () => {
      useOnboardingStore.getState().dismissAllHints(['a', 'b', 'c']);
      expect(useOnboardingStore.getState().dismissedHints).toEqual(['a', 'b', 'c']);
    });

    it('resetHints clears dismissedHints', () => {
      useOnboardingStore.getState().dismissHint('test-hint');
      useOnboardingStore.getState().resetHints();
      expect(useOnboardingStore.getState().dismissedHints).toEqual([]);
    });

    it('setHintsEnabled toggles hintsEnabled', () => {
      useOnboardingStore.getState().setHintsEnabled(false);
      expect(useOnboardingStore.getState().hintsEnabled).toBe(false);
      useOnboardingStore.getState().setHintsEnabled(true);
      expect(useOnboardingStore.getState().hintsEnabled).toBe(true);
    });

    it('resetOnboarding does not clear dismissedHints', () => {
      useOnboardingStore.getState().dismissHint('kept-hint');
      useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().dismissedHints).toContain('kept-hint');
    });

    it('dismissAllHints without args keeps existing hints', () => {
      // Ensure clean slate
      useOnboardingStore.getState().resetHints();
      useOnboardingStore.getState().dismissHint('hint-a');
      useOnboardingStore.getState().dismissHint('hint-b');
      useOnboardingStore.getState().dismissAllHints();
      // Without args, dismissedHints should remain as-is (state.dismissedHints)
      expect(useOnboardingStore.getState().dismissedHints).toEqual(['hint-a', 'hint-b']);
    });

    it('dismissAllHints with empty array clears all', () => {
      useOnboardingStore.getState().dismissHint('hint-a');
      useOnboardingStore.getState().dismissAllHints([]);
      expect(useOnboardingStore.getState().dismissedHints).toEqual([]);
    });
  });

  describe('persist migration', () => {
    const getPersistConfig = () =>
      (useOnboardingStore as unknown as { persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } } }).persist.getOptions();

    it('v0 → v3: adds onboarding mode, tourCompleted, visitedSteps, dismissedHints, hintsEnabled', () => {
      const v0State = { completed: true, skipped: false, currentStep: 3 };
      const migrated = getPersistConfig().migrate(v0State, 0) as Record<string, unknown>;

      expect(migrated.mode).toBeNull();
      expect(migrated.tourCompleted).toBe(false);
      expect(migrated.visitedSteps).toEqual([]);
      expect(migrated.dismissedHints).toEqual([]);
      expect(migrated.hintsEnabled).toBe(true);
      expect(migrated.version).toBe(3);
      // Preserves existing
      expect(migrated.completed).toBe(true);
    });

    it('v1 → v3: adds bubble hint fields and onboarding mode', () => {
      const v1State = { completed: false, tourCompleted: true, visitedSteps: ['welcome'], version: 1 };
      const migrated = getPersistConfig().migrate(v1State, 1) as Record<string, unknown>;

      expect(migrated.mode).toBeNull();
      expect(migrated.dismissedHints).toEqual([]);
      expect(migrated.hintsEnabled).toBe(true);
      expect(migrated.version).toBe(3);
      // Resets unfinished pre-mode progress back to mode selection
      expect(migrated.tourCompleted).toBe(true);
      expect(migrated.visitedSteps).toEqual([]);
    });

    it('v2 → v3 resets unfinished progress back to mode selection', () => {
      const v2State = {
        completed: false,
        skipped: false,
        currentStep: 4,
        visitedSteps: ['welcome', 'language'],
        dismissedHints: ['h1'],
        hintsEnabled: false,
        version: 2,
      };
      const migrated = getPersistConfig().migrate(v2State, 2) as Record<string, unknown>;

      expect(migrated.mode).toBeNull();
      expect(migrated.currentStep).toBe(0);
      expect(migrated.visitedSteps).toEqual([]);
      expect(migrated.dismissedHints).toEqual(['h1']);
      expect(migrated.hintsEnabled).toBe(false);
      expect(migrated.version).toBe(3);
    });

    it('v3: no migration needed', () => {
      const v3State = { mode: 'quick', dismissedHints: ['h1'], hintsEnabled: false, version: 3 };
      const migrated = getPersistConfig().migrate(v3State, 3) as Record<string, unknown>;

      expect(migrated.mode).toBe('quick');
      expect(migrated.dismissedHints).toEqual(['h1']);
      expect(migrated.hintsEnabled).toBe(false);
    });
  });

  describe('step definitions', () => {
    it('has correct default detailed step order', () => {
      expect(ONBOARDING_STEPS).toEqual([
        'mode-selection',
        'welcome',
        'language',
        'theme',
        'environment-detection',
        'mirrors',
        'shell-init',
        'complete',
      ]);
    });

    it('derives quick and detailed steps from the selected mode', () => {
      expect(getOnboardingSteps(null)).toEqual(['mode-selection']);
      expect(getOnboardingSteps('quick')).toEqual(ONBOARDING_STEP_SEQUENCES.quick);
      expect(getOnboardingSteps('detailed')).toEqual(ONBOARDING_STEP_SEQUENCES.detailed);
    });

    it('uses a shorter quick sequence than detailed mode', () => {
      expect(ONBOARDING_STEP_SEQUENCES.quick.length).toBe(7);
      expect(ONBOARDING_STEP_SEQUENCES.detailed.length).toBe(8);
      expect(ONBOARDING_STEP_SEQUENCES.quick).not.toContain('welcome');
    });
  });
});
