import { renderHook, act } from '@testing-library/react';
import { useNetwork } from './use-network';

describe('useNetwork', () => {
  const originalNavigator = window.navigator;
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  let onlineHandler: (() => void) | null = null;
  let offlineHandler: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    onlineHandler = null;
    offlineHandler = null;

    // Mock addEventListener
    window.addEventListener = jest.fn((event: string, handler: EventListenerOrEventListenerObject) => {
      if (event === 'online') onlineHandler = handler as () => void;
      if (event === 'offline') offlineHandler = handler as () => void;
    });

    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('should return online status when navigator.onLine is true', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(true);
  });

  it('should return offline status when navigator.onLine is false', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(false);
  });

  it('should include connection info when available', () => {
    const mockConnection = {
      effectiveType: '4g' as const,
      downlink: 10,
      rtt: 50,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    Object.defineProperty(window, 'navigator', {
      value: {
        onLine: true,
        connection: mockConnection,
      },
      configurable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current).toEqual({
      online: true,
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
    });
  });

  it('should update when going offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(true);

    // Simulate going offline
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });
      offlineHandler?.();
    });

    expect(result.current.online).toBe(false);
  });

  it('should update when going online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(false);

    // Simulate going online
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });
      onlineHandler?.();
    });

    expect(result.current.online).toBe(true);
  });

  it('should listen for connection changes when supported', () => {
    const mockAddEventListener = jest.fn();
    const mockRemoveEventListener = jest.fn();

    const mockConnection = {
      effectiveType: '4g' as const,
      downlink: 10,
      rtt: 50,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    };

    Object.defineProperty(window, 'navigator', {
      value: {
        onLine: true,
        connection: mockConnection,
      },
      configurable: true,
    });

    const { unmount } = renderHook(() => useNetwork());

    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should cleanup event listeners on unmount', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const { unmount } = renderHook(() => useNetwork());

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should handle missing connection API gracefully', () => {
    Object.defineProperty(window, 'navigator', {
      value: {
        onLine: true,
        connection: undefined,
      },
      configurable: true,
    });

    const { result } = renderHook(() => useNetwork());

    expect(result.current).toEqual({
      online: true,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
    });
  });

  it('should handle different effective types', () => {
    const effectiveTypes: Array<'slow-2g' | '2g' | '3g' | '4g'> = ['slow-2g', '2g', '3g', '4g'];

    effectiveTypes.forEach((type) => {
      const mockConnection = {
        effectiveType: type,
        downlink: 1,
        rtt: 100,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      Object.defineProperty(window, 'navigator', {
        value: {
          onLine: true,
          connection: mockConnection,
        },
        configurable: true,
      });

      const { result, unmount } = renderHook(() => useNetwork());

      expect(result.current.effectiveType).toBe(type);
      unmount();
    });
  });
});
