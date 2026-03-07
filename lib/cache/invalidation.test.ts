const mockIsTauri = jest.fn<boolean, []>();
const mockListenCacheChanged = jest.fn();
const mockListenCacheAutoCleaned = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  listenCacheChanged: (...args: unknown[]) => mockListenCacheChanged(...args),
  listenCacheAutoCleaned: (...args: unknown[]) => mockListenCacheAutoCleaned(...args),
}));

type InvalidationModule = typeof import('./invalidation');

describe('cache invalidation bus', () => {
  let mod: InvalidationModule;

  beforeEach(async () => {
    jest.useRealTimers();
    jest.resetModules();
    mockIsTauri.mockReset();
    mockListenCacheChanged.mockReset();
    mockListenCacheAutoCleaned.mockReset();
    mockIsTauri.mockReturnValue(false);
    mod = await import('./invalidation');
  });

  it('emits and unsubscribes for single or multiple domains', () => {
    const domains: string[] = [];
    const unsubscribe = mod.subscribeInvalidation(['cache_entries', 'external_cache'], (event) => {
      domains.push(event.domain);
    });

    mod.emitInvalidation('cache_entries', 'manual-refresh');
    mod.emitInvalidations(['external_cache'], 'refresh-many');
    expect(domains).toEqual(['cache_entries', 'external_cache']);

    unsubscribe();
    mod.emitInvalidation('cache_entries', 'after-unsubscribe');
    expect(domains).toEqual(['cache_entries', 'external_cache']);
  });

  it('keeps fanout resilient when a handler throws', () => {
    const received: string[] = [];
    mod.subscribeInvalidation('package_data', () => {
      throw new Error('test');
    });
    mod.subscribeInvalidation('package_data', (event) => {
      received.push(event.reason);
    });

    mod.emitInvalidation('package_data', 'backend-update', 'backend');
    expect(received).toEqual(['backend-update']);
  });

  it('throttles execution until timeout completes', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const throttled = mod.withThrottle(fn, 200);

    throttled('a');
    throttled('b');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    throttled('c');
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('does not start bridge when not running in tauri', async () => {
    await expect(mod.ensureCacheInvalidationBridge()).resolves.toBeUndefined();
    expect(mockListenCacheChanged).not.toHaveBeenCalled();
    expect(mockListenCacheAutoCleaned).not.toHaveBeenCalled();
  });

  it('starts bridge once and forwards backend events to all domains', async () => {
    mockIsTauri.mockReturnValue(true);
    let changedHandler: ((event: unknown) => void) | undefined;
    let autoHandler: ((event: unknown) => void) | undefined;
    mockListenCacheChanged.mockImplementation(async (handler: (event: unknown) => void) => {
      changedHandler = handler;
      return () => undefined;
    });
    mockListenCacheAutoCleaned.mockImplementation(async (handler: (event: unknown) => void) => {
      autoHandler = handler;
      return () => undefined;
    });

    const events: Array<{ reason: string; source: string }> = [];
    mod.subscribeInvalidation('cache_overview', (event) => {
      events.push({ reason: event.reason, source: event.source });
    });

    await mod.ensureCacheInvalidationBridge();
    await mod.ensureCacheInvalidationBridge();

    expect(mockListenCacheChanged).toHaveBeenCalledTimes(1);
    expect(mockListenCacheAutoCleaned).toHaveBeenCalledTimes(1);

    changedHandler?.({ type: 'changed' });
    autoHandler?.({ type: 'cleaned' });

    expect(events).toEqual([
      { reason: 'backend:cache-changed', source: 'backend' },
      { reason: 'backend:auto-cleaned', source: 'backend' },
    ]);
  });

  it('routes backend bridge events only to payload domains when provided', async () => {
    mockIsTauri.mockReturnValue(true);
    let changedHandler: ((event: unknown) => void) | undefined;
    mockListenCacheChanged.mockImplementation(async (handler: (event: unknown) => void) => {
      changedHandler = handler;
      return () => undefined;
    });
    mockListenCacheAutoCleaned.mockResolvedValue(async () => undefined);

    const overviewEvents: string[] = [];
    const externalEvents: string[] = [];
    mod.subscribeInvalidation('cache_overview', (event) => {
      overviewEvents.push(event.reason);
    });
    mod.subscribeInvalidation('external_cache', (event) => {
      externalEvents.push(event.reason);
    });

    await mod.ensureCacheInvalidationBridge();

    changedHandler?.({
      action: 'optimize',
      scope: 'all',
      domains: ['cache_overview'],
    });

    expect(overviewEvents).toEqual(['backend:cache-changed']);
    expect(externalEvents).toEqual([]);
  });

  it('recovers from bridge startup error and allows retry', async () => {
    mockIsTauri.mockReturnValue(true);
    mockListenCacheChanged
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(async () => undefined);
    mockListenCacheAutoCleaned.mockResolvedValue(async () => undefined);

    await expect(mod.ensureCacheInvalidationBridge()).resolves.toBeUndefined();
    await expect(mod.ensureCacheInvalidationBridge()).resolves.toBeUndefined();

    expect(mockListenCacheChanged).toHaveBeenCalledTimes(2);
  });
});
