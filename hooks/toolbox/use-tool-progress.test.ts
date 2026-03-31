import { act, renderHook } from '@testing-library/react';
import { useToolProgress } from './use-tool-progress';
import type { ToolProgressEvent } from '@/types/toolbox';

const mockListenToolProgress = jest.fn();
const listeners: Array<(event: ToolProgressEvent) => void> = [];

jest.mock('@/lib/tauri', () => ({
  isTauri: () => true,
  listenToolProgress: (...args: Parameters<typeof mockListenToolProgress>) =>
    mockListenToolProgress(...args),
}));

describe('useToolProgress', () => {
  beforeEach(() => {
    listeners.length = 0;
    mockListenToolProgress.mockImplementation(async (callback: (event: ToolProgressEvent) => void) => {
      listeners.push(callback);
      return jest.fn();
    });
  });

  it('captures matching progress events by tool and execution id', async () => {
    const { result } = renderHook(() =>
      useToolProgress('plugin:demo:tool', 'exec-1'),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      listeners[0]({
        toolId: 'plugin:demo:tool',
        executionId: 'exec-2',
        phase: 'running',
        progress: 5,
        message: 'ignored',
      });
      listeners[0]({
        toolId: 'plugin:demo:tool',
        executionId: 'exec-1',
        phase: 'running',
        progress: 45,
        message: 'working',
      });
    });

    expect(result.current.phase).toBe('running');
    expect(result.current.progress).toBe(45);
    expect(result.current.message).toBe('working');
  });

  it('stores structured failures from progress events', async () => {
    const { result } = renderHook(() =>
      useToolProgress('plugin:demo:tool', 'exec-1'),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      listeners[0]({
        toolId: 'plugin:demo:tool',
        executionId: 'exec-1',
        phase: 'failed',
        message: 'permission blocked',
        error: {
          kind: 'permission_denied',
          message: 'permission blocked',
        },
      });
    });

    expect(result.current.phase).toBe('failed');
    expect(result.current.error).toEqual({
      kind: 'permission_denied',
      message: 'permission blocked',
    });
  });
});
