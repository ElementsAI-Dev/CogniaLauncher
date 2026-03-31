import { renderHook, act } from '@testing-library/react';
import { useLaunch } from './use-launch';

const mockLaunchWithEnv = jest.fn();
const mockLaunchWithStreaming = jest.fn();
const mockEnvActivate = jest.fn();
const mockEnvGetInfo = jest.fn();
const mockExecShellWithEnv = jest.fn();
const mockWhichProgram = jest.fn();
const mockListenCommandOutput = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  launchWithEnv: (...args: unknown[]) => mockLaunchWithEnv(...args),
  launchWithStreaming: (...args: unknown[]) => mockLaunchWithStreaming(...args),
  envActivate: (...args: unknown[]) => mockEnvActivate(...args),
  envGetInfo: (...args: unknown[]) => mockEnvGetInfo(...args),
  execShellWithEnv: (...args: unknown[]) => mockExecShellWithEnv(...args),
  whichProgram: (...args: unknown[]) => mockWhichProgram(...args),
  listenCommandOutput: (...args: unknown[]) => mockListenCommandOutput(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

describe('useLaunch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useLaunch());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastResult).toBeNull();
    expect(result.current.streamingOutput).toEqual([]);
  });

  it('should launch with env', async () => {
    const launchResult = { exitCode: 0, stdout: 'ok', stderr: '' };
    mockLaunchWithEnv.mockResolvedValue(launchResult);

    const { result } = renderHook(() => useLaunch());
    const request = { command: 'node', args: ['-v'], envType: 'node', version: '18' };

    let res;
    await act(async () => {
      res = await result.current.launchWithEnv(request as never);
    });

    expect(res).toEqual(launchResult);
    expect(result.current.lastResult).toEqual(launchResult);
    expect(result.current.loading).toBe(false);
    expect(mockLaunchWithEnv).toHaveBeenCalledWith(request);
  });

  it('should handle launchWithEnv error', async () => {
    mockLaunchWithEnv.mockRejectedValue(new Error('Launch failed'));

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.launchWithEnv({ command: 'fail' } as never);
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Launch failed');
    expect(result.current.loading).toBe(false);
  });

  it('should launch with streaming and setup listener', async () => {
    const unlisten = jest.fn();
    mockListenCommandOutput.mockResolvedValue(unlisten);
    const launchResult = { exitCode: 0, stdout: 'done', stderr: '' };
    mockLaunchWithStreaming.mockResolvedValue(launchResult);

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.launchWithStreaming({ command: 'build' } as never);
    });

    expect(res).toEqual(launchResult);
    expect(result.current.lastResult).toEqual(launchResult);
    expect(mockListenCommandOutput).toHaveBeenCalled();
    // Listener should be cleaned up after completion
    expect(unlisten).toHaveBeenCalled();
  });

  it('should handle launchWithStreaming error', async () => {
    mockListenCommandOutput.mockResolvedValue(jest.fn());
    mockLaunchWithStreaming.mockRejectedValue(new Error('Stream failed'));

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.launchWithStreaming({ command: 'fail' } as never);
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Stream failed');
  });

  it('should handle listener setup failure gracefully', async () => {
    mockListenCommandOutput.mockRejectedValue(new Error('No events'));
    const launchResult = { exitCode: 0, stdout: 'ok', stderr: '' };
    mockLaunchWithStreaming.mockResolvedValue(launchResult);

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.launchWithStreaming({ command: 'test' } as never);
    });

    // Should still succeed even if listener fails
    expect(res).toEqual(launchResult);
  });

  it('should get activation script', async () => {
    const script = { content: 'source /env/python', shell: 'bash' };
    mockEnvActivate.mockResolvedValue(script);

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.getActivationScript('python', '3.11', '/project', 'bash');
    });

    expect(res).toEqual(script);
    expect(mockEnvActivate).toHaveBeenCalledWith('python', '3.11', '/project', 'bash');
  });

  it('should handle getActivationScript error', async () => {
    mockEnvActivate.mockRejectedValue(new Error('No script'));

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.getActivationScript('python');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('No script');
  });

  it('should get env info', async () => {
    const envInfo = { envType: 'node', version: '18.0.0', path: '/nvm/18' };
    mockEnvGetInfo.mockResolvedValue(envInfo);

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.getEnvInfo('node', '18.0.0');
    });

    expect(res).toEqual(envInfo);
    expect(mockEnvGetInfo).toHaveBeenCalledWith('node', '18.0.0');
  });

  it('should exec shell with env', async () => {
    const execResult = { exitCode: 0, stdout: 'v18.0.0', stderr: '' };
    mockExecShellWithEnv.mockResolvedValue(execResult);

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.execShellWithEnv('node -v', 'node', '18', '/home');
    });

    expect(res).toEqual(execResult);
    expect(result.current.lastResult).toEqual(execResult);
    expect(mockExecShellWithEnv).toHaveBeenCalledWith('node -v', 'node', '18', '/home');
  });

  it('should handle execShellWithEnv error', async () => {
    mockExecShellWithEnv.mockRejectedValue(new Error('Exec failed'));

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.execShellWithEnv('bad-cmd');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Exec failed');
  });

  it('should which program', async () => {
    mockWhichProgram.mockResolvedValue('/usr/bin/node');

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.whichProgram('node', 'node', '18');
    });

    expect(res).toBe('/usr/bin/node');
    expect(mockWhichProgram).toHaveBeenCalledWith('node', 'node', '18', undefined);
  });

  it('should handle whichProgram error', async () => {
    mockWhichProgram.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useLaunch());

    let res;
    await act(async () => {
      res = await result.current.whichProgram('missing');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Not found');
  });

  it('should clear output', async () => {
    const launchResult = { exitCode: 0, stdout: 'ok', stderr: '' };
    mockLaunchWithEnv.mockResolvedValue(launchResult);

    const { result } = renderHook(() => useLaunch());

    await act(async () => {
      await result.current.launchWithEnv({ command: 'test' } as never);
    });

    expect(result.current.lastResult).not.toBeNull();

    act(() => {
      result.current.clearOutput();
    });

    expect(result.current.lastResult).toBeNull();
    expect(result.current.streamingOutput).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
