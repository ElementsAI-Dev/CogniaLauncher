import { renderHook, waitFor } from '@testing-library/react';
import { useWslStatus } from './use-wsl-status';

const mockIsTauri = jest.fn(() => true);
const mockWslIsAvailable = jest.fn();
const mockWslGetRuntimeSnapshot = jest.fn();
const mockWslListDistros = jest.fn();
const mockWslGetStatus = jest.fn();
const mockWslGetCapabilities = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  wslIsAvailable: (...args: unknown[]) => mockWslIsAvailable(...args),
  wslGetRuntimeSnapshot: (...args: unknown[]) => mockWslGetRuntimeSnapshot(...args),
  wslListDistros: (...args: unknown[]) => mockWslListDistros(...args),
  wslGetStatus: (...args: unknown[]) => mockWslGetStatus(...args),
  wslGetCapabilities: (...args: unknown[]) => mockWslGetCapabilities(...args),
}));

describe('useWslStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWslIsAvailable.mockResolvedValue(true);
    mockWslGetRuntimeSnapshot.mockResolvedValue({
      state: 'ready',
      available: true,
      reasonCode: 'runtime_ready',
      reason: 'Runtime and management probes passed.',
      runtimeProbes: [],
      statusProbe: { ready: true, reasonCode: 'ok' },
      capabilityProbe: { ready: true, reasonCode: 'ok' },
      distroProbe: { ready: true, reasonCode: 'ok' },
      distroCount: 2,
      degradedReasons: [],
    });
    mockWslListDistros.mockResolvedValue([
      { name: 'Ubuntu', state: 'Running' },
      { name: 'Debian', state: 'Stopped' },
    ]);
    mockWslGetStatus.mockResolvedValue({ wslVersion: '2.2.0' });
    mockWslGetCapabilities.mockResolvedValue({
      manage: true,
      move: true,
      resize: true,
      setSparse: true,
      setDefaultUser: true,
      mountOptions: true,
      shutdownForce: true,
      exportFormat: true,
      importInPlace: true,
    });
  });

  it('loads availability and distro/status data in tauri mode', async () => {
    const { result } = renderHook(() => useWslStatus());

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(mockWslGetRuntimeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.distros).toHaveLength(2);
    expect(result.current.runningCount).toBe(1);
    expect(result.current.status).toEqual({ wslVersion: '2.2.0' });
    expect(result.current.runtimeSnapshot?.state).toBe('ready');
    expect(result.current.completeness.state).toBe('ready');
  });

  it('returns unavailable when not in tauri mode', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useWslStatus());
    await waitFor(() => expect(result.current.available).toBe(false));
    expect(mockWslIsAvailable).not.toHaveBeenCalled();
  });
});
