import { act, renderHook, waitFor } from '@testing-library/react';
import { useTerminal } from './use-terminal';
import type { LaunchResult, ShellFrameworkInfo } from '@/types/tauri';
import { toast } from 'sonner';

const mockTerminalDetectShells = jest.fn();
const mockTerminalListProfiles = jest.fn();
const mockTerminalLaunchProfileDetailed = jest.fn();
const mockTerminalDetectFramework = jest.fn();
const mockTerminalMeasureStartup = jest.fn();
const mockTerminalCheckShellHealth = jest.fn();
const mockTerminalGetShellInfo = jest.fn();
const mockTerminalReadConfig = jest.fn();
const mockTerminalParseConfigContent = jest.fn();
const mockTerminalGetConfigEntries = jest.fn();
const mockTerminalValidateConfigContent = jest.fn();
const mockTerminalGetConfigEditorMetadata = jest.fn();
const mockTerminalRestoreConfigSnapshot = jest.fn();
const mockTerminalWriteConfigVerified = jest.fn();
const mockTerminalBackupConfigVerified = jest.fn();
const mockTerminalListTemplates = jest.fn();
const mockTerminalCreateCustomTemplate = jest.fn();
const mockTerminalGetFrameworkCacheStats = jest.fn();
const mockTerminalGetSingleFrameworkCacheInfo = jest.fn();
const mockTerminalCleanFrameworkCache = jest.fn();
const mockTerminalPsFindModule = jest.fn();
const mockTerminalPsGetModuleDetail = jest.fn();
const mockTerminalPsListAllModules = jest.fn();
const mockTerminalPsListInstalledScripts = jest.fn();
const mockTerminalPsInstallModule = jest.fn();
const mockTerminalPsUninstallModule = jest.fn();
const mockTerminalPsUpdateModule = jest.fn();
const mockConfigSet = jest.fn();
const mockConfigList = jest.fn();
const mockTerminalGetProxyEnvVars = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => true,
}));

jest.mock('@/lib/tauri', () => ({
  terminalDetectShells: (...args: unknown[]) => mockTerminalDetectShells(...args),
  terminalMeasureStartup: (...args: unknown[]) => mockTerminalMeasureStartup(...args),
  terminalCheckShellHealth: (...args: unknown[]) => mockTerminalCheckShellHealth(...args),
  terminalGetShellInfo: (...args: unknown[]) => mockTerminalGetShellInfo(...args),
  terminalListProfiles: (...args: unknown[]) => mockTerminalListProfiles(...args),
  terminalListTemplates: (...args: unknown[]) => mockTerminalListTemplates(...args),
  terminalLaunchProfileDetailed: (...args: unknown[]) => mockTerminalLaunchProfileDetailed(...args),
  terminalDetectFramework: (...args: unknown[]) => mockTerminalDetectFramework(...args),
  terminalCreateProfile: jest.fn(),
  terminalUpdateProfile: jest.fn(),
  terminalDeleteProfile: jest.fn(),
  terminalSetDefaultProfile: jest.fn(),
  terminalReadConfig: (...args: unknown[]) => mockTerminalReadConfig(...args),
  terminalBackupConfig: jest.fn(),
  terminalBackupConfigVerified: (...args: unknown[]) => mockTerminalBackupConfigVerified(...args),
  terminalAppendToConfig: jest.fn(),
  terminalAppendToConfigVerified: jest.fn(),
  terminalGetConfigEntries: (...args: unknown[]) => mockTerminalGetConfigEntries(...args),
  terminalParseConfigContent: (...args: unknown[]) => mockTerminalParseConfigContent(...args),
  terminalValidateConfigContent: (...args: unknown[]) => mockTerminalValidateConfigContent(...args),
  terminalGetConfigEditorMetadata: (...args: unknown[]) => mockTerminalGetConfigEditorMetadata(...args),
  terminalRestoreConfigSnapshot: (...args: unknown[]) => mockTerminalRestoreConfigSnapshot(...args),
  terminalPsListProfiles: jest.fn(),
  terminalPsReadProfile: jest.fn(),
  terminalPsWriteProfile: jest.fn(),
  terminalPsGetExecutionPolicy: jest.fn(),
  terminalPsSetExecutionPolicy: jest.fn(),
  terminalPsListAllModules: (...args: unknown[]) => mockTerminalPsListAllModules(...args),
  terminalPsGetModuleDetail: (...args: unknown[]) => mockTerminalPsGetModuleDetail(...args),
  terminalPsListInstalledScripts: (...args: unknown[]) => mockTerminalPsListInstalledScripts(...args),
  terminalPsFindModule: (...args: unknown[]) => mockTerminalPsFindModule(...args),
  terminalPsInstallModule: (...args: unknown[]) => mockTerminalPsInstallModule(...args),
  terminalPsUninstallModule: (...args: unknown[]) => mockTerminalPsUninstallModule(...args),
  terminalPsUpdateModule: (...args: unknown[]) => mockTerminalPsUpdateModule(...args),
  terminalCreateCustomTemplate: (...args: unknown[]) => mockTerminalCreateCustomTemplate(...args),
  terminalListPlugins: jest.fn(),
  terminalGetShellEnvVars: jest.fn(),
  terminalGetProxyEnvVars: (...args: unknown[]) => mockTerminalGetProxyEnvVars(...args),
  terminalWriteConfigVerified: (...args: unknown[]) => mockTerminalWriteConfigVerified(...args),
  configSet: (...args: unknown[]) => mockConfigSet(...args),
  configList: (...args: unknown[]) => mockConfigList(...args),
  terminalGetFrameworkCacheStats: (...args: unknown[]) => mockTerminalGetFrameworkCacheStats(...args),
  terminalGetSingleFrameworkCacheInfo: (...args: unknown[]) => mockTerminalGetSingleFrameworkCacheInfo(...args),
  terminalCleanFrameworkCache: (...args: unknown[]) => mockTerminalCleanFrameworkCache(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string, params?: Record<string, string | number>) => {
  if (params) {
    let result = key;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  }
  return key;
};

describe('useTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalDetectShells.mockResolvedValue([]);
    mockTerminalListProfiles.mockResolvedValue([]);
    mockTerminalListTemplates.mockResolvedValue([]);
    mockTerminalDetectFramework.mockResolvedValue([]);
    mockTerminalMeasureStartup.mockResolvedValue({
      shellId: 'bash',
      withProfileMs: 120,
      withoutProfileMs: 80,
      differenceMs: 40,
    });
    mockTerminalCheckShellHealth.mockResolvedValue({
      shellId: 'bash',
      status: 'healthy',
      issues: [],
    });
    mockTerminalGetShellInfo.mockResolvedValue({
      id: 'bash',
      name: 'Bash',
      shellType: 'bash',
      version: '5.2.0',
      executablePath: '/bin/bash',
      configFiles: [],
      isDefault: true,
    });
    mockTerminalReadConfig.mockResolvedValue('');
    mockTerminalParseConfigContent.mockResolvedValue({ aliases: [], exports: [], sources: [] });
    mockTerminalGetConfigEntries.mockResolvedValue({ aliases: [], exports: [], sources: [] });
    mockTerminalValidateConfigContent.mockResolvedValue([]);
    mockTerminalGetConfigEditorMetadata.mockResolvedValue({
      path: '/tmp/.bashrc',
      shellType: 'bash',
      language: 'bash',
      snapshotPath: '/tmp/.cognia/terminal-snapshots/.bashrc.latest',
      fingerprint: 'abc123',
    });
    mockTerminalRestoreConfigSnapshot.mockResolvedValue({
      path: '/tmp/.bashrc',
      snapshotPath: '/tmp/.cognia/terminal-snapshots/.bashrc.latest',
      bytesWritten: 12,
      verified: true,
      diagnostics: ['restored'],
      diagnosticDetails: [],
      fingerprint: 'abc123',
    });
    mockTerminalWriteConfigVerified.mockResolvedValue({
      operation: 'write',
      path: '/tmp/.bashrc',
      backupPath: null,
      bytesWritten: 12,
      verified: true,
      diagnostics: ['ok'],
    });
    mockTerminalBackupConfigVerified.mockResolvedValue({
      operation: 'backup',
      path: '/tmp/.bashrc',
      backupPath: '/tmp/.bashrc.bak',
      bytesWritten: 0,
      verified: true,
      diagnostics: ['ok'],
    });
    mockTerminalPsFindModule.mockResolvedValue([]);
    mockTerminalPsGetModuleDetail.mockResolvedValue({
      name: 'PSReadLine',
      version: '2.3.6',
      moduleType: 'Script',
      path: 'C:/Modules/PSReadLine',
      description: 'Interactive editing',
      exportedCommandsCount: 5,
    });
    mockTerminalPsListAllModules.mockResolvedValue([]);
    mockTerminalPsListInstalledScripts.mockResolvedValue([]);
    mockTerminalPsInstallModule.mockResolvedValue(undefined);
    mockTerminalPsUninstallModule.mockResolvedValue(undefined);
    mockTerminalPsUpdateModule.mockResolvedValue(undefined);
    mockTerminalCreateCustomTemplate.mockResolvedValue('custom-template-id');
    mockTerminalGetFrameworkCacheStats.mockResolvedValue([]);
    mockTerminalGetSingleFrameworkCacheInfo.mockResolvedValue({
      frameworkName: 'Oh My Zsh',
      cachePaths: ['/home/user/.oh-my-zsh/cache'],
      totalSize: 4096,
      totalSizeHuman: '4 KB',
      canClean: true,
      description: 'Cache files',
    });
    mockTerminalCleanFrameworkCache.mockResolvedValue(0);
    mockConfigSet.mockResolvedValue(undefined);
    mockConfigList.mockResolvedValue([
      ['terminal.proxy_mode', 'global'],
      ['terminal.custom_proxy', ''],
      ['terminal.no_proxy', ''],
      ['network.proxy', 'http://global:8080'],
    ]);
    mockTerminalGetProxyEnvVars.mockResolvedValue([['HTTP_PROXY', 'http://global:8080']]);
  });

  it('launchProfile updates launching state and stores detailed result', async () => {
    let resolveLaunch: ((value: LaunchResult) => void) | null = null;
    mockTerminalLaunchProfileDetailed.mockImplementation(
      () =>
        new Promise<LaunchResult>((resolve) => {
          resolveLaunch = resolve;
        }),
    );

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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
    expect(toast.success).toHaveBeenCalledWith('terminal.toastProfileLaunched');
  });

  it('launchProfile records failed result when backend throws', async () => {
    mockTerminalLaunchProfileDetailed.mockRejectedValue(new Error('launch failed'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.launchProfile('profile-err');
    });

    expect(result.current.launchingProfileId).toBeNull();
    expect(result.current.lastLaunchResult?.profileId).toBe('profile-err');
    expect(result.current.lastLaunchResult?.result.success).toBe(false);
    expect(result.current.lastLaunchResult?.result.stderr).toContain('Error: launch failed');
    expect(toast.error).toHaveBeenCalledWith('terminal.toastLaunchFailed');

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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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

  it('getShellInfo returns a backend shell record', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let shell = null;
    await act(async () => {
      shell = await result.current.getShellInfo('bash');
    });

    expect(mockTerminalGetShellInfo).toHaveBeenCalledWith('bash');
    expect(shell).toEqual(expect.objectContaining({
      id: 'bash',
      executablePath: '/bin/bash',
    }));
  });

  it('preserves last stable shell diagnostics while marking degraded readout on failure', async () => {
    mockTerminalCheckShellHealth
      .mockResolvedValueOnce({
        shellId: 'bash',
        status: 'healthy',
        issues: [],
      })
      .mockRejectedValueOnce(new Error('probe timeout'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.checkShellHealth('bash');
    });

    expect(result.current.healthResults.bash?.status).toBe('healthy');
    expect(result.current.shellReadouts.bash).toEqual(
      expect.objectContaining({
        shellId: 'bash',
        healthStatus: 'ready',
      }),
    );

    await act(async () => {
      await result.current.checkShellHealth('bash');
    });

    expect(result.current.healthResults.bash?.status).toBe('healthy');
    expect(result.current.shellReadouts.bash).toEqual(
      expect.objectContaining({
        shellId: 'bash',
        status: 'failed',
        degradedReason: 'Error: probe timeout',
        healthStatus: 'failed',
      }),
    );
  });

  it('searchPSModules returns PowerShell gallery results', async () => {
    mockTerminalPsFindModule.mockResolvedValue([
      {
        name: 'Pester',
        version: '5.7.1',
        moduleType: 'Script',
        path: 'gallery://Pester',
        description: 'PowerShell test framework',
        exportedCommandsCount: 42,
      },
    ]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let modules = [];
    await act(async () => {
      modules = await result.current.searchPSModules('Pester');
    });

    expect(mockTerminalPsFindModule).toHaveBeenCalledWith('Pester');
    expect(modules).toHaveLength(1);
  });

  it('getPSModuleDetail returns detail from backend', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let detail = null;
    await act(async () => {
      detail = await result.current.getPSModuleDetail('PSReadLine');
    });

    expect(mockTerminalPsGetModuleDetail).toHaveBeenCalledWith('PSReadLine');
    expect(detail).toEqual(expect.objectContaining({
      name: 'PSReadLine',
      exportedCommandsCount: 5,
    }));
  });

  it('createCustomTemplate creates and refreshes only template data', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.markResourcesFresh([
        'profiles',
        'configEntries',
        'configMetadata',
        'proxyConfig',
        'proxyEnvVars',
        'shellEnvVars',
        'psProfiles',
        'psModules',
        'psScripts',
        'executionPolicy',
      ]);
    });

    await act(async () => {
      await result.current.createCustomTemplate({
        id: '',
        name: 'Custom Template',
        description: 'Created in test',
        icon: 'terminal',
        category: 'custom',
        shellType: 'bash',
        args: [],
        envVars: {},
        cwd: null,
        startupCommand: 'echo hi',
        envType: null,
        envVersion: null,
        isBuiltin: false,
      });
    });

    expect(mockTerminalCreateCustomTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Custom Template',
      category: 'custom',
    }));
    expect(mockTerminalListTemplates).toHaveBeenCalledTimes(2);
    expect(result.current.resourceStale.templates).toBe(false);
    expect(result.current.resourceStale.psModules).toBe(false);
    expect(result.current.resourceStale.configEntries).toBe(false);
  });

  it('getSingleFrameworkCacheInfo returns a single-framework cache summary', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let info = null;
    await act(async () => {
      info = await result.current.getSingleFrameworkCacheInfo('Oh My Zsh', '/home/user/.oh-my-zsh', 'zsh');
    });

    expect(mockTerminalGetSingleFrameworkCacheInfo).toHaveBeenCalledWith(
      'Oh My Zsh',
      '/home/user/.oh-my-zsh',
      'zsh',
    );
    expect(info).toEqual(expect.objectContaining({
      frameworkName: 'Oh My Zsh',
      totalSize: 4096,
    }));
  });

  it('readShellConfig returns content from backend', async () => {
    mockTerminalReadConfig.mockResolvedValue('export PATH="/usr/bin"');

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let content = 'should-be-empty';
    await act(async () => {
      content = await result.current.readShellConfig('/nonexistent');
    });

    expect(content).toBe('');
    expect(toast.error).toHaveBeenCalledWith('terminal.toastReadConfigFailed');
  });

  it('parseConfigContent calls terminalParseConfigContent', async () => {
    const mockEntries = {
      aliases: [['ll', 'ls -la'] as [string, string]],
      exports: [] as [string, string][],
      sources: [] as string[],
    };
    mockTerminalParseConfigContent.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries: unknown = 'should-be-null';
    await act(async () => {
      entries = await result.current.parseConfigContent('bad content', 'bash');
    });

    expect(entries).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('terminal.toastParseConfigFailed');
  });

  it('fetchConfigEntries calls terminalGetConfigEntries', async () => {
    const mockEntries = {
      aliases: [] as [string, string][],
      exports: [['EDITOR', 'vim'] as [string, string]],
      sources: [] as string[],
    };
    mockTerminalGetConfigEntries.mockResolvedValue(mockEntries);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries = null;
    await act(async () => {
      entries = await result.current.fetchConfigEntries('/home/user/.bashrc', 'bash');
    });

    expect(mockTerminalGetConfigEntries).toHaveBeenCalledWith('/home/user/.bashrc', 'bash');
    expect(entries).toEqual(mockEntries);
  });

  it('getConfigEditorMetadata enriches supported targets with editor capability details', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let metadata = null;
    await act(async () => {
      metadata = await result.current.getConfigEditorMetadata('/tmp/.bashrc', 'bash');
    });

    expect(metadata).toEqual(expect.objectContaining({
      path: '/tmp/.bashrc',
      capability: expect.objectContaining({
        mode: 'enhanced',
        bundleId: 'shell-posix-vscode-compat',
        supportsCompletion: true,
      }),
    }));
    expect(result.current.resourceStale.configMetadata).toBe(false);
  });

  it('fetchConfigEntries returns null and toasts on error', async () => {
    mockTerminalGetConfigEntries.mockRejectedValue(new Error('fetch error'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let entries: unknown = 'should-be-null';
    await act(async () => {
      entries = await result.current.fetchConfigEntries('/bad/path', 'zsh');
    });

    expect(entries).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('terminal.toastParseConfigFailed');
  });

  it('validateConfigContent calls backend validator and returns diagnostics', async () => {
    const diagnostics = [
      {
        category: 'validation',
        stage: 'validation',
        message: 'Unterminated double quote',
        location: { line: 1, column: 1, endLine: 1, endColumn: 18 },
      },
    ];
    mockTerminalValidateConfigContent.mockResolvedValue(diagnostics);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let response: unknown[] = [];
    await act(async () => {
      response = await result.current.validateConfigContent('export A="oops', 'bash');
    });

    expect(mockTerminalValidateConfigContent).toHaveBeenCalledWith('export A="oops', 'bash');
    expect(response).toEqual(diagnostics);
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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
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

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.fetchFrameworkCacheStats();
    });

    expect(result.current.frameworkCacheLoading).toBe(false);
    expect(result.current.frameworkCacheStats).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(
      'terminal.toastLoadCacheStatsFailed',
    );
  });

  it('cleanFrameworkCache calls backend and refreshes stats', async () => {
    mockTerminalCleanFrameworkCache.mockResolvedValue(5242880); // 5 MB
    mockTerminalGetFrameworkCacheStats.mockResolvedValue([]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.cleanFrameworkCache('Oh My Posh');
    });

    expect(mockTerminalCleanFrameworkCache).toHaveBeenCalledWith('Oh My Posh');
    expect(toast.success).toHaveBeenCalledWith('terminal.toastCacheCleaned');
    // Should refresh stats after clean
    expect(mockTerminalGetFrameworkCacheStats).toHaveBeenCalled();
  });

  it('cleanFrameworkCache toasts on error', async () => {
    mockTerminalCleanFrameworkCache.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.cleanFrameworkCache('Starship');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'terminal.toastCleanCacheFailed',
    );
  });

  it('initial state has empty frameworkCacheStats and false frameworkCacheLoading', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    expect(result.current.frameworkCacheStats).toEqual([]);
    expect(result.current.frameworkCacheLoading).toBe(false);
  });

  it('writeShellConfig updates config mutation action state', async () => {
    let resolveWrite: ((value: unknown) => void) | null = null;
    mockTerminalWriteConfigVerified.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    act(() => {
      void result.current.writeShellConfig('/tmp/.bashrc', 'export A=1', 'bash');
    });

    await waitFor(() => expect(result.current.configMutationState.status).toBe('loading'));

    act(() => {
      resolveWrite?.({
        operation: 'write',
        path: '/tmp/.bashrc',
        backupPath: null,
        bytesWritten: 10,
        verified: true,
        diagnostics: ['ok'],
      });
    });

    await waitFor(() => expect(result.current.configMutationState.status).toBe('success'));
    expect(result.current.configMutationState.result?.operation).toBe('write');
    expect(mockTerminalValidateConfigContent).toHaveBeenCalledWith('export A=1', 'bash');
  });

  it('writeShellConfig stores error state on failure', async () => {
    mockTerminalWriteConfigVerified.mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.writeShellConfig('/tmp/.bashrc', 'export A=1', 'bash');
    });

    expect(result.current.configMutationState.status).toBe('error');
    expect(result.current.configMutationState.message).toBe('terminal.toastSaveConfigFailed');
    expect(toast.error).toHaveBeenCalledWith('terminal.toastSaveConfigFailed');
  });

  it('writeShellConfig rejects invalid content before persistence and stores diagnostics', async () => {
    mockTerminalValidateConfigContent.mockResolvedValue([
      {
        category: 'validation',
        stage: 'validation',
        message: 'Unterminated double quote',
        location: { line: 1, column: 1, endLine: 1, endColumn: 20 },
      },
    ]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.writeShellConfig('/tmp/.bashrc', 'export A="oops', 'bash');
    });

    expect(mockTerminalWriteConfigVerified).not.toHaveBeenCalled();
    expect(result.current.configMutationState.status).toBe('error');
    expect(result.current.configMutationState.result?.verified).toBe(false);
    expect(result.current.configMutationState.result?.diagnosticDetails?.[0]?.message).toBe(
      'Unterminated double quote',
    );
  });

  it('clearConfigMutationState resets stale config mutation feedback', async () => {
    mockTerminalValidateConfigContent.mockResolvedValue([
      {
        category: 'validation',
        stage: 'validation',
        message: 'Unterminated double quote',
        location: { line: 1, column: 1, endLine: 1, endColumn: 20 },
      },
    ]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.writeShellConfig('/tmp/.bashrc', 'export A="oops', 'bash');
    });

    expect(result.current.configMutationState.status).toBe('error');

    act(() => {
      result.current.clearConfigMutationState();
    });

    expect(result.current.configMutationState.status).toBe('idle');
    expect(result.current.configMutationState.message).toBeNull();
    expect(result.current.configMutationState.result).toBeNull();
  });

  it('getConfigEditorMetadata returns shell-aware metadata', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    let metadata = null;
    await act(async () => {
      metadata = await result.current.getConfigEditorMetadata('/tmp/.bashrc', 'bash');
    });

    expect(mockTerminalGetConfigEditorMetadata).toHaveBeenCalledWith('/tmp/.bashrc', 'bash');
    expect(metadata).toEqual(expect.objectContaining({
      path: '/tmp/.bashrc',
      shellType: 'bash',
      language: 'bash',
      snapshotPath: '/tmp/.cognia/terminal-snapshots/.bashrc.latest',
      fingerprint: 'abc123',
      capability: expect.objectContaining({
        mode: 'enhanced',
        bundleId: 'shell-posix-vscode-compat',
      }),
    }));
  });

  it('restoreConfigSnapshot updates mutation lifecycle on success', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.restoreConfigSnapshot('/tmp/.bashrc');
    });

    expect(mockTerminalRestoreConfigSnapshot).toHaveBeenCalledWith('/tmp/.bashrc');
    expect(result.current.configMutationState.status).toBe('success');
    expect(result.current.configMutationState.message).toBe('terminal.toastConfigUpdated');
    expect(result.current.configMutationState.result?.snapshotPath).toBe(
      '/tmp/.cognia/terminal-snapshots/.bashrc.latest',
    );
  });

  it('updateProxyMode reloads canonical proxy state and marks sync success', async () => {
    mockConfigList.mockResolvedValue([
      ['terminal.proxy_mode', 'custom'],
      ['terminal.custom_proxy', 'https://proxy.example.com:8443'],
      ['terminal.no_proxy', 'localhost,127.0.0.1'],
      ['network.proxy', 'http://global:8080'],
    ]);
    mockTerminalGetProxyEnvVars.mockResolvedValue([
      ['HTTP_PROXY', 'https://proxy.example.com:8443'],
      ['NO_PROXY', 'localhost,127.0.0.1'],
    ]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateProxyMode('custom');
    });

    expect(mockConfigSet).toHaveBeenCalledWith('terminal.proxy_mode', 'custom');
    expect(result.current.proxySyncState.status).toBe('success');
    expect(result.current.proxyMode).toBe('custom');
    expect(result.current.customProxy).toBe('https://proxy.example.com:8443');
    expect(result.current.proxyEnvVars).toEqual([
      ['HTTP_PROXY', 'https://proxy.example.com:8443'],
      ['NO_PROXY', 'localhost,127.0.0.1'],
    ]);
  });

  it('saveCustomProxy preserves error sync state on failure', async () => {
    mockConfigSet.mockRejectedValue(new Error('invalid proxy'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateCustomProxy('bad://proxy');
      await result.current.saveCustomProxy();
    });

    expect(result.current.proxySyncState.status).toBe('error');
    expect(result.current.proxySyncState.message).toBe('terminal.toastSaveProxyFailed');
    expect(result.current.proxySyncState.result).not.toBeNull();
  });

  it('saveNoProxy persists a trimmed value', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.updateNoProxy(' localhost,127.0.0.1 ');
    });
    await waitFor(() => expect(result.current.noProxy).toBe(' localhost,127.0.0.1 '));

    await act(async () => {
      await result.current.saveNoProxy();
    });

    expect(mockConfigSet).toHaveBeenCalledWith('terminal.no_proxy', 'localhost,127.0.0.1');
    expect(result.current.proxySyncState.status).toBe('success');
  });

  it('loadProxyConfig sets explicit error sync state on failure', async () => {
    mockConfigList.mockRejectedValue(new Error('config unavailable'));

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.loadProxyConfig();
    });

    expect(result.current.proxySyncState.status).toBe('error');
    expect(result.current.proxySyncState.message).toBe('terminal.toastLoadProxyVarsFailed');
    expect(toast.error).toHaveBeenCalledWith('terminal.toastLoadProxyVarsFailed');
  });

  it('tracks config resource invalidation after successful config writes', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    expect(result.current.resourceStale.configEntries).toBe(false);
    expect(result.current.resourceStale.configMetadata).toBe(false);

    await act(async () => {
      await result.current.writeShellConfig('/tmp/.bashrc', 'export A=1', 'bash');
    });

    expect(result.current.resourceStale.configEntries).toBe(true);
    expect(result.current.resourceStale.configMetadata).toBe(true);
  });

  it('infers shell type when omitted and keeps invalidation scoped to config resources', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.markResourcesFresh([
        'proxyConfig',
        'proxyEnvVars',
        'shellEnvVars',
        'psProfiles',
        'psModules',
        'psScripts',
        'executionPolicy',
      ]);
    });

    await act(async () => {
      await result.current.writeShellConfig('/tmp/Microsoft.PowerShell_profile.ps1', '$Env:TEST = "1"');
    });

    expect(mockTerminalValidateConfigContent).toHaveBeenCalledWith(
      '$Env:TEST = "1"',
      'powershell',
    );
    expect(result.current.resourceStale.configEntries).toBe(true);
    expect(result.current.resourceStale.configMetadata).toBe(true);
    expect(result.current.resourceStale.proxyConfig).toBe(false);
    expect(result.current.resourceStale.proxyEnvVars).toBe(false);
    expect(result.current.resourceStale.shellEnvVars).toBe(false);
  });

  it('marks proxy env resource fresh after explicit fetch', async () => {
    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    expect(result.current.resourceStale.proxyEnvVars).toBe(true);

    await act(async () => {
      await result.current.fetchProxyEnvVars();
    });

    expect(result.current.resourceStale.proxyEnvVars).toBe(false);
  });

  it('installPSModule refreshes both module and script resources without touching unrelated state', async () => {
    mockTerminalPsListAllModules.mockResolvedValue([
      {
        name: 'PSReadLine',
        version: '2.3.6',
        moduleType: 'Script',
        path: 'C:/Modules/PSReadLine',
        description: 'Interactive editing',
        exportedCommandsCount: 5,
      },
    ]);
    mockTerminalPsListInstalledScripts.mockResolvedValue([
      {
        name: 'Invoke-Build',
        version: '5.12.0',
        author: 'Nightroman',
        description: 'Build automation',
        installPath: 'C:/Scripts/Invoke-Build',
      },
    ]);

    const { result } = renderHook(() => useTerminal({ t: mockT }));
    await waitFor(() => expect(mockTerminalDetectShells).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.markResourcesFresh([
        'profiles',
        'templates',
        'configEntries',
        'configMetadata',
        'proxyConfig',
        'proxyEnvVars',
        'shellEnvVars',
        'psProfiles',
        'psModules',
        'psScripts',
        'executionPolicy',
      ]);
    });

    await act(async () => {
      await result.current.installPSModule('PSReadLine', 'CurrentUser');
    });

    expect(mockTerminalPsInstallModule).toHaveBeenCalledWith('PSReadLine', 'CurrentUser');
    expect(mockTerminalPsListAllModules).toHaveBeenCalled();
    expect(mockTerminalPsListInstalledScripts).toHaveBeenCalled();
    expect(result.current.resourceStale.psModules).toBe(false);
    expect(result.current.resourceStale.psScripts).toBe(false);
    expect(result.current.resourceStale.proxyConfig).toBe(false);
    expect(result.current.resourceStale.configEntries).toBe(false);
  });
});
