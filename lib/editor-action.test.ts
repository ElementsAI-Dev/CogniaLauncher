import { runEditorActionFlow } from './editor-action';

describe('runEditorActionFlow', () => {
  it('opens fallback path when probe reports unavailable with fallback path', async () => {
    const fallbackOpen = jest.fn().mockResolvedValue(undefined);

    const result = await runEditorActionFlow({
      probe: async () => ({
        available: false,
        reason: 'editor_not_found',
        fallbackPath: '/tmp/config',
      }),
      open: async () => ({
        success: true,
        reason: 'ok',
        message: 'opened',
      }),
      fallbackOpen,
      unavailableMessage: 'Editor unavailable',
    });

    expect(result.status).toBe('fallback_opened');
    expect(fallbackOpen).toHaveBeenCalledWith('/tmp/config');
  });

  it('returns unavailable when probe reports unavailable and no fallback path', async () => {
    const fallbackOpen = jest.fn().mockResolvedValue(undefined);

    const result = await runEditorActionFlow({
      probe: async () => ({
        available: false,
        reason: 'runtime_error',
        fallbackPath: null,
      }),
      open: async () => ({
        success: true,
        reason: 'ok',
        message: 'opened',
      }),
      fallbackOpen,
      unavailableMessage: 'Editor unavailable',
    });

    expect(result.status).toBe('unavailable');
    expect(fallbackOpen).not.toHaveBeenCalled();
  });

  it('falls back when open fails and fallback path is available', async () => {
    const fallbackOpen = jest.fn().mockResolvedValue(undefined);

    const result = await runEditorActionFlow({
      probe: async () => ({
        available: true,
        reason: 'ok',
        fallbackPath: '/tmp/config',
      }),
      open: async () => ({
        success: false,
        reason: 'runtime_error',
        message: 'open failed',
        fallbackPath: '/tmp/config',
      }),
      fallbackOpen,
    });

    expect(result.status).toBe('fallback_opened');
    expect(fallbackOpen).toHaveBeenCalledWith('/tmp/config');
  });
});
