import { renderHook } from '@testing-library/react';
import { usePluginUiEffects } from './use-plugin-ui-effects';

const mockListenPluginUiEffect = jest.fn();
const mockPush = jest.fn();
const mockToastInfo = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  listenPluginUiEffect: (...args: unknown[]) => mockListenPluginUiEffect(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('usePluginUiEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListenPluginUiEffect.mockResolvedValue(() => {});
  });

  it('registers plugin UI effect listener on mount', () => {
    renderHook(() => usePluginUiEffects());

    expect(mockListenPluginUiEffect).toHaveBeenCalled();
  });

  it('routes toast effects by level', async () => {
    let callback: ((effect: { effect: string; payload: Record<string, unknown> }) => void) | undefined;
    mockListenPluginUiEffect.mockImplementation((cb) => {
      callback = cb;
      return Promise.resolve(() => {});
    });

    renderHook(() => usePluginUiEffects());

    await new Promise((resolve) => setTimeout(resolve, 0));

    callback?.({ effect: 'toast', payload: { message: 'ok', level: 'success' } });
    callback?.({ effect: 'toast', payload: { message: 'warn', level: 'warning' } });
    callback?.({ effect: 'toast', payload: { message: 'err', level: 'error' } });
    callback?.({ effect: 'toast', payload: { message: 'info' } });

    expect(mockToastSuccess).toHaveBeenCalledWith('ok');
    expect(mockToastWarning).toHaveBeenCalledWith('warn');
    expect(mockToastError).toHaveBeenCalledWith('err');
    expect(mockToastInfo).toHaveBeenCalledWith('info');
  });

  it('navigates only for internal paths', async () => {
    let callback: ((effect: { effect: string; payload: Record<string, unknown> }) => void) | undefined;
    mockListenPluginUiEffect.mockImplementation((cb) => {
      callback = cb;
      return Promise.resolve(() => {});
    });

    renderHook(() => usePluginUiEffects());

    await new Promise((resolve) => setTimeout(resolve, 0));

    callback?.({ effect: 'navigate', payload: { path: '/toolbox' } });
    callback?.({ effect: 'navigate', payload: { path: '//attacker.example' } });
    callback?.({ effect: 'navigate', payload: { path: 'https://example.com' } });

    expect(mockPush).toHaveBeenCalledWith('/toolbox');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
