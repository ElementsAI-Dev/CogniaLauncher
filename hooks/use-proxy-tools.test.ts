import { act, renderHook } from '@testing-library/react';
import { useProxyTools } from './use-proxy-tools';

const mockIsTauri = jest.fn(() => true);
const mockDetectSystemProxy = jest.fn();
const mockTestProxyConnection = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/tauri', () => ({
  detectSystemProxy: (...args: unknown[]) => mockDetectSystemProxy(...args),
  testProxyConnection: (...args: unknown[]) => mockTestProxyConnection(...args),
}));

describe('useProxyTools', () => {
  const t = (k: string) => k;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects proxy and updates config fields', async () => {
    const onValueChange = jest.fn();
    mockDetectSystemProxy.mockResolvedValue({
      source: 'environment',
      httpProxy: 'http://127.0.0.1:7890',
      httpsProxy: null,
      noProxy: 'localhost',
    });

    const { result } = renderHook(() =>
      useProxyTools({ localConfig: {}, onValueChange, t }),
    );

    await act(async () => {
      await result.current.handleDetectProxy();
    });

    expect(onValueChange).toHaveBeenCalledWith(
      'network.proxy',
      'http://127.0.0.1:7890',
    );
    expect(onValueChange).toHaveBeenCalledWith('network.no_proxy', 'localhost');
    expect(result.current.detectResult).toContain('settings.proxyDetectedEnv');
  });

  it('sets failed test message on connection failure', async () => {
    mockTestProxyConnection.mockResolvedValue({
      success: false,
      latencyMs: 0,
      error: 'timeout',
    });
    const { result } = renderHook(() =>
      useProxyTools({
        localConfig: { 'network.proxy': 'http://proxy:8080' },
        onValueChange: jest.fn(),
        t,
      }),
    );

    await act(async () => {
      await result.current.handleTestProxy();
    });

    expect(result.current.testResult).toContain('settings.proxyTestFailed');
  });
});

