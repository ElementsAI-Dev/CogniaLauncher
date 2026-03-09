import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from './use-onboarding';
import {
  useOnboardingStore,
  ONBOARDING_STEP_SEQUENCES,
} from '@/lib/stores/onboarding';

beforeEach(() => {
  const state = useOnboardingStore.getState();
  state.resetOnboarding();
  useOnboardingStore.setState({
    wizardOpen: false,
    completed: false,
    skipped: false,
    mode: null,
    currentStep: 0,
    sessionState: 'idle',
    canResume: false,
    lastActiveStepId: null,
    lastActiveAt: null,
    sessionSummary: {
      mode: null,
      locale: null,
      theme: null,
      mirrorPreset: 'default',
      detectedCount: 0,
      primaryEnvironment: null,
      manageableEnvironments: [],
      shellType: null,
      shellConfigured: null,
    },
  });
});

describe('useOnboarding', () => {
  it('returns default onboarding state', () => {
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.mode).toBeNull();
    expect(result.current.sessionState).toBe('active');
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isSkipped).toBe(false);
    expect(result.current.currentStepId).toBe('mode-selection');
    expect(result.current.stepIds).toEqual(['mode-selection']);
    expect(result.current.shouldShowWizard).toBe(true);
  });

  it('computes progress for quick mode', () => {
    useOnboardingStore.setState({ mode: 'quick', currentStep: 3, sessionState: 'active', wizardOpen: true });
    const { result } = renderHook(() => useOnboarding());

    const expected = Math.round((3 / (ONBOARDING_STEP_SEQUENCES.quick.length - 1)) * 100);
    expect(result.current.progress).toBe(expected);
  });

  it('pauses wizard on close without marking skip', () => {
    useOnboardingStore.setState({ mode: 'quick', wizardOpen: true, currentStep: 2, sessionState: 'active' });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.closeWizard();
    });

    expect(result.current.shouldShowWizard).toBe(false);
    expect(result.current.isSkipped).toBe(false);
    expect(result.current.sessionState).toBe('paused');
    expect(result.current.canResume).toBe(true);
  });

  it('resumes from the paused step when manually reopened', () => {
    useOnboardingStore.setState({ mode: 'quick', currentStep: 3, wizardOpen: true, sessionState: 'active' });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.closeWizard();
    });

    act(() => {
      result.current.openWizard();
    });

    expect(result.current.shouldShowWizard).toBe(true);
    expect(result.current.currentStep).toBe(3);
    expect(result.current.sessionState).toBe('active');
  });

  it('keeps skip as explicit user action', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.skip();
    });

    expect(result.current.isSkipped).toBe(true);
    expect(result.current.sessionState).toBe('skipped');
    expect(result.current.shouldShowWizard).toBe(false);
  });

  it('updates session summary via updateSummary', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.updateSummary({ locale: 'zh', theme: 'dark' });
    });

    expect(result.current.sessionSummary.locale).toBe('zh');
    expect(result.current.sessionSummary.theme).toBe('dark');
  });

  it('builds contextual completion actions from summary', () => {
    useOnboardingStore.setState({
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
    });

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.nextActions.map((a) => a.id)).toEqual([
      'manage-primary-environment',
      'start-guided-tour',
      'review-settings',
    ]);
  });

  it('navigates next and previous steps', () => {
    useOnboardingStore.setState({ mode: 'quick', currentStep: 0, sessionState: 'active', wizardOpen: true });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.next();
    });
    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.prev();
    });
    expect(result.current.currentStep).toBe(0);
  });

  it('completes onboarding and marks session completed', () => {
    useOnboardingStore.setState({ mode: 'quick', currentStep: 1, wizardOpen: true, sessionState: 'active' });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.complete();
    });

    expect(result.current.isCompleted).toBe(true);
    expect(result.current.sessionState).toBe('completed');
    expect(result.current.shouldShowWizard).toBe(false);
  });

  it('manages tour lifecycle', () => {
    useOnboardingStore.setState({ completed: true, wizardOpen: false, sessionState: 'completed' });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.startTour();
      result.current.nextTourStep();
    });
    expect(result.current.tourActive).toBe(true);
    expect(result.current.tourStep).toBe(1);

    act(() => {
      result.current.completeTour();
    });

    expect(result.current.tourActive).toBe(false);
    expect(result.current.tourCompleted).toBe(true);
  });
});
