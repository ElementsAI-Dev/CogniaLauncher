import { renderHook, act } from '@testing-library/react';
import { useNetwork } from '../use-network';

describe('useNetwork', () => {
  let onlineListeners: EventListener[] = [];
  let offlineListeners: EventListener[] = [];
  let connectionListeners: EventListener[] = [];
  let mockOnLine = true;
  let mockConnection: {
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
    downlink: number;
    rtt: number;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  } | undefined;
  
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    onlineListeners = [];
    offlineListeners = [];
    connectionListeners = [];
    mockOnLine = true;
    
    mockConnection = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      addEventListener: jest.fn((type: string, listener: EventListener) => {
        if (type === 'change') connectionListeners.push(listener);
      }),
      removeEventListener: jest.fn((type: string, listener: EventListener) => {
        if (type === 'change') connectionListeners = connectionListeners.filter((l) => l !== listener);
      }),
    };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockOnLine,
      configurable: true,
    });

    // Mock navigator.connection
    Object.defineProperty(navigator, 'connection', {
      get: () => mockConnection,
      configurable: true,
    });

    // Spy on window event listeners
    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, listener: EventListenerOrEventListenerObject) => {
        const fn = listener as EventListener;
        if (event === 'online') onlineListeners.push(fn);
        if (event === 'offline') offlineListeners.push(fn);
      }
    );

    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation(
      (event: string, listener: EventListenerOrEventListenerObject) => {
        const fn = listener as EventListener;
        if (event === 'online') onlineListeners = onlineListeners.filter((l) => l !== fn);
        if (event === 'offline') offlineListeners = offlineListeners.filter((l) => l !== fn);
      }
    );
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('returns initial network status', () => {
    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(true);
    expect(result.current.effectiveType).toBe('4g');
    expect(result.current.downlink).toBe(10);
    expect(result.current.rtt).toBe(50);
  });

  it('registers online/offline event listeners', () => {
    renderHook(() => useNetwork());

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('registers connection change listener when available', () => {
    renderHook(() => useNetwork());

    expect(mockConnection!.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates status when going offline', () => {
    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(true);

    // Simulate going offline
    mockOnLine = false;

    act(() => {
      offlineListeners.forEach((listener) => listener(new Event('offline')));
    });

    expect(result.current.online).toBe(false);
  });

  it('updates status when going online', () => {
    // Start offline
    mockOnLine = false;

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(false);

    // Simulate going online
    mockOnLine = true;

    act(() => {
      onlineListeners.forEach((listener) => listener(new Event('online')));
    });

    expect(result.current.online).toBe(true);
  });

  it('updates status when connection changes', () => {
    const { result } = renderHook(() => useNetwork());

    expect(result.current.effectiveType).toBe('4g');

    // Simulate connection change
    mockConnection!.effectiveType = '3g';
    mockConnection!.downlink = 1.5;

    act(() => {
      connectionListeners.forEach((listener) => listener(new Event('change')));
    });

    expect(result.current.effectiveType).toBe('3g');
    expect(result.current.downlink).toBe(1.5);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetwork());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(mockConnection!.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('handles missing connection API', () => {
    mockConnection = undefined;

    const { result } = renderHook(() => useNetwork());

    expect(result.current.online).toBe(true);
    expect(result.current.effectiveType).toBeUndefined();
    expect(result.current.downlink).toBeUndefined();
    expect(result.current.rtt).toBeUndefined();
  });

  it('handles slow-2g connection', () => {
    mockConnection!.effectiveType = 'slow-2g';
    mockConnection!.downlink = 0.05;
    mockConnection!.rtt = 2000;

    const { result } = renderHook(() => useNetwork());

    expect(result.current.effectiveType).toBe('slow-2g');
    expect(result.current.downlink).toBe(0.05);
    expect(result.current.rtt).toBe(2000);
  });

  it('handles 2g connection', () => {
    mockConnection!.effectiveType = '2g';

    const { result } = renderHook(() => useNetwork());

    expect(result.current.effectiveType).toBe('2g');
  });
});
