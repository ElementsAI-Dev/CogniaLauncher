import { useOnboardingStore, ONBOARDING_STEPS } from '../onboarding';

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
    it('nextStep advances currentStep and marks visited', () => {
      useOnboardingStore.getState().nextStep();
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(1);
      expect(state.visitedSteps).toContain(ONBOARDING_STEPS[1]);
    });

    it('prevStep decrements currentStep', () => {
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
      const maxStep = ONBOARDING_STEPS.length - 1;
      for (let i = 0; i < ONBOARDING_STEPS.length + 5; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(maxStep);
    });

    it('goToStep sets currentStep and marks visited', () => {
      useOnboardingStore.getState().goToStep(3);
      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(3);
      expect(state.visitedSteps).toContain(ONBOARDING_STEPS[3]);
    });

    it('does not duplicate visitedSteps', () => {
      useOnboardingStore.getState().goToStep(2);
      useOnboardingStore.getState().goToStep(2);
      const visited = useOnboardingStore.getState().visitedSteps.filter(
        (s) => s === ONBOARDING_STEPS[2]
      );
      expect(visited.length).toBe(1);
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
      useOnboardingStore.getState().setWizardOpen(true);
      useOnboardingStore.getState().completeOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(true);
      expect(state.skipped).toBe(false);
      expect(state.wizardOpen).toBe(false);
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
      useOnboardingStore.getState().completeOnboarding();
      useOnboardingStore.getState().resetOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(false);
      expect(state.skipped).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.visitedSteps).toEqual([]);
      expect(state.wizardOpen).toBe(true);
      expect(state.tourCompleted).toBe(false);
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
});
