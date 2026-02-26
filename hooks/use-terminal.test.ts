import { act, renderHook, waitFor } from '@testing-library/react';
import { useTerminal } from './use-terminal';
import type { LaunchResult, ShellFrameworkInfo } from '@/types/tauri';
import { toast } from 'sonner';

const mockTerminalDetectShells = jest.fn();
const mockTerminalListProfiles = jest.fn();
const mockTerminalLaunchProfileDetailed = jest.fn();
const mockTerminalDetectFramework = jest.fn();

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
  terminalReadConfig: jest.fn(),
  terminalBackupConfig: jest.fn(),
  terminalAppendToConfig: jest.fn(),
  terminalGetConfigEntries: jest.fn(),
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
      },
    ];
    const bashFrameworks2: ShellFrameworkInfo[] = [
      {
        name: 'bash-fw-new',
        version: '2.0.0',
        path: '/tmp/bash-fw-new',
        shellType: 'bash',
      },
    ];
    const powershellFrameworks: ShellFrameworkInfo[] = [
      {
        name: 'pwsh-fw',
        version: null,
        path: 'C:/pwsh-fw',
        shellType: 'powershell',
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
});

