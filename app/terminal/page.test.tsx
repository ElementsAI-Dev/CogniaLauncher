import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TerminalPage from './page';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'terminal.title': 'Terminal',
        'terminal.description': 'Manage terminal shells and profiles',
        'terminal.tabShells': 'Shells',
        'terminal.tabProfiles': 'Profiles',
        'terminal.tabConfig': 'Config',
        'terminal.tabFrameworks': 'Frameworks',
        'terminal.tabPowerShell': 'PowerShell',
        'terminal.tabProxy': 'Proxy',
        'terminal.tabEnvVars': 'Env Vars',
      };
      return translations[key] || key;
    },
  }),
}));

const mockLoadProxyConfig = jest.fn();
const mockFetchProxyEnvVars = jest.fn();
const mockFetchShellEnvVars = jest.fn();

const mockTerminalHookState = {
  shells: [{ id: 'bash', name: 'Bash', path: '/bin/bash' }],
  profiles: [],
  templates: [],
  loading: false,
  shellsLoading: false,
  profilesLoading: false,
  psLoading: false,
  error: null,
  frameworks: [],
  plugins: [],
  frameworkCacheStats: [],
  frameworkCacheLoading: false,
  psProfiles: [],
  psModules: [],
  psScripts: [],
  executionPolicy: [],
  proxyEnvVars: [],
  shellEnvVars: [],
  startupMeasurements: {},
  healthResults: {},
  measuringShellId: null,
  checkingHealthShellId: null,
  selectedShellId: null,
  launchingProfileId: null,
  lastLaunchResult: null,
  proxyMode: 'global',
  customProxy: '',
  noProxy: '',
  globalProxy: '',
  proxyConfigSaving: false,
  configMutationState: { status: 'idle', message: null, result: null, updatedAt: null },
  proxySyncState: { status: 'idle', message: null, result: null, updatedAt: null },
  detectShells: jest.fn(),
  measureStartup: jest.fn(),
  checkShellHealth: jest.fn(),
  fetchProfiles: jest.fn(),
  launchProfile: jest.fn(),
  createProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
  setDefaultProfile: jest.fn(),
  duplicateProfile: jest.fn(),
  exportProfiles: jest.fn(),
  importProfiles: jest.fn(),
  readShellConfig: jest.fn(),
  fetchConfigEntries: jest.fn(),
  backupShellConfig: jest.fn(),
  parseConfigContent: jest.fn(),
  writeShellConfig: jest.fn(),
  detectFrameworks: jest.fn(),
  fetchPlugins: jest.fn(),
  fetchFrameworkCacheStats: jest.fn(),
  cleanFrameworkCache: jest.fn(),
  fetchPSProfiles: jest.fn(),
  readPSProfile: jest.fn(),
  writePSProfile: jest.fn(),
  fetchExecutionPolicy: jest.fn(),
  setExecutionPolicy: jest.fn(),
  fetchPSModules: jest.fn(),
  fetchPSScripts: jest.fn(),
  installPSModule: jest.fn(),
  uninstallPSModule: jest.fn(),
  updatePSModule: jest.fn(),
  searchPSModules: jest.fn(),
  fetchProxyEnvVars: mockFetchProxyEnvVars,
  fetchShellEnvVars: mockFetchShellEnvVars,
  clearLaunchResult: jest.fn(),
  clearConfigMutationState: jest.fn(),
  clearProxySyncState: jest.fn(),
  loadProxyConfig: mockLoadProxyConfig,
  updateProxyMode: jest.fn(),
  updateCustomProxy: jest.fn(),
  saveCustomProxy: jest.fn(),
  updateNoProxy: jest.fn(),
  saveNoProxy: jest.fn(),
  fetchTemplates: jest.fn(),
  createCustomTemplate: jest.fn(),
  deleteCustomTemplate: jest.fn(),
  saveProfileAsTemplate: jest.fn(),
  createProfileFromTemplate: jest.fn(),
  appendToShellConfig: jest.fn(),
};

jest.mock('@/hooks/use-terminal', () => ({
  useTerminal: () => mockTerminalHookState,
}));

jest.mock('@/components/terminal', () => ({
  TerminalDetectedShells: ({ shells }: { shells: unknown[] }) => (
    <div data-testid="detected-shells">Shells: {shells.length}</div>
  ),
  TerminalProfileList: () => <div data-testid="profile-list">Profiles</div>,
  TerminalProfileDialog: () => null,
  TerminalShellConfig: () => <div data-testid="shell-config">Shell Config</div>,
  TerminalShellFramework: () => <div data-testid="shell-framework">Frameworks</div>,
  TerminalPsManagement: () => <div data-testid="ps-management">PS Management</div>,
  TerminalPsModulesTable: () => <div data-testid="ps-modules">PS Modules</div>,
  TerminalProxySettings: () => <div data-testid="proxy-settings">Proxy</div>,
  TerminalEnvVars: () => <div data-testid="env-vars">Env Vars</div>,
  TerminalTemplatePicker: () => null,
}));

describe('TerminalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalHookState.configMutationState = { status: 'idle', message: null, result: null, updatedAt: null };
    mockTerminalHookState.proxySyncState = { status: 'idle', message: null, result: null, updatedAt: null };
  });

  it('renders page title and description', () => {
    render(<TerminalPage />);
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText('Manage terminal shells and profiles')).toBeInTheDocument();
  });

  it('renders all 7 tabs', () => {
    render(<TerminalPage />);
    expect(screen.getByRole('tab', { name: /shells/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /profiles/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /frameworks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /powershell/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /proxy/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /env vars/i })).toBeInTheDocument();
  });

  it('shows shells tab content by default', () => {
    render(<TerminalPage />);
    expect(screen.getByTestId('detected-shells')).toBeInTheDocument();
    expect(screen.getByTestId('detected-shells')).toHaveTextContent('Shells: 1');
  });

  it('switches to profiles tab', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /profiles/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profile-list')).toBeInTheDocument();
    });
  });

  it('switches to config tab', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /config/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shell-config')).toBeInTheDocument();
    });
  });

  it('switches to proxy tab', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /proxy/i }));
    await waitFor(() => {
      expect(screen.getByTestId('proxy-settings')).toBeInTheDocument();
    });
    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(1);
  });

  it('switches to env vars tab', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /env vars/i }));
    await waitFor(() => {
      expect(screen.getByTestId('env-vars')).toBeInTheDocument();
    });
    expect(mockFetchShellEnvVars).toHaveBeenCalledTimes(1);
  });

  it('refreshes invalidated proxy tab after proxy sync success', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /proxy/i }));
    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(1);

    mockTerminalHookState.proxySyncState = {
      status: 'success',
      message: 'ok',
      result: null,
      updatedAt: Date.now(),
    };
    rerender(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /shells/i }));
    await user.click(screen.getByRole('tab', { name: /proxy/i }));

    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(2);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(2);
  });
});
