import { act, renderHook } from '@testing-library/react';
import { useWsl } from './use-wsl';

const mockIsTauri = jest.fn(() => true);
const mockWslGetRuntimeSnapshot = jest.fn();
const mockWslGetStatus = jest.fn();
const mockWslGetCapabilities = jest.fn();
const mockWslGetVersionInfo = jest.fn();
const mockWslListDistros = jest.fn();
const mockWslDiskUsage = jest.fn();
const mockWslGetIp = jest.fn();
const mockWslDetectDistroEnv = jest.fn();
const mockWslGetDistroResources = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  wslGetRuntimeSnapshot: (...args: unknown[]) => mockWslGetRuntimeSnapshot(...args),
  wslGetStatus: (...args: unknown[]) => mockWslGetStatus(...args),
  wslGetCapabilities: (...args: unknown[]) => mockWslGetCapabilities(...args),
  wslGetVersionInfo: (...args: unknown[]) => mockWslGetVersionInfo(...args),
  wslListDistros: (...args: unknown[]) => mockWslListDistros(...args),
  wslDiskUsage: (...args: unknown[]) => mockWslDiskUsage(...args),
  wslGetIp: (...args: unknown[]) => mockWslGetIp(...args),
  wslDetectDistroEnv: (...args: unknown[]) => mockWslDetectDistroEnv(...args),
  wslGetDistroResources: (...args: unknown[]) => mockWslGetDistroResources(...args),
}));

describe('useWsl information snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockWslGetRuntimeSnapshot.mockResolvedValue({
      state: 'ready',
      available: true,
      reasonCode: 'runtime_ready',
      reason: 'Runtime and management probes passed.',
      runtimeProbes: [],
      statusProbe: { ready: true, reasonCode: 'ok' },
      capabilityProbe: { ready: true, reasonCode: 'ok' },
      distroProbe: { ready: true, reasonCode: 'ok' },
      distroCount: 1,
      degradedReasons: [],
    });
    mockWslGetStatus.mockResolvedValue({
      version: '2.4.0',
      kernelVersion: '6.6.87.2-1',
      statusInfo: 'ok',
      runningDistros: ['Ubuntu'],
    });
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
      version: '2.4.0',
    });
    mockWslGetVersionInfo.mockResolvedValue({
      wslVersion: '2.4.0',
      kernelVersion: '6.6.87.2-1',
      wslgVersion: '1.0.66',
    });
    mockWslListDistros.mockResolvedValue([
      { name: 'Ubuntu', state: 'Running', wslVersion: '2', isDefault: true },
    ]);
    mockWslDiskUsage.mockResolvedValue({
      totalBytes: 1024,
      usedBytes: 256,
      filesystemPath: '\\\\wsl.localhost\\Ubuntu',
    });
    mockWslGetIp.mockResolvedValue('172.24.240.1');
    mockWslDetectDistroEnv.mockResolvedValue({
      distroId: 'ubuntu',
      distroIdLike: ['debian'],
      prettyName: 'Ubuntu 24.04',
      architecture: 'x86_64',
      kernelVersion: '6.6.87.2-1',
      packageManager: 'apt',
      initSystem: 'systemd',
      dockerAvailable: true,
      dockerSocket: true,
      dockerContainerCount: 2,
    });
    mockWslGetDistroResources.mockResolvedValue({
      memTotalKb: 1024,
      memAvailableKb: 512,
      memUsedKb: 512,
      swapTotalKb: 0,
      swapUsedKb: 0,
      cpuCount: 4,
      loadAvg: [0.3, 0.2, 0.1],
    });
  });

  it('builds a ready runtime info snapshot from shared refresh orchestration', async () => {
    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshRuntimeInfo();
    });

    expect(result.current.runtimeInfo.state).toBe('ready');
    expect(result.current.runtimeInfo.versionInfo.data?.wslVersion).toBe('2.4.0');
    expect(result.current.runtimeInfo.lastUpdatedAt).not.toBeNull();
  });

  it('keeps previous runtime version info as stale when a later refresh fails', async () => {
    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshRuntimeInfo();
    });

    mockWslGetVersionInfo.mockRejectedValueOnce(new Error('version probe timeout'));

    await act(async () => {
      await result.current.refreshRuntimeInfo();
    });

    expect(result.current.runtimeInfo.versionInfo.state).toBe('stale');
    expect(result.current.runtimeInfo.versionInfo.data?.wslVersion).toBe('2.4.0');
    expect(result.current.runtimeInfo.versionInfo.failure?.message).toContain('version probe timeout');
  });

  it('stores distro information snapshots for running distros', async () => {
    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshDistros();
      await result.current.refreshDistroInfo('Ubuntu');
    });

    expect(result.current.distroInfoByName.Ubuntu.state).toBe('ready');
    expect(result.current.distroInfoByName.Ubuntu.environment.data?.prettyName).toBe('Ubuntu 24.04');
    expect(result.current.distroInfoByName.Ubuntu.resources.data?.cpuCount).toBe(4);
  });

  it('marks live distro sections as unavailable when the distro is stopped', async () => {
    mockWslListDistros.mockResolvedValueOnce([
      { name: 'Ubuntu', state: 'Stopped', wslVersion: '2', isDefault: true },
    ]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshDistros();
      await result.current.refreshDistroInfo('Ubuntu');
    });

    expect(result.current.distroInfoByName.Ubuntu.environment.state).toBe('unavailable');
    expect(result.current.distroInfoByName.Ubuntu.resources.state).toBe('unavailable');
    expect(result.current.distroInfoByName.Ubuntu.ipAddress.state).toBe('unavailable');
  });
});
