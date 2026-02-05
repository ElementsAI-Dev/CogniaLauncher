import { renderHook, act } from '@testing-library/react';
import { useIsMobile, useDebounce } from './use-mobile';

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    window.matchMedia = originalMatchMedia;
  });

  it('should return false when window width is >= 768px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const listeners: Array<() => void> = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn((_, handler) => listeners.push(handler)),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('should return true when window width is < 768px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const listeners: Array<() => void> = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: jest.fn((_, handler) => listeners.push(handler)),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should update when window resizes', () => {
    let changeHandler: (() => void) | null = null;

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn((_, handler) => {
        changeHandler = handler;
      }),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      changeHandler?.();
    });

    expect(result.current).toBe(true);
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListener = jest.fn();

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    expect(result.current).toBe('a');

    rerender({ value: 'b', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'c', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'd', delay: 300 });
    
    // Should still be 'a' as timer keeps resetting
    expect(result.current).toBe('a');

    // Wait full delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should now be 'd'
    expect(result.current).toBe('d');
  });

  it('should work with different data types', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: { count: 1 }, delay: 200 } }
    );

    expect(result.current).toEqual({ count: 1 });

    rerender({ value: { count: 2 }, delay: 200 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({ count: 2 });
  });

  it('should handle delay change', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 100 } }
    );

    rerender({ value: 'updated', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Should not update yet with new delay
    expect(result.current).toBe('test');

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe('updated');
  });

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
