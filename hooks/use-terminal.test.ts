import { act, renderHook, waitFor } from '@testing-library/react';
import { useTerminal } from './use-terminal';
import type { LaunchResult, ShellFrameworkInfo } from '@/types/tauri';
import { toast } from 'sonner';

const mockTerminalDetectShells = jest.fn();
const mockTerminalListProfiles = jest.fn();
const mockTerminalLaunchProfileDetailed = jest.fn();
const mockTerminalDetectFramework = jest.fn();
const mockTerminalReadConfig = jest.fn();
const mockTerminalParseConfigContent = jest.fn();
const mockTerminalGetConfigEntries = jest.fn();
const mockTerminalGetFrameworkCacheStats = jest.fn();
const mockTerminalCleanFrameworkCache = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => true,
}));

jest.mock('@/lib/tauri', () => ({
  terminalDetectShells: (...args: unknown[]) => mockTerminalDetectShells(...args),
  terminalListProfiles: (...args: unknown[]) => mockTerminalListProfiles(...args),
  terminalLaunchProfileDetailed: (...args: unknown[]) => mockTerminalLaunchProfileDetailed(...args),
  terminalDetectFramework: (...args: unknown[]) => mockTerminalDetectFramework(...args),
  terminalCreateProfile: jest.fn(),
  terminalUpdateProfile: jest.fn(),
  terminalDeleteProfile: jest.fn(),
  terminalSetDefaultProfile: jest.fn(),
  terminalReadConfig: (...args: unknown[]) => mockTerminalReadConfig(...args),
  terminalBackupConfig: jest.fn(),
  terminalAppendToConfig: jest.fn(),
  terminalGetConfigEntries: (...args: unknown[]) => mockTerminalGetConfigEntries(...args),
  terminalParseConfigContent: (...args: unknown[]) => mockTerminalParseConfigContent(...args),
  terminalPsListProfiles: jest.fn(),
  terminalPsReadProfile: jest.fn(),
  terminalPsWriteProfile: jest.fn(),
  terminalPsGetExecutionPolicy: jest.fn(),
  terminalPsSetExecutionPolicy: jest.fn(),
  terminalPsListAllModules: jest.fn(),
  terminalPsListInstalledScripts: jest.fn(),
  terminalListPlugins: jest.fn(),
  terminalGetShellEnvVars: jest.fn(),
  terminalGetProxyEnvVars: jest.fn(),
  terminalGetFrameworkCacheStats: (...args: unknown[]) => mockTerminalGetFrameworkCacheStats(...args),
  terminalCleanFrameworkCache: (...args: unknown[]) => mockTerminalCleanFrameworkCache(...args),
  terminalGetSingleFrameworkCacheInfo: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalDetectShells.mockResolvedValue([]);
    mockTerminalListProfiles.mockResolvedValue([]);
    mockTerminalDetectFramework.mockResolvedValue([]);
    mockTerminalReadConfig.mockResolvedValue('');
    mockTerminalParseConfigContent.mockResolvedValue({ aliases: [], exports: [], sources: [] });
    mockTerminalGetConfigEntries.mockResolvedValue({ aliases: [], exports: [], sources: [] });
    mockTerminalGetFrameworkCacheStats.mockResolvedValue([]);
    mockTerminalCleanFrameworkCache.mockResolvedValue(0);
  });

  it('launchProfile updates launching state and stores detailed result', async () => {
    let resolveLaunch: ((value: LaunchResult) => void) | null = null;
    mockTerminalLaunchProfileDetailed.mockImplementation(
      () =>
        new Promise<LaunchResult>((resolve) => {
          resolveLaunch = resolve;
        }),
    );

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockTerminalListProfiles).toHaveBeenCalledTimes(1));

    act(() => {
      void result.current.launchProfile('profile-1');
    });

    await waitFor(() => expect(result.current.launchingProfileId).toBe('profile-1'));

    const launchResult: LaunchResult = {
      success: true,
      exitCode: 0,
      stdout: 'done',
      stderr: '',
    };
    act(() => {
      resolveLaunch?.(launchResult);
    });

    await waitFor(() => expect(result.current.launchingProfileId).toBeNull());
    expect(result.current.lastLaunchResult).toEqual({
      profileId: 'profile-1',
      result: launchResult,
    });
    expect(toast.success).toHaveBeenCalledWith('Profile launched');
  });

  it('launchProfile records failed result when backend throws', async () => {
    mockTerminalLaunchProfileDetailed.mockRejectedValue(new Error('launch failed'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.launchProfile('profile-err');
    });

    expect(result.current.launchingProfileId).toBeNull();
    expect(result.current.lastLaunchResult?.profileId).toBe('profile-err');
    expect(result.current.lastLaunchResult?.result.success).toBe(false);
    expect(result.current.lastLaunchResult?.result.stderr).toContain('Error: launch failed');
    expect(toast.error).toHaveBeenCalledWith('Failed to launch profile: Error: launch failed');

    act(() => {
      result.current.clearLaunchResult();
    });
    expect(result.current.lastLaunchResult).toBeNull();
  });

  it('detectFrameworks merges by shell type and replaces only matching shell results', async () => {
    const bashFrameworks1: ShellFrameworkInfo[] = [
      {
        name: 'bash-fw-old',
        version: '1.0.0',
        path: '/tmp/bash-fw-old',
        shellType: 'bash',
        category: 'framework',
        description: 'Old bash framework',
        homepage: null,
        configPath: null,
        activeTheme: null,
      },
    ];
    const bashFrameworks2: ShellFrameworkInfo[] = [
      {
        name: 'bash-fw-new',
        version: '2.0.0',
        path: '/tmp/bash-fw-new',
        shellType: 'bash',
        category: 'framework',
        description: 'New bash framework',
        homepage: null,
        configPath: null,
        activeTheme: null,
      },
    ];
    const powershellFrameworks: ShellFrameworkInfo[] = [
      {
        name: 'pwsh-fw',
        version: null,
        path: 'C:/pwsh-fw',
        shellType: 'powershell',
        category: 'prompt-engine',
        description: 'PowerShell framework',
        homepage: null,
        configPath: null,
        activeTheme: null,
      },
    ];

    mockTerminalDetectFramework.mockImplementation(async (shellType: string) => {
      if (shellType === 'bash') {
        return mockTerminalDetectFramework.mock.calls.length === 1
          ? bashFrameworks1
          : bashFrameworks2;
      }
      return powershellFrameworks;
    });

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.detectFrameworks('bash');
    });
    expect(result.current.frameworks).toEqual(bashFrameworks1);

    await act(async () => {
      await result.current.detectFrameworks('powershell');
    });
    expect(result.current.frameworks).toEqual([...bashFrameworks1, ...powershellFrameworks]);

    await act(async () => {
      await result.current.detectFrameworks('bash');
    });
    expect(result.current.frameworks).toEqual([...powershellFrameworks, ...bashFrameworks2]);
  });

  it('readShellConfig returns content from backend', async () => {
    mockTerminalReadConfig.mockResolvedValue('export PATH="/usr/bin"');

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let content = '';
    await act(async () => {
      content = await result.current.readShellConfig('/home/user/.bashrc');
    });

    expect(mockTerminalReadConfig).toHaveBeenCalledWith('/home/user/.bashrc');
    expect(content).toBe('export PATH="/usr/bin"');
  });

  it('readShellConfig returns empty string and toasts on error', async () => {
    mockTerminalReadConfig.mockRejectedValue(new Error('read failed'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let content = 'should-be-empty';
    await act(async () => {
      content = await result.current.readShellConfig('/nonexistent');
    });

    expect(content).toBe('');
    expect(toast.error).toHaveBeenCalledWith('Failed to read config: Error: read failed');
  });

  it('parseConfigContent calls terminalParseConfigContent', async () => {
    const mockEntries = {
      aliases: [['ll', 'ls -la'] as [string, string]],
      exports: [] as [string, string][],
      sources: [] as string[],
    };
    mockTerminalParseConfigContent.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries = null;
    await act(async () => {
      entries = await result.current.parseConfigContent('alias ll="ls -la"', 'bash');
    });

    expect(mockTerminalParseConfigContent).toHaveBeenCalledWith('alias ll="ls -la"', 'bash');
    expect(entries).toEqual(mockEntries);
  });

  it('parseConfigContent returns null and toasts on error', async () => {
    mockTerminalParseConfigContent.mockRejectedValue(new Error('parse error'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries: unknown = 'should-be-null';
    await act(async () => {
      entries = await result.current.parseConfigContent('bad content', 'bash');
    });

    expect(entries).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Failed to parse config: Error: parse error');
  });

  it('fetchConfigEntries calls terminalGetConfigEntries', async () => {
    const mockEntries = {
      aliases: [] as [string, string][],
      exports: [['EDITOR', 'vim'] as [string, string]],
      sources: [] as string[],
    };
    mockTerminalGetConfigEntries.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries = null;
    await act(async () => {
      entries = await result.current.fetchConfigEntries('/home/user/.bashrc', 'bash');
    });

    expect(mockTerminalGetConfigEntries).toHaveBeenCalledWith('/home/user/.bashrc', 'bash');
    expect(entries).toEqual(mockEntries);
  });

  it('fetchConfigEntries returns null and toasts on error', async () => {
    mockTerminalGetConfigEntries.mockRejectedValue(new Error('fetch error'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries: unknown = 'should-be-null';
    await act(async () => {
      entries = await result.current.fetchConfigEntries('/bad/path', 'zsh');
    });

    expect(entries).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Failed to parse config: Error: fetch error');
  });

  // ── Framework Cache Management tests ──

  it('fetchFrameworkCacheStats loads cache stats into state', async () => {
    const mockStats = [
      {
        frameworkName: 'Oh My Posh',
        cachePaths: ['/tmp/oh-my-posh'],
        totalSize: 2048,
        totalSizeHuman: '2.0 KB',
        canClean: true,
        description: 'Cache files for Oh My Posh',
      },
      {
        frameworkName: 'Starship',
        cachePaths: [],
        totalSize: 0,
        totalSizeHuman: '0 B',
        canClean: false,
        description: 'Cache files for Starship',
      },
    ];
    mockTerminalGetFrameworkCacheStats.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.fetchFrameworkCacheStats();
    });

    expect(mockTerminalGetFrameworkCacheStats).toHaveBeenCalledTimes(1);
    expect(result.current.frameworkCacheStats).toEqual(mockStats);
    expect(result.current.frameworkCacheLoading).toBe(false);
  });

  it('fetchFrameworkCacheStats sets loading state while fetching', async () => {
    let resolveStats: ((v: unknown[]) => void) | null = null;
    mockTerminalGetFrameworkCacheStats.mockImplementation(
      () => new Promise((resolve) => { resolveStats = resolve; }),
    );

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    act(() => {
      void result.current.fetchFrameworkCacheStats();
    });

    await waitFor(() => expect(result.current.frameworkCacheLoading).toBe(true));

    await act(async () => {
      resolveStats?.([]);
    });

    expect(result.current.frameworkCacheLoading).toBe(false);
  });

  it('fetchFrameworkCacheStats toasts on error', async () => {
    mockTerminalGetFrameworkCacheStats.mockRejectedValue(new Error('cache scan failed'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.fetchFrameworkCacheStats();
    });

    expect(result.current.frameworkCacheLoading).toBe(false);
    expect(result.current.frameworkCacheStats).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to load framework cache stats: Error: cache scan failed',
    );
  });

  it('cleanFrameworkCache calls backend and refreshes stats', async () => {
    mockTerminalCleanFrameworkCache.mockResolvedValue(5242880); // 5 MB
    mockTerminalGetFrameworkCacheStats.mockResolvedValue([]);

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.cleanFrameworkCache('Oh My Posh');
    });

    expect(mockTerminalCleanFrameworkCache).toHaveBeenCalledWith('Oh My Posh');
    expect(toast.success).toHaveBeenCalledWith('Cleaned 5.0 MB from Oh My Posh cache');
    // Should refresh stats after clean
    expect(mockTerminalGetFrameworkCacheStats).toHaveBeenCalled();
  });

  it('cleanFrameworkCache toasts on error', async () => {
    mockTerminalCleanFrameworkCache.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.cleanFrameworkCache('Starship');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to clean Starship cache: Error: permission denied',
    );
  });

  it('initial state has empty frameworkCacheStats and false frameworkCacheLoading', async () => {
    const { result } = renderHook(() => useTerminal());
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    expect(result.current.frameworkCacheStats).toEqual([]);
    expect(result.current.frameworkCacheLoading).toBe(false);
  });
});
