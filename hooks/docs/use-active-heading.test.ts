import { renderHook, act } from '@testing-library/react';
import { useActiveHeading } from './use-active-heading';
import { scrollToHeading } from '@/lib/docs/scroll';

jest.mock('@/lib/docs/scroll', () => ({
  scrollToHeading: jest.fn(),
}));

const mockScrollToHeading = jest.mocked(scrollToHeading);

const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();

  global.IntersectionObserver = jest.fn((callback) => {
    observerCallback = callback as (entries: Partial<IntersectionObserverEntry>[]) => void;
    return {
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: mockDisconnect,
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    };
  }) as unknown as typeof IntersectionObserver;
});

describe('useActiveHeading', () => {
  it('returns empty activeId initially', () => {
    const { result } = renderHook(() => useActiveHeading([]));
    expect(result.current.activeId).toBe('');
  });

  it('sets up IntersectionObserver for provided heading IDs', () => {
    const ids = ['intro', 'setup', 'api'];
    const elements = ids.map((id) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    renderHook(() => useActiveHeading(ids));
    expect(mockObserve).toHaveBeenCalledTimes(3);

    elements.forEach((el) => document.body.removeChild(el));
  });

  it('does not set up IntersectionObserver when enabled=false', () => {
    renderHook(() => useActiveHeading(['intro'], { enabled: false }));
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('updates activeId when observer fires', () => {
    const el = document.createElement('div');
    el.id = 'section-a';
    document.body.appendChild(el);

    const { result } = renderHook(() => useActiveHeading(['section-a']));

    act(() => {
      observerCallback([{ isIntersecting: true, target: el }]);
    });

    expect(result.current.activeId).toBe('section-a');

    document.body.removeChild(el);
  });

  it('scrollToId updates activeId and calls scrollToHeading', () => {
    const { result } = renderHook(() => useActiveHeading(['heading-1']));

    act(() => {
      result.current.scrollToId('heading-1');
    });

    expect(result.current.activeId).toBe('heading-1');
    expect(mockScrollToHeading).toHaveBeenCalledWith('heading-1');
  });

  it('disconnects IntersectionObserver on unmount', () => {
    const el = document.createElement('div');
    el.id = 'test';
    document.body.appendChild(el);

    const { unmount } = renderHook(() => useActiveHeading(['test']));
    unmount();

    expect(mockDisconnect).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('suppresses observer updates during programmatic scroll', () => {
    jest.useFakeTimers();

    const el = document.createElement('div');
    el.id = 'target';
    document.body.appendChild(el);

    const { result } = renderHook(() => useActiveHeading(['target']));

    // Trigger programmatic scroll
    act(() => {
      result.current.scrollToId('target');
    });

    // Observer fires during scroll — should be suppressed
    act(() => {
      observerCallback([{ isIntersecting: true, target: Object.assign(document.createElement('div'), { id: 'other' }) }]);
    });
    expect(result.current.activeId).toBe('target'); // Not 'other'

    // After timeout, observer updates resume
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    act(() => {
      observerCallback([{ isIntersecting: true, target: el }]);
    });
    expect(result.current.activeId).toBe('target');

    document.body.removeChild(el);
    jest.useRealTimers();
  });
});
