import { renderHook, waitFor } from '@testing-library/react';
import { useWslStatus } from './use-wsl-status';

const mockIsTauri = jest.fn(() => true);
const mockWslIsAvailable = jest.fn();
const mockWslListDistros = jest.fn();
const mockWslGetStatus = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  wslIsAvailable: (...args: unknown[]) => mockWslIsAvailable(...args),
  wslListDistros: (...args: unknown[]) => mockWslListDistros(...args),
  wslGetStatus: (...args: unknown[]) => mockWslGetStatus(...args),
}));

describe('useWslStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWslIsAvailable.mockResolvedValue(true);
    mockWslListDistros.mockResolvedValue([
      { name: 'Ubuntu', state: 'Running' },
      { name: 'Debian', state: 'Stopped' },
    ]);
    mockWslGetStatus.mockResolvedValue({ wslVersion: '2.2.0' });
  });

  it('loads availability and distro/status data in tauri mode', async () => {
    const { result } = renderHook(() => useWslStatus());

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.distros).toHaveLength(2);
    expect(result.current.runningCount).toBe(1);
    expect(result.current.status).toEqual({ wslVersion: '2.2.0' });
  });

  it('returns unavailable when not in tauri mode', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useWslStatus());
    await waitFor(() => expect(result.current.available).toBe(false));
    expect(mockWslIsAvailable).not.toHaveBeenCalled();
  });
});

