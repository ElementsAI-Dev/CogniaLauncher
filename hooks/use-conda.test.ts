import { act, renderHook } from '@testing-library/react';
import { useConda } from './use-conda';

const mockIsTauri = jest.fn(() => true);
const mockCondaEnvList = jest.fn();
const mockCondaEnvCreate = jest.fn();
const mockCondaEnvRemove = jest.fn();
const mockCondaEnvClone = jest.fn();
const mockCondaEnvExport = jest.fn();
const mockCondaEnvImport = jest.fn();
const mockCondaEnvRename = jest.fn();
const mockCondaGetInfo = jest.fn();
const mockCondaConfigShow = jest.fn();
const mockCondaConfigSet = jest.fn();
const mockCondaChannelAdd = jest.fn();
const mockCondaChannelRemove = jest.fn();
const mockCondaClean = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  condaEnvList: (...args: unknown[]) => mockCondaEnvList(...args),
  condaEnvCreate: (...args: unknown[]) => mockCondaEnvCreate(...args),
  condaEnvRemove: (...args: unknown[]) => mockCondaEnvRemove(...args),
  condaEnvClone: (...args: unknown[]) => mockCondaEnvClone(...args),
  condaEnvExport: (...args: unknown[]) => mockCondaEnvExport(...args),
  condaEnvImport: (...args: unknown[]) => mockCondaEnvImport(...args),
  condaEnvRename: (...args: unknown[]) => mockCondaEnvRename(...args),
  condaGetInfo: (...args: unknown[]) => mockCondaGetInfo(...args),
  condaConfigShow: (...args: unknown[]) => mockCondaConfigShow(...args),
  condaConfigSet: (...args: unknown[]) => mockCondaConfigSet(...args),
  condaChannelAdd: (...args: unknown[]) => mockCondaChannelAdd(...args),
  condaChannelRemove: (...args: unknown[]) => mockCondaChannelRemove(...args),
  condaClean: (...args: unknown[]) => mockCondaClean(...args),
}));

describe('useConda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('lists environments and stores the fetched result', async () => {
    const environments = [{ name: 'base', path: '/opt/conda' }];
    mockCondaEnvList.mockResolvedValue(environments);

    const { result } = renderHook(() => useConda());

    let fetched;
    await act(async () => {
      fetched = await result.current.listEnvironments();
    });

    expect(fetched).toEqual(environments);
    expect(result.current.environments).toEqual(environments);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures backend failures and rethrows them', async () => {
    mockCondaGetInfo.mockRejectedValue(new Error('conda missing'));

    const { result } = renderHook(() => useConda());

    let message = '';
    await act(async () => {
      try {
        await result.current.getInfo();
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
    });

    expect(message).toBe('conda missing');
    expect(result.current.error).toBe('conda missing');
    expect(result.current.loading).toBe(false);
  });

  it('refreshes available state while tolerating partial backend failures', async () => {
    const info = { platform: 'linux-64', condaVersion: '24.1.0' };
    mockCondaEnvList.mockRejectedValue(new Error('env list failed'));
    mockCondaGetInfo.mockResolvedValue(info);
    mockCondaConfigShow.mockResolvedValue('channels:\n  - defaults');

    const { result } = renderHook(() => useConda());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.environments).toEqual([]);
    expect(result.current.info).toEqual(info);
    expect(result.current.config).toBe('channels:\n  - defaults');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('forwards environment, config, and cleanup operations to tauri helpers', async () => {
    mockCondaEnvCreate.mockResolvedValue(undefined);
    mockCondaEnvRemove.mockResolvedValue(undefined);
    mockCondaEnvClone.mockResolvedValue(undefined);
    mockCondaEnvExport.mockResolvedValue({ path: '/tmp/env.yml' });
    mockCondaEnvImport.mockResolvedValue(undefined);
    mockCondaEnvRename.mockResolvedValue(undefined);
    mockCondaConfigShow.mockResolvedValue('channels:\n  - conda-forge');
    mockCondaConfigSet.mockResolvedValue(undefined);
    mockCondaChannelAdd.mockResolvedValue(undefined);
    mockCondaChannelRemove.mockResolvedValue(undefined);
    mockCondaClean.mockResolvedValue('cleaned');

    const { result } = renderHook(() => useConda());

    let exported;
    let config;
    let cleanOutput;
    await act(async () => {
      await result.current.createEnvironment('py311', '3.11', ['numpy']);
      await result.current.removeEnvironment('legacy');
      await result.current.cloneEnvironment('base', 'clone');
      exported = await result.current.exportEnvironment('base', true);
      await result.current.importEnvironment('/tmp/env.yml', 'restored');
      await result.current.renameEnvironment('old-name', 'new-name');
      config = await result.current.getConfig();
      await result.current.setConfig('auto_activate_base', 'false');
      await result.current.addChannel('conda-forge');
      await result.current.removeChannel('defaults');
      cleanOutput = await result.current.clean(true, true, false);
    });

    expect(mockCondaEnvCreate).toHaveBeenCalledWith('py311', '3.11', ['numpy']);
    expect(mockCondaEnvRemove).toHaveBeenCalledWith('legacy');
    expect(mockCondaEnvClone).toHaveBeenCalledWith('base', 'clone');
    expect(mockCondaEnvExport).toHaveBeenCalledWith('base', true);
    expect(exported).toEqual({ path: '/tmp/env.yml' });
    expect(mockCondaEnvImport).toHaveBeenCalledWith('/tmp/env.yml', 'restored');
    expect(mockCondaEnvRename).toHaveBeenCalledWith('old-name', 'new-name');
    expect(mockCondaConfigShow).toHaveBeenCalled();
    expect(config).toBe('channels:\n  - conda-forge');
    expect(result.current.config).toBe('channels:\n  - conda-forge');
    expect(mockCondaConfigSet).toHaveBeenCalledWith('auto_activate_base', 'false');
    expect(mockCondaChannelAdd).toHaveBeenCalledWith('conda-forge');
    expect(mockCondaChannelRemove).toHaveBeenCalledWith('defaults');
    expect(mockCondaClean).toHaveBeenCalledWith(true, true, false);
    expect(cleanOutput).toBe('cleaned');
  });

  it('captures refreshAll errors triggered before the per-call fallbacks attach', async () => {
    mockCondaEnvList.mockImplementation(() => {
      throw new Error('sync failure');
    });

    const { result } = renderHook(() => useConda());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.error).toBe('sync failure');
    expect(result.current.loading).toBe(false);
  });

  it('skips refresh when the frontend is not running in tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    const { result } = renderHook(() => useConda());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(mockCondaEnvList).not.toHaveBeenCalled();
    expect(mockCondaGetInfo).not.toHaveBeenCalled();
    expect(mockCondaConfigShow).not.toHaveBeenCalled();
  });
});
