import {
  buildOnboardingNextActions,
  getOnboardingSurfaceState,
  type OnboardingSurfaceSnapshot,
} from './onboarding-surface';

const baseSnapshot: OnboardingSurfaceSnapshot = {
  mode: 'quick',
  completed: false,
  skipped: false,
  sessionState: 'idle',
  canResume: false,
  tourCompleted: false,
  sessionSummary: {
    mode: 'quick',
    locale: 'en',
    theme: 'dark',
    mirrorPreset: 'default',
    detectedCount: 1,
    primaryEnvironment: 'node',
    manageableEnvironments: ['node'],
    shellType: 'powershell',
    shellConfigured: true,
  },
};

describe('onboarding-surface helpers', () => {
  it('builds shared completion actions in canonical order', () => {
    expect(
      buildOnboardingNextActions(baseSnapshot.sessionSummary, false).map((action) => action.id),
    ).toEqual([
      'manage-primary-environment',
      'start-guided-tour',
      'review-settings',
    ]);
  });

  it('drops the tour action after the guided tour is completed', () => {
    expect(
      buildOnboardingNextActions(baseSnapshot.sessionSummary, true).map((action) => action.id),
    ).toEqual([
      'manage-primary-environment',
      'review-settings',
    ]);
  });

  it('exposes resume without start-tour for a paused resumable session', () => {
    expect(
      getOnboardingSurfaceState({
        ...baseSnapshot,
        sessionState: 'paused',
        canResume: true,
      }),
    ).toMatchObject({
      hasBeenThrough: true,
      showResumeAction: true,
      showStartTourAction: false,
      statusKey: 'settings.onboardingStatusPaused',
      showResumableStatus: true,
    });
  });

  it('exposes start-tour for completed and skipped sessions only', () => {
    expect(
      getOnboardingSurfaceState({
        ...baseSnapshot,
        completed: true,
        sessionState: 'completed',
      }).showStartTourAction,
    ).toBe(true);

    expect(
      getOnboardingSurfaceState({
        ...baseSnapshot,
        skipped: true,
        sessionState: 'skipped',
      }).showStartTourAction,
    ).toBe(true);

    expect(
      getOnboardingSurfaceState(baseSnapshot).showStartTourAction,
    ).toBe(false);
  });
});
