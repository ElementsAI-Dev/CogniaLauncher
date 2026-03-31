import { act, renderHook } from '@testing-library/react';
import { useOnboardingHydration } from './use-onboarding-hydration';

type PersistCb = (state: unknown) => void;
jest.mock('@/lib/stores/onboarding', () => ({
  useOnboardingStore: Object.assign(jest.fn(), {
    persist: {
      hasHydrated: jest.fn(),
      onHydrate: jest.fn(),
      onFinishHydration: jest.fn(),
    },
  }),
}));

describe('useOnboardingHydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useOnboardingStore } = jest.requireMock('@/lib/stores/onboarding');
    useOnboardingStore.persist = {
      hasHydrated: jest.fn(),
      onHydrate: jest.fn(),
      onFinishHydration: jest.fn(),
    };
  });

  it('tracks hydration lifecycle from persist callbacks', () => {
    const { useOnboardingStore } = jest.requireMock('@/lib/stores/onboarding');
    const persistApi = useOnboardingStore.persist;
    persistApi.hasHydrated.mockReturnValue(true);
    let hydrateCb: PersistCb = () => {};
    let finishCb: PersistCb = () => {};
    const unsubHydrate = jest.fn();
    const unsubFinish = jest.fn();
    persistApi.onHydrate.mockImplementation((cb: PersistCb) => {
      hydrateCb = cb;
      return unsubHydrate;
    });
    persistApi.onFinishHydration.mockImplementation((cb: PersistCb) => {
      finishCb = cb;
      return unsubFinish;
    });

    const { result, unmount } = renderHook(() => useOnboardingHydration());
    expect(result.current).toBe(true);

    act(() => hydrateCb({}));
    expect(result.current).toBe(false);

    act(() => finishCb({}));
    expect(result.current).toBe(true);

    unmount();
    expect(unsubHydrate).toHaveBeenCalled();
    expect(unsubFinish).toHaveBeenCalled();
  });

  it('returns true when persist api is unavailable', () => {
    const { useOnboardingStore } = jest.requireMock('@/lib/stores/onboarding');
    useOnboardingStore.persist = undefined;
    const { result } = renderHook(() => useOnboardingHydration());
    expect(result.current).toBe(true);
  });
});
