import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from './use-onboarding';
import { useOnboardingStore, ONBOARDING_STEPS } from '@/lib/stores/onboarding';

// Reset Zustand store before each test
beforeEach(() => {
  const { resetOnboarding } = useOnboardingStore.getState();
  resetOnboarding();
  // Close wizard so auto-open doesn't interfere unless we're testing it
  useOnboardingStore.setState({ wizardOpen: false });
});

describe('useOnboarding', () => {
  it('should return default state on fresh store', () => {
    useOnboardingStore.setState({ completed: false, skipped: false, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isSkipped).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.totalSteps).toBe(ONBOARDING_STEPS.length);
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
  });

  it('should compute progress correctly', () => {
    useOnboardingStore.setState({ currentStep: 3 });
    const { result } = renderHook(() => useOnboarding());

    const expected = Math.round((3 / (ONBOARDING_STEPS.length - 1)) * 100);
    expect(result.current.progress).toBe(expected);
  });

  it('should compute currentStepId from step index', () => {
    useOnboardingStore.setState({ currentStep: 2 });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.currentStepId).toBe(ONBOARDING_STEPS[2]);
  });

  it('should detect last step', () => {
    useOnboardingStore.setState({ currentStep: ONBOARDING_STEPS.length - 1 });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isLastStep).toBe(true);
    expect(result.current.isFirstStep).toBe(false);
  });

  it('should auto-open wizard on first run (not completed, not skipped)', () => {
    useOnboardingStore.setState({ completed: false, skipped: false, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    // useEffect runs after mount, wizard should open
    expect(result.current.shouldShowWizard).toBe(true);
  });

  it('should NOT auto-open wizard when already completed', () => {
    useOnboardingStore.setState({ completed: true, skipped: false, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.shouldShowWizard).toBe(false);
  });

  it('should NOT auto-open wizard when skipped', () => {
    useOnboardingStore.setState({ completed: false, skipped: true, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.shouldShowWizard).toBe(false);
  });

  it('should open and close wizard', () => {
    useOnboardingStore.setState({ completed: true, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.openWizard();
    });
    expect(result.current.shouldShowWizard).toBe(true);

    act(() => {
      result.current.closeWizard();
    });
    expect(result.current.shouldShowWizard).toBe(false);
  });

  it('should navigate next/prev', () => {
    useOnboardingStore.setState({ currentStep: 0 });
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

  it('should not go below step 0', () => {
    useOnboardingStore.setState({ currentStep: 0 });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.prev();
    });
    expect(result.current.currentStep).toBe(0);
  });

  it('should not go above last step', () => {
    useOnboardingStore.setState({ currentStep: ONBOARDING_STEPS.length - 1 });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.next();
    });
    expect(result.current.currentStep).toBe(ONBOARDING_STEPS.length - 1);
  });

  it('should goTo a specific step', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.goTo(4);
    });
    expect(result.current.currentStep).toBe(4);
  });

  it('should complete onboarding', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.complete();
    });
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.isSkipped).toBe(false);
  });

  it('should skip onboarding', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.skip();
    });
    expect(result.current.isSkipped).toBe(true);
  });

  it('should reset onboarding', () => {
    useOnboardingStore.setState({ completed: true, currentStep: 5 });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.reset();
    });
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.currentStep).toBe(0);
  });

  it('should manage tour lifecycle', () => {
    useOnboardingStore.setState({ completed: true, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.tourActive).toBe(false);
    expect(result.current.tourStep).toBe(0);

    act(() => {
      result.current.startTour();
    });
    expect(result.current.tourActive).toBe(true);

    act(() => {
      result.current.nextTourStep();
    });
    expect(result.current.tourStep).toBe(1);

    act(() => {
      result.current.prevTourStep();
    });
    expect(result.current.tourStep).toBe(0);

    act(() => {
      result.current.completeTour();
    });
    expect(result.current.tourActive).toBe(false);
    expect(result.current.tourCompleted).toBe(true);
  });

  it('should stop tour without completing', () => {
    useOnboardingStore.setState({ completed: true, wizardOpen: false });
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.startTour();
      result.current.nextTourStep();
    });

    act(() => {
      result.current.stopTour();
    });
    expect(result.current.tourActive).toBe(false);
    expect(result.current.tourCompleted).toBe(false);
  });
});
