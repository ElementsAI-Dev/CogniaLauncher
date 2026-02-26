import { renderHook, act } from '@testing-library/react';
import { useEnvVar } from './use-envvar';

// Mock tauri module
const mockEnvvarListAll = jest.fn();
const mockEnvvarGet = jest.fn();
const mockEnvvarSetProcess = jest.fn();
const mockEnvvarRemoveProcess = jest.fn();
const mockEnvvarGetPath = jest.fn();
const mockEnvvarListShellProfiles = jest.fn();
const mockEnvvarImportEnvFile = jest.fn();
const mockEnvvarExportEnvFile = jest.fn();

jest.mock('@/lib/tauri', () => ({
  envvarListAll: (...args: unknown[]) => mockEnvvarListAll(...args),
  envvarGet: (...args: unknown[]) => mockEnvvarGet(...args),
  envvarSetProcess: (...args: unknown[]) => mockEnvvarSetProcess(...args),
  envvarRemoveProcess: (...args: unknown[]) => mockEnvvarRemoveProcess(...args),
  envvarSetPersistent: jest.fn(),
  envvarRemovePersistent: jest.fn(),
  envvarGetPath: (...args: unknown[]) => mockEnvvarGetPath(...args),
  envvarAddPathEntry: jest.fn(),
  envvarRemovePathEntry: jest.fn(),
  envvarReorderPath: jest.fn(),
  envvarListShellProfiles: (...args: unknown[]) => mockEnvvarListShellProfiles(...args),
  envvarReadShellProfile: jest.fn(),
  envvarImportEnvFile: (...args: unknown[]) => mockEnvvarImportEnvFile(...args),
  envvarExportEnvFile: (...args: unknown[]) => mockEnvvarExportEnvFile(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => String(err),
}));

describe('useEnvVar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEnvVar());

    expect(result.current.envVars).toEqual({});
    expect(result.current.pathEntries).toEqual([]);
    expect(result.current.shellProfiles).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch all vars and update state', async () => {
    const mockVars = { PATH: '/usr/bin', HOME: '/home/user' };
    mockEnvvarListAll.mockResolvedValue(mockVars);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    expect(result.current.envVars).toEqual(mockVars);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetchAllVars error', async () => {
    mockEnvvarListAll.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    expect(result.current.envVars).toEqual({});
    expect(result.current.error).toBe('Error: fetch failed');
  });

  it('should get a specific var', async () => {
    mockEnvvarGet.mockResolvedValue('/usr/bin');

    const { result } = renderHook(() => useEnvVar());

    let value: string | null = null;
    await act(async () => {
      value = await result.current.getVar('PATH');
    });

    expect(value).toBe('/usr/bin');
    expect(mockEnvvarGet).toHaveBeenCalledWith('PATH');
  });

  it('should set a process var and update local state', async () => {
    mockEnvvarSetProcess.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    let success = false;
    await act(async () => {
      success = await result.current.setVar('MY_VAR', 'my_value', 'process');
    });

    expect(success).toBe(true);
    expect(mockEnvvarSetProcess).toHaveBeenCalledWith('MY_VAR', 'my_value');
    expect(result.current.envVars).toHaveProperty('MY_VAR', 'my_value');
  });

  it('should remove a process var and update local state', async () => {
    mockEnvvarListAll.mockResolvedValue({ FOO: 'bar', BAZ: 'qux' });
    mockEnvvarRemoveProcess.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchAllVars();
    });

    await act(async () => {
      await result.current.removeVar('FOO', 'process');
    });

    expect(result.current.envVars).not.toHaveProperty('FOO');
    expect(result.current.envVars).toHaveProperty('BAZ', 'qux');
  });

  it('should fetch path entries', async () => {
    const mockEntries = [
      { path: '/usr/bin', exists: true, isDirectory: true },
      { path: '/missing', exists: false, isDirectory: false },
    ];
    mockEnvvarGetPath.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchPath('process');
    });

    expect(result.current.pathEntries).toEqual(mockEntries);
    expect(mockEnvvarGetPath).toHaveBeenCalledWith('process');
  });

  it('should fetch shell profiles', async () => {
    const mockProfiles = [
      { shell: 'powershell', configPath: 'C:/profile.ps1', exists: true, isCurrent: true },
    ];
    mockEnvvarListShellProfiles.mockResolvedValue(mockProfiles);

    const { result } = renderHook(() => useEnvVar());

    await act(async () => {
      await result.current.fetchShellProfiles();
    });

    expect(result.current.shellProfiles).toEqual(mockProfiles);
  });

  it('should import env file', async () => {
    const mockResult = { imported: 3, skipped: 0, errors: [] };
    mockEnvvarImportEnvFile.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useEnvVar());

    let importResult = null;
    await act(async () => {
      importResult = await result.current.importEnvFile('FOO=bar\nBAZ=qux\nHELLO=world', 'process');
    });

    expect(importResult).toEqual(mockResult);
    expect(mockEnvvarImportEnvFile).toHaveBeenCalledWith('FOO=bar\nBAZ=qux\nHELLO=world', 'process');
  });

  it('should export env file', async () => {
    const mockContent = 'FOO=bar\nBAZ=qux';
    mockEnvvarExportEnvFile.mockResolvedValue(mockContent);

    const { result } = renderHook(() => useEnvVar());

    let content = null;
    await act(async () => {
      content = await result.current.exportEnvFile('process', 'dotenv');
    });

    expect(content).toBe(mockContent);
    expect(mockEnvvarExportEnvFile).toHaveBeenCalledWith('process', 'dotenv');
  });
});
