import {
  useOnboardingStore,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_SEQUENCES,
  getOnboardingSteps,
} from './onboarding';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    const state = useOnboardingStore.getState();
    state.resetOnboarding();
    useOnboardingStore.getState().setWizardOpen(false);
    localStorage.clear();
  });

  describe('session defaults', () => {
    it('starts with resumable onboarding model fields', () => {
      const state = useOnboardingStore.getState();
      expect(state.mode).toBeNull();
      expect(state.completed).toBe(false);
      expect(state.skipped).toBe(false);
      expect(state.sessionState).toBe('active');
      expect(state.canResume).toBe(false);
      expect(state.sessionSummary.mode).toBeNull();
      expect(state.sessionSummary.mirrorPreset).toBe('default');
    });
  });

  describe('wizard navigation', () => {
    it('does not advance before mode selection', () => {
      useOnboardingStore.getState().nextStep();
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toEqual([]);
    });

    it('tracks last active step while navigating', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('quick');
      store.nextStep();
      store.nextStep();

      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(2);
      expect(state.lastActiveStepId).toBe(ONBOARDING_STEP_SEQUENCES.quick[2]);
      expect(state.sessionState).toBe('active');
    });

    it('goToStep clamps within active sequence', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('quick');
      store.goToStep(999);
      expect(useOnboardingStore.getState().currentStep).toBe(ONBOARDING_STEP_SEQUENCES.quick.length - 1);
    });
  });

  describe('close vs skip semantics', () => {
    it('pauseOnboarding closes wizard without marking skip', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('quick');
      store.nextStep();
      store.setWizardOpen(true);

      store.pauseOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.wizardOpen).toBe(false);
      expect(state.skipped).toBe(false);
      expect(state.sessionState).toBe('paused');
      expect(state.canResume).toBe(true);
      expect(state.lastActiveStepId).toBe('language');
    });

    it('resumeOnboarding restores paused session step', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('quick');
      store.goToStep(3);
      store.pauseOnboarding('environment-detection');

      store.resumeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.wizardOpen).toBe(true);
      expect(state.currentStep).toBe(3);
      expect(state.sessionState).toBe('active');
      expect(state.canResume).toBe(false);
    });

    it('skipOnboarding remains explicit and final', () => {
      const store = useOnboardingStore.getState();
      store.setWizardOpen(true);
      store.skipOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.skipped).toBe(true);
      expect(state.completed).toBe(false);
      expect(state.sessionState).toBe('skipped');
      expect(state.canResume).toBe(false);
    });
  });

  describe('summary updates', () => {
    it('merges summary fields and deduplicates environments', () => {
      const store = useOnboardingStore.getState();
      store.updateSessionSummary({
        locale: 'en',
        manageableEnvironments: ['node', 'node', 'python'],
      });

      const state = useOnboardingStore.getState();
      expect(state.sessionSummary.locale).toBe('en');
      expect(state.sessionSummary.manageableEnvironments).toEqual(['node', 'python']);
      expect(state.sessionSummary.primaryEnvironment).toBe('node');
    });
  });

  describe('complete and reset', () => {
    it('completeOnboarding closes wizard and marks completed', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('quick');
      store.setWizardOpen(true);
      store.completeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(true);
      expect(state.skipped).toBe(false);
      expect(state.sessionState).toBe('completed');
      expect(state.wizardOpen).toBe(false);
      expect(state.currentStep).toBe(ONBOARDING_STEP_SEQUENCES.quick.length - 1);
    });

    it('resetOnboarding starts a new active session', () => {
      const store = useOnboardingStore.getState();
      store.selectMode('detailed');
      store.completeOnboarding();
      store.resetOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.mode).toBeNull();
      expect(state.completed).toBe(false);
      expect(state.skipped).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.sessionState).toBe('active');
      expect(state.sessionSummary.mode).toBeNull();
      expect(state.wizardOpen).toBe(true);
    });
  });

  describe('guided tour and hints', () => {
    it('tour lifecycle remains unchanged', () => {
      const store = useOnboardingStore.getState();
      store.startTour();
      store.nextTourStep();
      store.completeTour();

      const state = useOnboardingStore.getState();
      expect(state.tourCompleted).toBe(true);
      expect(state.tourActive).toBe(false);
      expect(state.tourStep).toBe(0);
    });

    it('hint controls still work', () => {
      const store = useOnboardingStore.getState();
      store.dismissHint('test-hint');
      store.setHintsEnabled(false);

      const state = useOnboardingStore.getState();
      expect(state.dismissedHints).toEqual(['test-hint']);
      expect(state.hintsEnabled).toBe(false);
    });
  });

  describe('persist migration', () => {
    const getPersistConfig = () =>
      (useOnboardingStore as unknown as {
        persist: {
          getOptions: () => {
            migrate: (state: unknown, version: number) => unknown;
          };
        };
      }).persist.getOptions();

    it('v0 -> v4 migrates legacy completed payload', () => {
      const v0State = { completed: true, skipped: false, currentStep: 3 };
      const migrated = getPersistConfig().migrate(v0State, 0) as Record<string, unknown>;

      expect(migrated.version).toBe(4);
      expect(migrated.sessionState).toBe('completed');
      expect(migrated.canResume).toBe(false);
      expect(migrated.lastActiveStepId).toBe('mode-selection');
      expect((migrated.sessionSummary as Record<string, unknown>).mode).toBeNull();
    });

    it('v2 -> v4 migrates unfinished payload to paused resumable session', () => {
      const v2State = {
        completed: false,
        skipped: false,
        currentStep: 4,
        visitedSteps: ['welcome', 'language'],
        dismissedHints: ['h1'],
        hintsEnabled: false,
        mode: 'quick',
        version: 2,
      };
      const migrated = getPersistConfig().migrate(v2State, 2) as Record<string, unknown>;

      expect(migrated.version).toBe(4);
      expect(migrated.sessionState).toBe('paused');
      expect(migrated.canResume).toBe(true);
      expect(migrated.currentStep).toBe(0);
      expect(migrated.lastActiveStepId).toBe('mode-selection');
      expect(migrated.dismissedHints).toEqual(['h1']);
      expect(migrated.hintsEnabled).toBe(false);
      expect((migrated.sessionSummary as Record<string, unknown>).mode).toBe('quick');
    });

    it('v4 keeps existing session fields', () => {
      const v4State = {
        mode: 'quick',
        sessionState: 'paused',
        canResume: true,
        lastActiveStepId: 'theme',
        sessionSummary: { mode: 'quick' },
        version: 4,
      };
      const migrated = getPersistConfig().migrate(v4State, 4) as Record<string, unknown>;

      expect(migrated.sessionState).toBe('paused');
      expect(migrated.canResume).toBe(true);
      expect(migrated.lastActiveStepId).toBe('theme');
    });
  });

  describe('step definitions', () => {
    it('keeps detailed step order', () => {
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

    it('returns mode-specific step arrays', () => {
      expect(getOnboardingSteps(null)).toEqual(['mode-selection']);
      expect(getOnboardingSteps('quick')).toEqual(ONBOARDING_STEP_SEQUENCES.quick);
      expect(getOnboardingSteps('detailed')).toEqual(ONBOARDING_STEP_SEQUENCES.detailed);
    });
  });
});
