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
const mockGetShellInfo = jest.fn();
const mockGetSingleFrameworkCacheInfo = jest.fn();

const mockTerminalHookState = {
  shells: [
    {
      id: 'bash',
      name: 'Bash',
      shellType: 'bash',
      executablePath: '/bin/bash',
      configFiles: [],
      isDefault: true,
    },
  ],
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
  resourceStale: {
    profiles: false,
    templates: false,
    configEntries: false,
    configMetadata: false,
    proxyConfig: true,
    proxyEnvVars: true,
    shellEnvVars: true,
    psProfiles: true,
    psModules: true,
    psScripts: true,
    executionPolicy: true,
  },
  detectShells: jest.fn(),
  measureStartup: jest.fn(),
  checkShellHealth: jest.fn(),
  getShellInfo: mockGetShellInfo,
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
  getConfigEditorMetadata: jest.fn(),
  restoreConfigSnapshot: jest.fn(),
  detectFrameworks: jest.fn(),
  fetchPlugins: jest.fn(),
  fetchFrameworkCacheStats: jest.fn(),
  getSingleFrameworkCacheInfo: mockGetSingleFrameworkCacheInfo,
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
  markResourcesStale: jest.fn(),
  markResourcesFresh: jest.fn(),
  setSelectedShellContext: jest.fn(),
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
  TerminalDetectedShells: ({
    shells,
    onGetShellInfo,
    onContinueToConfig,
    onContinueToFrameworks,
    onContinueToEnvVars,
    activeShellId,
  }: {
    shells: unknown[];
    onGetShellInfo?: (shellId: string) => void;
    onContinueToConfig?: (shellId: string) => void;
    onContinueToFrameworks?: (shellId: string) => void;
    onContinueToEnvVars?: (shellId: string) => void;
    activeShellId?: string | null;
  }) => (
    <div data-testid="detected-shells">
      Shells: {shells.length}
      <span data-testid="active-shell-context">{activeShellId ?? 'none'}</span>
      <button type="button" onClick={() => onGetShellInfo?.('bash')}>
        inspect-shell
      </button>
      <button type="button" onClick={() => onContinueToConfig?.('bash')}>
        handoff-config
      </button>
      <button type="button" onClick={() => onContinueToFrameworks?.('bash')}>
        handoff-frameworks
      </button>
      <button type="button" onClick={() => onContinueToEnvVars?.('bash')}>
        handoff-envvars
      </button>
    </div>
  ),
  TerminalProfileList: ({ onFromTemplate }: { onFromTemplate?: () => void }) => (
    <div data-testid="profile-list">
      Profiles
      <button type="button" onClick={() => onFromTemplate?.()}>open-template-picker</button>
    </div>
  ),
  TerminalProfileDialog: () => null,
  TerminalShellConfig: ({
    onDirtyChange,
    onRequestDiscard,
    onRefreshHandled,
    refreshIntent,
    activeShellId,
  }: {
    onDirtyChange?: (value: boolean) => void;
    onRequestDiscard?: () => void;
    onRefreshHandled?: (handled: { configEntries: boolean; configMetadata: boolean }) => void;
    refreshIntent?: { configEntries: boolean; configMetadata: boolean };
    activeShellId?: string | null;
  }) => (
    <div data-testid="shell-config">
      <span data-testid="shell-config-active-shell">{activeShellId ?? 'none'}</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>set-config-dirty</button>
      <button type="button" onClick={() => onRequestDiscard?.()}>request-config-discard</button>
      <button
        type="button"
        onClick={() =>
          onRefreshHandled?.({
            configEntries: refreshIntent?.configEntries ?? true,
            configMetadata: refreshIntent?.configMetadata ?? true,
          })
        }
      >
        acknowledge-config-refresh
      </button>
      Shell Config
    </div>
  ),
  TerminalShellFramework: ({
    onGetFrameworkCacheInfo,
    activeShellId,
  }: {
    onGetFrameworkCacheInfo?: (frameworkName: string, frameworkPath: string, shellType: string) => void;
    activeShellId?: string | null;
  }) => (
    <div data-testid="shell-framework">
      <span data-testid="shell-framework-active-shell">{activeShellId ?? 'none'}</span>
      Frameworks
      <button
        type="button"
        onClick={() => onGetFrameworkCacheInfo?.('Oh My Zsh', '/home/user/.oh-my-zsh', 'zsh')}
      >
        inspect-framework-cache
      </button>
    </div>
  ),
  TerminalPsManagement: () => <div data-testid="ps-management">PS Management</div>,
  TerminalPsModulesTable: ({ onSearchModules }: { onSearchModules?: (query: string) => void }) => (
    <div data-testid="ps-modules">
      PS Modules
      <button type="button" onClick={() => onSearchModules?.('Pester')}>search-modules</button>
    </div>
  ),
  TerminalProxySettings: () => <div data-testid="proxy-settings">Proxy</div>,
  TerminalEnvVars: () => <div data-testid="env-vars">Env Vars</div>,
  TerminalTemplatePicker: ({
    open,
    onCreateCustom,
  }: {
    open?: boolean;
    onCreateCustom?: (template: {
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      shellType: string | null;
      args: string[];
      envVars: Record<string, string>;
      cwd: string | null;
      startupCommand: string | null;
      envType: string | null;
      envVersion: string | null;
      isBuiltin: boolean;
    }) => void;
  }) => open ? (
    <div data-testid="template-picker">
      <button
        type="button"
        onClick={() => onCreateCustom?.({
          id: '',
          name: 'Custom Template',
          description: 'Custom description',
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
        })}
      >
        create-custom-template
      </button>
    </div>
  ) : null,
}));

describe('TerminalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminalHookState.configMutationState = { status: 'idle', message: null, result: null, updatedAt: null };
    mockTerminalHookState.proxySyncState = { status: 'idle', message: null, result: null, updatedAt: null };
    mockTerminalHookState.resourceStale = {
      profiles: false,
      templates: false,
      configEntries: false,
      configMetadata: false,
      proxyConfig: true,
      proxyEnvVars: true,
      shellEnvVars: true,
      psProfiles: true,
      psModules: true,
      psScripts: true,
      executionPolicy: true,
    };
    mockGetShellInfo.mockResolvedValue(undefined);
    mockGetSingleFrameworkCacheInfo.mockResolvedValue(undefined);
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

  it('uses scrollable tablist layout for compact viewports', () => {
    render(<TerminalPage />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('overflow-x-auto');
    expect(screen.getByRole('tab', { name: /shells/i }).className).toContain('flex-none');
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
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(0);
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

  it('refreshes proxy tab only when proxy resources are stale', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /proxy/i }));
    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(0);

    mockTerminalHookState.resourceStale = {
      ...mockTerminalHookState.resourceStale,
      proxyConfig: false,
      proxyEnvVars: false,
    };
    rerender(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /shells/i }));
    await user.click(screen.getByRole('tab', { name: /proxy/i }));

    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(0);

    mockTerminalHookState.resourceStale = {
      ...mockTerminalHookState.resourceStale,
      proxyConfig: true,
      proxyEnvVars: true,
    };
    rerender(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /shells/i }));
    await user.click(screen.getByRole('tab', { name: /proxy/i }));

    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(2);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(0);
  });

  it('refreshes proxy env vars independently when only proxy env is stale', async () => {
    const user = userEvent.setup();
    mockTerminalHookState.resourceStale = {
      ...mockTerminalHookState.resourceStale,
      proxyConfig: false,
      proxyEnvVars: true,
    };

    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /proxy/i }));

    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(0);
    expect(mockFetchProxyEnvVars).toHaveBeenCalledTimes(1);
  });

  it('guards tab switch when config editor is dirty until discard is confirmed', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /config/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shell-config')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /set-config-dirty/i }));
    await user.click(screen.getByRole('tab', { name: /profiles/i }));

    expect(screen.getByText('terminal.unsavedChangesTitle')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-list')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /terminal\.cancel/i }));
    expect(screen.queryByTestId('profile-list')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /profiles/i }));
    await user.click(screen.getByRole('button', { name: /terminal\.discardAndContinue/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profile-list')).toBeInTheDocument();
    });
  });

  it('keeps dirty-guard behavior after config refresh is acknowledged', async () => {
    const user = userEvent.setup();
    mockTerminalHookState.resourceStale = {
      ...mockTerminalHookState.resourceStale,
      configEntries: true,
      configMetadata: true,
    };

    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /config/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shell-config')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /acknowledge-config-refresh/i }));
    expect(mockTerminalHookState.markResourcesFresh).toHaveBeenCalledWith(['configEntries', 'configMetadata']);

    await user.click(screen.getByRole('button', { name: /set-config-dirty/i }));
    await user.click(screen.getByRole('tab', { name: /profiles/i }));

    expect(screen.getByText('terminal.unsavedChangesTitle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /terminal\.discardAndContinue/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profile-list')).toBeInTheDocument();
    });
  });

  it('marks only config metadata fresh when that is the only stale config resource', async () => {
    const user = userEvent.setup();
    mockTerminalHookState.resourceStale = {
      ...mockTerminalHookState.resourceStale,
      configEntries: false,
      configMetadata: true,
    };

    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /config/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shell-config')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /acknowledge-config-refresh/i }));
    expect(mockTerminalHookState.markResourcesFresh).toHaveBeenCalledWith(['configMetadata']);
  });

  it('wires PowerShell gallery search into the modules table', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /powershell/i }));
    await waitFor(() => {
      expect(screen.getByTestId('ps-modules')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /search-modules/i }));
    expect(mockTerminalHookState.searchPSModules).toHaveBeenCalledWith('Pester');
  });

  it('wires custom template creation through the template picker workflow', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('tab', { name: /profiles/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profile-list')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /open-template-picker/i }));
    await waitFor(() => {
      expect(screen.getByTestId('template-picker')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /create-custom-template/i }));
    expect(mockTerminalHookState.createCustomTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Custom Template',
      category: 'custom',
      shellType: 'bash',
    }));
  });

  it('wires shell and framework drilldown callbacks into terminal components', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await user.click(screen.getByRole('button', { name: /inspect-shell/i }));
    expect(mockGetShellInfo).toHaveBeenCalledWith('bash');

    await user.click(screen.getByRole('tab', { name: /frameworks/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shell-framework')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /inspect-framework-cache/i }));
    expect(mockGetSingleFrameworkCacheInfo).toHaveBeenCalledWith('Oh My Zsh', '/home/user/.oh-my-zsh', 'zsh');
  });

});
