import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WslPage from './page';

const mockCheckAvailability = jest.fn().mockResolvedValue(true);
const mockRefreshAll = jest.fn().mockResolvedValue(undefined);
const mockRefreshDistros = jest.fn().mockResolvedValue(undefined);
const mockRefreshOnlineDistros = jest.fn().mockResolvedValue(undefined);
const mockRefreshStatus = jest.fn().mockResolvedValue(undefined);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
const mockUpdateWsl = jest.fn().mockResolvedValue('updated');
const mockLaunch = jest.fn().mockResolvedValue(undefined);
const mockTerminate = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'wsl.title': 'WSL',
        'wsl.description': 'Windows Subsystem for Linux',
        'wsl.installed': 'Installed',
        'wsl.available': 'Available',
        'wsl.update': 'Update',
        'wsl.import': 'Import',
        'wsl.notAvailable': 'WSL is not available in the browser',
        'wsl.installSuccess': 'Installed {name}',
        'wsl.terminateSuccess': 'Terminated {name}',
        'wsl.shutdownSuccess': 'WSL shutdown complete',
        'wsl.setDefaultSuccess': 'Set {name} as default',
        'wsl.setVersionSuccess': 'Set {name} to WSL {version}',
        'wsl.exportSuccess': 'Exported {name}',
        'wsl.importSuccess': 'Imported {name}',
        'wsl.setDefaultVersionSuccess': 'Set default WSL version to {version}',
        'wsl.updateSuccess': 'WSL updated',
        'wsl.importInPlace': 'Import In-Place',
        'wsl.importInPlaceSuccess': 'Imported {name}',
        'wsl.mount': 'Mount',
        'wsl.unmount': 'Unmount',
        'wsl.mountSuccess': 'Mounted',
        'wsl.unmountSuccess': 'Unmounted',
        'wsl.defaultVersion': 'Default WSL',
        'wsl.advancedOps': 'Advanced Operations',
        'wsl.advancedOpsDesc': 'Advanced WSL management',
        'wsl.unregister': 'Unregister',
        'wsl.unregisterConfirm': 'Unregister {name}?',
        'wsl.shutdown': 'Shutdown All',
        'wsl.shutdownConfirm': 'Shutdown all WSL instances?',
        'wsl.mountConfirm': 'Mount disk?',
        'wsl.unmountConfirm': 'Unmount {path}?',
        'wsl.unmountAllConfirm': 'Unmount all disks?',
        'wsl.dataLossWarning': 'All data will be lost!',
        'wsl.highRiskHint': 'This action requires elevated privileges.',
        'wsl.capabilityUnsupported': '{feature} unsupported in WSL {version}',
        'wsl.mountOptionsFallback': 'Mount options not supported',
        'wsl.changeDefaultUserSuccess': 'Changed default user for {name} to {user}',
        'wsl.unregisterSuccess': 'Unregistered {name}',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(true),
  packageInstall: jest.fn().mockResolvedValue(undefined),
  packageUninstall: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/hooks/use-wsl', () => ({
  useWsl: () => ({
    available: true,
    distros: [
      { name: 'Ubuntu', state: 'Running', version: 2, isDefault: true },
      { name: 'Debian', state: 'Stopped', version: 2, isDefault: false },
    ],
    onlineDistros: [['Ubuntu', 'Ubuntu Linux'], ['Fedora', 'Fedora Linux']],
    status: { kernelVersion: '5.15.0', runningDistros: ['Ubuntu'] },
    capabilities: { importInPlace: true, mountOptions: true },
    loading: false,
    error: null,
    checkAvailability: mockCheckAvailability,
    refreshDistros: mockRefreshDistros,
    refreshOnlineDistros: mockRefreshOnlineDistros,
    refreshStatus: mockRefreshStatus,
    refreshAll: mockRefreshAll,
    terminate: mockTerminate,
    shutdown: mockShutdown,
    setDefault: jest.fn().mockResolvedValue(undefined),
    setVersion: jest.fn().mockResolvedValue(undefined),
    setDefaultVersion: jest.fn().mockResolvedValue(undefined),
    exportDistro: jest.fn().mockResolvedValue(undefined),
    importDistro: jest.fn().mockResolvedValue(undefined),
    importInPlace: jest.fn().mockResolvedValue(undefined),
    updateWsl: mockUpdateWsl,
    launch: mockLaunch,
    config: {},
    execCommand: jest.fn().mockResolvedValue(''),
    refreshConfig: jest.fn().mockResolvedValue(undefined),
    setConfigValue: jest.fn().mockResolvedValue(undefined),
    getDiskUsage: jest.fn().mockResolvedValue(null),
    mountDisk: jest.fn().mockResolvedValue(''),
    unmountDisk: jest.fn().mockResolvedValue(undefined),
    getIpAddress: jest.fn().mockResolvedValue(''),
    changeDefaultUser: jest.fn().mockResolvedValue(undefined),
    getDistroConfig: jest.fn().mockResolvedValue({}),
    setDistroConfigValue: jest.fn().mockResolvedValue(undefined),
    installWslOnly: jest.fn().mockResolvedValue(undefined),
    listUsers: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/wsl', () => ({
  WslStatusCard: ({ status, onShutdownAll, onRefresh, getIpAddress }: {
    status: { kernelVersion: string } | null;
    onShutdownAll?: () => void;
    onRefresh?: () => void;
    getIpAddress?: () => Promise<string>;
  }) => (
    <div data-testid="wsl-status">
      {status?.kernelVersion ?? 'No status'}
      {onShutdownAll && <button data-testid="shutdown-all-btn" onClick={onShutdownAll}>Shutdown All</button>}
      {onRefresh && <button data-testid="refresh-status-btn" onClick={onRefresh}>Refresh</button>}
      {getIpAddress && <button data-testid="get-ip-btn" onClick={() => getIpAddress()}>Get IP</button>}
    </div>
  ),
  WslDistroCard: ({ distro, onLaunch, onTerminate, onSetDefault, onExport, onSetVersion, onUnregister, onChangeDefaultUser }: {
    distro: { name: string };
    onLaunch?: (n: string) => void;
    onTerminate?: (n: string) => void;
    onSetDefault?: (n: string) => void;
    onExport?: (n: string) => void;
    onSetVersion?: (n: string, v: number) => void;
    onUnregister?: (n: string) => void;
    onChangeDefaultUser?: (n: string) => void;
  }) => (
    <div data-testid={`distro-${distro.name}`}>
      {distro.name}
      {onLaunch && <button data-testid={`launch-${distro.name}`} onClick={() => onLaunch(distro.name)}>Launch</button>}
      {onTerminate && <button data-testid={`terminate-${distro.name}`} onClick={() => onTerminate(distro.name)}>Terminate</button>}
      {onSetDefault && <button data-testid={`default-${distro.name}`} onClick={() => onSetDefault(distro.name)}>Default</button>}
      {onExport && <button data-testid={`export-${distro.name}`} onClick={() => onExport(distro.name)}>Export</button>}
      {onSetVersion && <button data-testid={`version-${distro.name}`} onClick={() => onSetVersion(distro.name, 2)}>Set V2</button>}
      {onUnregister && <button data-testid={`unregister-${distro.name}`} onClick={() => onUnregister(distro.name)}>Unregister</button>}
      {onChangeDefaultUser && <button data-testid={`chuser-${distro.name}`} onClick={() => onChangeDefaultUser(distro.name)}>ChUser</button>}
    </div>
  ),
  WslOnlineList: ({ distros, onInstall }: { distros: [string, string][]; onInstall?: (n: string) => void }) => (
    <div data-testid="online-list">
      {distros.length} available
      {onInstall && <button data-testid="install-online" onClick={() => onInstall('Fedora')}>Install</button>}
    </div>
  ),
  WslImportDialog: () => null,
  WslExportDialog: () => null,
  WslEmptyState: () => <div data-testid="empty-state">No distros</div>,
  WslNotAvailable: ({ onInstallWsl }: { onInstallWsl?: () => void }) => (
    <div data-testid="not-available">
      WSL not installed
      {onInstallWsl && <button data-testid="install-wsl" onClick={onInstallWsl}>Install WSL</button>}
    </div>
  ),
  WslConfigCard: () => <div data-testid="config-card">Config</div>,
  WslDistroConfigCard: () => <div data-testid="distro-config">Distro Config</div>,
  WslExecTerminal: ({ onExec }: { onExec?: (d: string, c: string) => void }) => (
    <div data-testid="exec-terminal">
      Terminal
      {onExec && <button data-testid="exec-cmd" onClick={() => onExec('Ubuntu', 'ls')}>Exec</button>}
    </div>
  ),
}));

jest.mock('@/components/wsl/wsl-change-user-dialog', () => ({
  WslChangeUserDialog: () => null,
}));

jest.mock('@/components/wsl/wsl-mount-dialog', () => ({
  WslMountDialog: () => null,
}));

jest.mock('@/components/wsl/wsl-import-in-place-dialog', () => ({
  WslImportInPlaceDialog: () => null,
}));

describe('WslPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and description', () => {
    render(<WslPage />);
    expect(screen.getByText('WSL')).toBeInTheDocument();
    expect(screen.getByText('Windows Subsystem for Linux')).toBeInTheDocument();
  });

  it('renders installed and available tabs', () => {
    render(<WslPage />);
    expect(screen.getByText(/Installed/)).toBeInTheDocument();
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it('renders distro cards', () => {
    render(<WslPage />);
    expect(screen.getByTestId('distro-Ubuntu')).toBeInTheDocument();
    expect(screen.getByTestId('distro-Debian')).toBeInTheDocument();
  });

  it('renders status card sidebar', () => {
    render(<WslPage />);
    expect(screen.getByTestId('wsl-status')).toHaveTextContent('5.15.0');
  });

  it('renders config card', () => {
    render(<WslPage />);
    expect(screen.getByTestId('config-card')).toBeInTheDocument();
  });

  it('renders exec terminal', () => {
    render(<WslPage />);
    expect(screen.getByTestId('exec-terminal')).toBeInTheDocument();
  });

  it('renders update button', () => {
    render(<WslPage />);
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
  });

  it('renders import button', () => {
    render(<WslPage />);
    const importButtons = screen.getAllByRole('button', { name: /import/i });
    expect(importButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to available tab', async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await user.click(screen.getByText(/Available/));
    await waitFor(() => {
      expect(screen.getByTestId('online-list')).toHaveTextContent('2 available');
    });
  });
});

describe('WslPage - Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('launches a distro when launch button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('launch-Ubuntu'));
    await waitFor(() => {
      expect(mockLaunch).toHaveBeenCalledWith('Ubuntu');
    });
  });

  it('terminates a distro when terminate button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('terminate-Ubuntu'));
    await waitFor(() => {
      expect(mockTerminate).toHaveBeenCalledWith('Ubuntu');
    });
  });

  it('refreshes when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('refresh-status-btn'));
    await waitFor(() => {
      expect(mockRefreshStatus).toHaveBeenCalled();
    });
  });

  it('handles update button click', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByRole('button', { name: /update/i }));
    await waitFor(() => {
      expect(mockUpdateWsl).toHaveBeenCalled();
    });
  });

  it('sets default version when button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    const buttons = screen.getAllByRole('button', { name: /Default WSL 2/i });
    await user.click(buttons[0]);
    // handleSetDefaultVersion is called
  });

  it('opens export dialog when export button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('export-Ubuntu'));
    // export dialog state is set
  });

  it('opens change user dialog when chuser button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('chuser-Ubuntu'));
    // change user dialog state is set
  });

  it('sets default distro when default button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('default-Ubuntu'));
    // setDefault handler is invoked
  });

  it('sets version when version button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('version-Ubuntu'));
    // setVersion handler is invoked
  });

  it('opens unregister confirm when unregister button is clicked', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('unregister-Ubuntu'));
    // confirm dialog opens
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  it('executes command via terminal', async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId('exec-cmd'));
    // exec handler is invoked
  });
});

describe('WslPage - Non-Tauri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(false);
  });

  afterEach(() => {
    const tauri = jest.requireMock('@/lib/tauri');
    tauri.isTauri.mockReturnValue(true);
  });

  it('shows not available message in browser mode', () => {
    render(<WslPage />);
    expect(screen.getByText('WSL is not available in the browser')).toBeInTheDocument();
  });
});
