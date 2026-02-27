import { renderHook, act } from '@testing-library/react';
import { useWsl } from './use-wsl';

const mockIsTauri = jest.fn(() => true);
const mockWslIsAvailable = jest.fn();
const mockWslListDistros = jest.fn();
const mockWslListOnline = jest.fn();
const mockWslGetStatus = jest.fn();
const mockWslListRunning = jest.fn();
const mockWslGetCapabilities = jest.fn();
const mockWslGetConfig = jest.fn();
const mockWslTerminate = jest.fn();
const mockWslShutdown = jest.fn();
const mockWslSetDefault = jest.fn();
const mockWslSetVersion = jest.fn();
const mockWslSetDefaultVersion = jest.fn();
const mockWslExport = jest.fn();
const mockWslImport = jest.fn();
const mockWslUpdate = jest.fn();
const mockWslLaunch = jest.fn();
const mockWslExec = jest.fn();
const mockWslConvertPath = jest.fn();
const mockWslSetConfig = jest.fn();
const mockWslDiskUsage = jest.fn();
const mockWslImportInPlace = jest.fn();
const mockWslMount = jest.fn();
const mockWslUnmount = jest.fn();
const mockWslGetIp = jest.fn();
const mockWslChangeDefaultUser = jest.fn();
const mockWslGetDistroConfig = jest.fn();
const mockWslSetDistroConfig = jest.fn();
const mockWslGetVersionInfo = jest.fn();
const mockWslSetSparse = jest.fn();
const mockWslMoveDistro = jest.fn();
const mockWslResizeDistro = jest.fn();
const mockWslInstallWslOnly = jest.fn();
const mockWslInstallWithLocation = jest.fn();
const mockWslDetectDistroEnv = jest.fn();
const mockWslGetDistroResources = jest.fn();
const mockWslListUsers = jest.fn();
const mockWslUpdateDistroPackages = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  wslIsAvailable: (...a: unknown[]) => mockWslIsAvailable(...a),
  wslListDistros: (...a: unknown[]) => mockWslListDistros(...a),
  wslListOnline: (...a: unknown[]) => mockWslListOnline(...a),
  wslGetStatus: (...a: unknown[]) => mockWslGetStatus(...a),
  wslListRunning: (...a: unknown[]) => mockWslListRunning(...a),
  wslGetCapabilities: (...a: unknown[]) => mockWslGetCapabilities(...a),
  wslGetConfig: (...a: unknown[]) => mockWslGetConfig(...a),
  wslTerminate: (...a: unknown[]) => mockWslTerminate(...a),
  wslShutdown: (...a: unknown[]) => mockWslShutdown(...a),
  wslSetDefault: (...a: unknown[]) => mockWslSetDefault(...a),
  wslSetVersion: (...a: unknown[]) => mockWslSetVersion(...a),
  wslSetDefaultVersion: (...a: unknown[]) => mockWslSetDefaultVersion(...a),
  wslExport: (...a: unknown[]) => mockWslExport(...a),
  wslImport: (...a: unknown[]) => mockWslImport(...a),
  wslUpdate: (...a: unknown[]) => mockWslUpdate(...a),
  wslLaunch: (...a: unknown[]) => mockWslLaunch(...a),
  wslExec: (...a: unknown[]) => mockWslExec(...a),
  wslConvertPath: (...a: unknown[]) => mockWslConvertPath(...a),
  wslSetConfig: (...a: unknown[]) => mockWslSetConfig(...a),
  wslDiskUsage: (...a: unknown[]) => mockWslDiskUsage(...a),
  wslImportInPlace: (...a: unknown[]) => mockWslImportInPlace(...a),
  wslMount: (...a: unknown[]) => mockWslMount(...a),
  wslUnmount: (...a: unknown[]) => mockWslUnmount(...a),
  wslGetIp: (...a: unknown[]) => mockWslGetIp(...a),
  wslChangeDefaultUser: (...a: unknown[]) => mockWslChangeDefaultUser(...a),
  wslGetDistroConfig: (...a: unknown[]) => mockWslGetDistroConfig(...a),
  wslSetDistroConfig: (...a: unknown[]) => mockWslSetDistroConfig(...a),
  wslGetVersionInfo: (...a: unknown[]) => mockWslGetVersionInfo(...a),
  wslSetSparse: (...a: unknown[]) => mockWslSetSparse(...a),
  wslMoveDistro: (...a: unknown[]) => mockWslMoveDistro(...a),
  wslResizeDistro: (...a: unknown[]) => mockWslResizeDistro(...a),
  wslInstallWslOnly: (...a: unknown[]) => mockWslInstallWslOnly(...a),
  wslInstallWithLocation: (...a: unknown[]) => mockWslInstallWithLocation(...a),
  wslDetectDistroEnv: (...a: unknown[]) => mockWslDetectDistroEnv(...a),
  wslGetDistroResources: (...a: unknown[]) => mockWslGetDistroResources(...a),
  wslListUsers: (...a: unknown[]) => mockWslListUsers(...a),
  wslUpdateDistroPackages: (...a: unknown[]) => mockWslUpdateDistroPackages(...a),
}));

describe('useWsl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWsl());

    expect(result.current.available).toBeNull();
    expect(result.current.distros).toEqual([]);
    expect(result.current.onlineDistros).toEqual([]);
    expect(result.current.status).toBeNull();
    expect(result.current.runningDistros).toEqual([]);
    expect(result.current.config).toBeNull();
    expect(result.current.capabilities).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Availability ──

  it('should check availability', async () => {
    mockWslIsAvailable.mockResolvedValue(true);

    const { result } = renderHook(() => useWsl());

    let available;
    await act(async () => {
      available = await result.current.checkAvailability();
    });

    expect(available).toBe(true);
    expect(result.current.available).toBe(true);
  });

  it('should return false when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    let available;
    await act(async () => {
      available = await result.current.checkAvailability();
    });

    expect(available).toBe(false);
    expect(result.current.available).toBe(false);
    expect(result.current.capabilities).toBeNull();
  });

  it('should handle availability check error', async () => {
    mockWslIsAvailable.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useWsl());

    let available;
    await act(async () => {
      available = await result.current.checkAvailability();
    });

    expect(available).toBe(false);
    expect(result.current.available).toBe(false);
  });

  // ── Refresh actions ──

  it('should refresh distros', async () => {
    const distros = [{ name: 'Ubuntu', state: 'Running', version: 2, isDefault: true }];
    mockWslListDistros.mockResolvedValue(distros);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshDistros();
    });

    expect(result.current.distros).toEqual(distros);
    expect(result.current.loading).toBe(false);
  });

  it('should handle refreshDistros error', async () => {
    mockWslListDistros.mockRejectedValue(new Error('List failed'));

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshDistros();
    });

    expect(result.current.error).toContain('List failed');
  });

  it('should refresh online distros', async () => {
    const online = [['Ubuntu', 'Canonical'], ['Debian', 'Debian Project']];
    mockWslListOnline.mockResolvedValue(online);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshOnlineDistros();
    });

    expect(result.current.onlineDistros).toEqual(online);
  });

  it('should refresh status', async () => {
    const status = { kernelVersion: '5.15', wslVersion: '2.0.0' };
    mockWslGetStatus.mockResolvedValue(status);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshStatus();
    });

    expect(result.current.status).toEqual(status);
  });

  it('should refresh running', async () => {
    mockWslListRunning.mockResolvedValue(['Ubuntu', 'Debian']);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshRunning();
    });

    expect(result.current.runningDistros).toEqual(['Ubuntu', 'Debian']);
  });

  it('should refresh capabilities', async () => {
    const caps = { supportsSparse: true, supportsMove: true };
    mockWslGetCapabilities.mockResolvedValue(caps);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshCapabilities();
    });

    expect(result.current.capabilities).toEqual(caps);
  });

  it('should refresh config', async () => {
    const config = { sections: { wsl2: { memory: '4GB' } } };
    mockWslGetConfig.mockResolvedValue(config);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshConfig();
    });

    expect(result.current.config).toEqual(config);
  });

  it('should refreshAll with Promise.allSettled', async () => {
    mockWslListDistros.mockResolvedValue([{ name: 'Ubuntu' }]);
    mockWslListOnline.mockResolvedValue([]);
    mockWslGetStatus.mockResolvedValue({ kernelVersion: '5.15' });
    mockWslListRunning.mockResolvedValue(['Ubuntu']);
    mockWslGetConfig.mockResolvedValue(null);
    mockWslGetCapabilities.mockResolvedValue(null);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.distros).toHaveLength(1);
    expect(result.current.runningDistros).toEqual(['Ubuntu']);
    expect(result.current.loading).toBe(false);
  });

  it('should handle partial failures in refreshAll', async () => {
    mockWslListDistros.mockRejectedValue(new Error('fail'));
    mockWslListOnline.mockResolvedValue([['Debian', 'Debian']]);
    mockWslGetStatus.mockRejectedValue(new Error('fail'));
    mockWslListRunning.mockResolvedValue([]);
    mockWslGetConfig.mockResolvedValue(null);
    mockWslGetCapabilities.mockResolvedValue(null);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshAll();
    });

    // Successful ones should still be set
    expect(result.current.onlineDistros).toEqual([['Debian', 'Debian']]);
    expect(result.current.loading).toBe(false);
  });

  it('should skip refreshAll when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(mockWslListDistros).not.toHaveBeenCalled();
  });

  // ── Actions ──

  it('should terminate distro', async () => {
    mockWslTerminate.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);
    mockWslListRunning.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.terminate('Ubuntu');
    });

    expect(mockWslTerminate).toHaveBeenCalledWith('Ubuntu');
  });

  it('should handle terminate error', async () => {
    mockWslTerminate.mockRejectedValue(new Error('Terminate failed'));

    const { result } = renderHook(() => useWsl());

    let caughtMsg = '';
    await act(async () => {
      try {
        await result.current.terminate('Ubuntu');
      } catch (e) {
        caughtMsg = e instanceof Error ? e.message : String(e);
      }
    });

    expect(caughtMsg).toBe('Terminate failed');
    expect(result.current.error).toContain('Terminate failed');
  });

  it('should shutdown WSL', async () => {
    mockWslShutdown.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.shutdown();
    });

    expect(mockWslShutdown).toHaveBeenCalled();
    expect(result.current.runningDistros).toEqual([]);
  });

  it('should set default distro', async () => {
    mockWslSetDefault.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setDefault('Debian');
    });

    expect(mockWslSetDefault).toHaveBeenCalledWith('Debian');
  });

  it('should set version', async () => {
    mockWslSetVersion.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setVersion('Ubuntu', 2);
    });

    expect(mockWslSetVersion).toHaveBeenCalledWith('Ubuntu', 2);
  });

  it('should set default version', async () => {
    mockWslSetDefaultVersion.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setDefaultVersion(2);
    });

    expect(mockWslSetDefaultVersion).toHaveBeenCalledWith(2);
  });

  it('should export distro', async () => {
    mockWslExport.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.exportDistro('Ubuntu', '/backup/ubuntu.tar', true);
    });

    expect(mockWslExport).toHaveBeenCalledWith('Ubuntu', '/backup/ubuntu.tar', true);
    expect(result.current.loading).toBe(false);
  });

  it('should import distro', async () => {
    mockWslImport.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    const opts = { name: 'TestDistro', installLocation: '/wsl', sourcePath: '/backup.tar' };
    await act(async () => {
      await result.current.importDistro(opts as never);
    });

    expect(mockWslImport).toHaveBeenCalledWith(opts);
  });

  it('should update WSL', async () => {
    mockWslUpdate.mockResolvedValue('Updated to 2.1.0');
    mockWslGetStatus.mockResolvedValue({ wslVersion: '2.1.0' });

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.updateWsl();
    });

    expect(res).toBe('Updated to 2.1.0');
  });

  it('should launch distro', async () => {
    mockWslLaunch.mockResolvedValue(undefined);
    mockWslListRunning.mockResolvedValue(['Ubuntu']);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.launch('Ubuntu', 'root');
    });

    expect(mockWslLaunch).toHaveBeenCalledWith('Ubuntu', 'root');
  });

  it('should exec command', async () => {
    const execResult = { stdout: 'hello', stderr: '', exitCode: 0 };
    mockWslExec.mockResolvedValue(execResult);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.execCommand('Ubuntu', 'echo hello');
    });

    expect(res).toEqual(execResult);
  });

  it('should return fallback when not in Tauri for execCommand', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.execCommand('Ubuntu', 'echo hello');
    });

    expect(res).toEqual({ stdout: '', stderr: 'Not in Tauri environment', exitCode: 1 });
  });

  it('should convert path', async () => {
    mockWslConvertPath.mockResolvedValue('/mnt/c/Users');

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.convertPath('C:\\Users', 'Ubuntu', false);
    });

    expect(res).toBe('/mnt/c/Users');
  });

  it('should return original path when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.convertPath('C:\\Users');
    });

    expect(res).toBe('C:\\Users');
  });

  it('should set config value', async () => {
    mockWslSetConfig.mockResolvedValue(undefined);
    mockWslGetConfig.mockResolvedValue({});

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setConfigValue('wsl2', 'memory', '4GB');
    });

    expect(mockWslSetConfig).toHaveBeenCalledWith('wsl2', 'memory', '4GB');
  });

  it('should get disk usage', async () => {
    const usage = { total: 1024, used: 512, available: 512 };
    mockWslDiskUsage.mockResolvedValue(usage);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getDiskUsage('Ubuntu');
    });

    expect(res).toEqual(usage);
  });

  it('should return null for disk usage on error', async () => {
    mockWslDiskUsage.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getDiskUsage('Ubuntu');
    });

    expect(res).toBeNull();
  });

  it('should import in place', async () => {
    mockWslImportInPlace.mockResolvedValue(undefined);
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.importInPlace('TestDistro', '/path/to/disk.vhdx');
    });

    expect(mockWslImportInPlace).toHaveBeenCalledWith('TestDistro', '/path/to/disk.vhdx');
  });

  it('should mount disk', async () => {
    mockWslMount.mockResolvedValue('/mnt/wsl/PhysicalDrive0');

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.mountDisk({ diskPath: '\\\\.\\PhysicalDrive0' } as never);
    });

    expect(res).toBe('/mnt/wsl/PhysicalDrive0');
  });

  it('should unmount disk', async () => {
    mockWslUnmount.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.unmountDisk('/mnt/wsl/PhysicalDrive0');
    });

    expect(mockWslUnmount).toHaveBeenCalledWith('/mnt/wsl/PhysicalDrive0');
  });

  it('should get IP address', async () => {
    mockWslGetIp.mockResolvedValue('172.17.0.1');

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getIpAddress('Ubuntu');
    });

    expect(res).toBe('172.17.0.1');
  });

  it('should change default user', async () => {
    mockWslChangeDefaultUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.changeDefaultUser('Ubuntu', 'dev');
    });

    expect(mockWslChangeDefaultUser).toHaveBeenCalledWith('Ubuntu', 'dev');
  });

  it('should get distro config', async () => {
    const cfg = { sections: { automount: { enabled: 'true' } } };
    mockWslGetDistroConfig.mockResolvedValue(cfg);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getDistroConfig('Ubuntu');
    });

    expect(res).toEqual(cfg);
  });

  it('should return null for distro config on error', async () => {
    mockWslGetDistroConfig.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getDistroConfig('Ubuntu');
    });

    expect(res).toBeNull();
  });

  it('should set distro config value', async () => {
    mockWslSetDistroConfig.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setDistroConfigValue('Ubuntu', 'automount', 'enabled', 'true');
    });

    expect(mockWslSetDistroConfig).toHaveBeenCalledWith('Ubuntu', 'automount', 'enabled', 'true');
  });

  it('should get version info', async () => {
    const info = { wslVersion: '2.0.0', kernelVersion: '5.15' };
    mockWslGetVersionInfo.mockResolvedValue(info);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getVersionInfo();
    });

    expect(res).toEqual(info);
  });

  it('should return null for version info on error', async () => {
    mockWslGetVersionInfo.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getVersionInfo();
    });

    expect(res).toBeNull();
  });

  it('should get capabilities', async () => {
    const caps = { supportsSparse: true };
    mockWslGetCapabilities.mockResolvedValue(caps);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getCapabilities();
    });

    expect(res).toEqual(caps);
    expect(result.current.capabilities).toEqual(caps);
  });

  it('should set sparse', async () => {
    mockWslSetSparse.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.setSparse('Ubuntu', true);
    });

    expect(mockWslSetSparse).toHaveBeenCalledWith('Ubuntu', true);
  });

  it('should move distro', async () => {
    mockWslMoveDistro.mockResolvedValue('Moved successfully');
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.moveDistro('Ubuntu', '/new/location');
    });

    expect(res).toBe('Moved successfully');
  });

  it('should resize distro', async () => {
    mockWslResizeDistro.mockResolvedValue('Resized successfully');
    mockWslListDistros.mockResolvedValue([]);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.resizeDistro('Ubuntu', '50GB');
    });

    expect(res).toBe('Resized successfully');
  });

  it('should install WSL only', async () => {
    mockWslInstallWslOnly.mockResolvedValue('Installed');

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.installWslOnly();
    });

    expect(res).toBe('Installed');
  });

  it('should install with location', async () => {
    mockWslInstallWithLocation.mockResolvedValue('Installed Ubuntu');

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.installWithLocation('Ubuntu', '/custom/path');
    });

    expect(res).toBe('Installed Ubuntu');
  });

  it('should detect distro env', async () => {
    const env = { os: 'Ubuntu 22.04', packageManager: 'apt' };
    mockWslDetectDistroEnv.mockResolvedValue(env);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.detectDistroEnv('Ubuntu');
    });

    expect(res).toEqual(env);
  });

  it('should return null for detectDistroEnv on error', async () => {
    mockWslDetectDistroEnv.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.detectDistroEnv('Ubuntu');
    });

    expect(res).toBeNull();
  });

  it('should get distro resources', async () => {
    const resources = { cpuCount: 4, memoryMB: 8192 };
    mockWslGetDistroResources.mockResolvedValue(resources);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.getDistroResources('Ubuntu');
    });

    expect(res).toEqual(resources);
  });

  it('should list users', async () => {
    const users = [{ name: 'root', uid: 0 }, { name: 'dev', uid: 1000 }];
    mockWslListUsers.mockResolvedValue(users);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.listUsers('Ubuntu');
    });

    expect(res).toEqual(users);
  });

  it('should return empty array for listUsers when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.listUsers('Ubuntu');
    });

    expect(res).toEqual([]);
  });

  it('should update distro packages', async () => {
    const updateResult = { updated: 5, errors: 0 };
    mockWslUpdateDistroPackages.mockResolvedValue(updateResult);

    const { result } = renderHook(() => useWsl());

    let res;
    await act(async () => {
      res = await result.current.updateDistroPackages('Ubuntu', 'full');
    });

    expect(res).toEqual(updateResult);
    expect(mockWslUpdateDistroPackages).toHaveBeenCalledWith('Ubuntu', 'full');
  });

  it('should throw when updateDistroPackages not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    await expect(
      act(async () => {
        await result.current.updateDistroPackages('Ubuntu', 'full');
      }),
    ).rejects.toThrow('Not in Tauri environment');
  });

  // ── Non-Tauri guards ──

  it('should skip actions when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useWsl());

    await act(async () => {
      await result.current.refreshDistros();
      await result.current.refreshOnlineDistros();
      await result.current.refreshStatus();
      await result.current.refreshRunning();
      await result.current.refreshCapabilities();
      await result.current.refreshConfig();
      await result.current.terminate('Ubuntu');
      await result.current.shutdown();
      await result.current.setDefault('Ubuntu');
      await result.current.setVersion('Ubuntu', 2);
      await result.current.setDefaultVersion(2);
      await result.current.exportDistro('Ubuntu', '/path', false);
      await result.current.importDistro({} as never);
      const updateRes = await result.current.updateWsl();
      await result.current.launch('Ubuntu');
      const mountRes = await result.current.mountDisk({} as never);
      await result.current.unmountDisk();
      const ipRes = await result.current.getIpAddress();
      await result.current.changeDefaultUser('Ubuntu', 'user');
      const configRes = await result.current.getDistroConfig('Ubuntu');
      await result.current.setDistroConfigValue('Ubuntu', 's', 'k');
      const verRes = await result.current.getVersionInfo();
      const capsRes = await result.current.getCapabilities();
      await result.current.setSparse('Ubuntu', true);
      const moveRes = await result.current.moveDistro('Ubuntu', '/p');
      const resizeRes = await result.current.resizeDistro('Ubuntu', '50GB');
      const installRes = await result.current.installWslOnly();
      const installLocRes = await result.current.installWithLocation('Ubuntu', '/p');
      const envRes = await result.current.detectDistroEnv('Ubuntu');
      const resourcesRes = await result.current.getDistroResources('Ubuntu');
      const diskRes = await result.current.getDiskUsage('Ubuntu');
      await result.current.importInPlace('Ubuntu', '/p');

      expect(updateRes).toBe('');
      expect(mountRes).toBe('');
      expect(ipRes).toBe('');
      expect(configRes).toBeNull();
      expect(verRes).toBeNull();
      expect(capsRes).toBeNull();
      expect(moveRes).toBe('');
      expect(resizeRes).toBe('');
      expect(installRes).toBe('');
      expect(installLocRes).toBe('');
      expect(envRes).toBeNull();
      expect(resourcesRes).toBeNull();
      expect(diskRes).toBeNull();
    });

    // None of the actual Tauri functions should have been called
    expect(mockWslListDistros).not.toHaveBeenCalled();
    expect(mockWslTerminate).not.toHaveBeenCalled();
  });
});
