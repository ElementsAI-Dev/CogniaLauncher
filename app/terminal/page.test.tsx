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
        'terminal.tabConfig': 'Shell Config',
        'terminal.tabFrameworks': 'Frameworks',
        'terminal.tabPowerShell': 'PowerShell',
        'terminal.tabProxy': 'Proxy',
        'terminal.tabEnvVars': 'Env Vars',
        'terminal.section.shell-environment': 'Shell Environment',
        'terminal.section.profiles': 'Profiles',
        'terminal.section.configuration': 'Configuration',
        'terminal.section.network': 'Network',
        'terminal.sectionShellEnvironment': 'Shell Environment',
        'terminal.sectionShellEnvironmentDesc': 'Detected shells, frameworks, and environment variables',
        'terminal.sectionProfiles': 'Profiles',
        'terminal.sectionProfilesDesc': 'Terminal profiles for quick launching',
        'terminal.sectionConfiguration': 'Configuration',
        'terminal.sectionConfigurationDesc': 'Shell configuration files and PowerShell management',
        'terminal.sectionNetwork': 'Network',
        'terminal.sectionNetworkDesc': 'Proxy configuration and network settings',
        'terminal.quickStatus': 'Quick Status',
        'terminal.detected': 'detected',
        'terminal.saved': 'saved',
        'terminal.healthCheck': 'Health',
        'terminal.healthStatus.unchecked': 'Unchecked',
        'terminal.proxyModeNone': 'None',
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
  proxyMode: 'none',
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
  validateConfigContent: jest.fn(),
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
  shellReadouts: {},
  frameworkReadouts: {},
};

jest.mock('@/hooks/terminal/use-terminal', () => ({
  useTerminal: () => mockTerminalHookState,
}));

// Mock section components
jest.mock('@/components/terminal/sections/shell-environment-section', () => ({
  ShellEnvironmentSection: () => <div data-testid="shell-environment-section">Shell Environment Content</div>,
}));

jest.mock('@/components/terminal/sections/profiles-section', () => ({
  ProfilesSection: ({ onFromTemplate }: { onFromTemplate?: () => void }) => (
    <div data-testid="profiles-section">
      Profiles Content
      <button type="button" onClick={() => onFromTemplate?.()}>open-template-picker</button>
    </div>
  ),
}));

jest.mock('@/components/terminal/sections/configuration-section', () => ({
  ConfigurationSection: ({
    onDirtyChange,
    onRequestDiscard,
    onRefreshHandled,
    refreshIntent,
  }: {
    onDirtyChange?: (value: boolean) => void;
    onRequestDiscard?: () => void;
    onRefreshHandled?: (handled: { configEntries: boolean; configMetadata: boolean }) => void;
    refreshIntent?: { configEntries: boolean; configMetadata: boolean };
  }) => (
    <div data-testid="configuration-section">
      Configuration Content
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
    </div>
  ),
}));

jest.mock('@/components/terminal/sections/network-section', () => ({
  NetworkSection: () => <div data-testid="network-section">Network Content</div>,
}));

jest.mock('@/components/terminal', () => ({
  TerminalProfileDialog: () => null,
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

function clickNavButton(name: string) {
  const buttons = screen.getAllByRole('button');
  const navButton = buttons.find((btn) => btn.textContent?.includes(name));
  if (!navButton) throw new Error(`Nav button "${name}" not found`);
  return userEvent.setup().click(navButton);
}

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

  it('renders sidebar with 4 section nav buttons', () => {
    render(<TerminalPage />);
    const buttons = screen.getAllByRole('button');
    const navLabels = ['Shell Environment', 'Profiles', 'Configuration', 'Network'];
    for (const label of navLabels) {
      expect(buttons.some((btn) => btn.textContent?.includes(label))).toBe(true);
    }
  });

  it('shows shell environment section by default', () => {
    render(<TerminalPage />);
    expect(screen.getByTestId('shell-environment-section')).toBeInTheDocument();
  });

  it('switches to profiles section', async () => {
    render(<TerminalPage />);
    await clickNavButton('Profiles');
    await waitFor(() => {
      expect(screen.getByTestId('profiles-section')).toBeInTheDocument();
    });
  });

  it('switches to configuration section', async () => {
    render(<TerminalPage />);
    await clickNavButton('Configuration');
    await waitFor(() => {
      expect(screen.getByTestId('configuration-section')).toBeInTheDocument();
    });
  });

  it('switches to network section and loads proxy config', async () => {
    render(<TerminalPage />);
    await clickNavButton('Network');
    await waitFor(() => {
      expect(screen.getByTestId('network-section')).toBeInTheDocument();
    });
    expect(mockLoadProxyConfig).toHaveBeenCalledTimes(1);
  });

  it('guards section switch when config editor is dirty until discard is confirmed', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await clickNavButton('Configuration');
    await waitFor(() => {
      expect(screen.getByTestId('configuration-section')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /set-config-dirty/i }));
    await clickNavButton('Profiles');

    expect(screen.getByText('terminal.unsavedChangesTitle')).toBeInTheDocument();
    expect(screen.queryByTestId('profiles-section')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /terminal\.cancel/i }));
    expect(screen.queryByTestId('profiles-section')).not.toBeInTheDocument();

    await clickNavButton('Profiles');
    await user.click(screen.getByRole('button', { name: /terminal\.discardAndContinue/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profiles-section')).toBeInTheDocument();
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

    await clickNavButton('Configuration');
    await waitFor(() => {
      expect(screen.getByTestId('configuration-section')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /acknowledge-config-refresh/i }));
    expect(mockTerminalHookState.markResourcesFresh).toHaveBeenCalledWith(['configEntries', 'configMetadata']);

    await user.click(screen.getByRole('button', { name: /set-config-dirty/i }));
    await clickNavButton('Profiles');

    expect(screen.getByText('terminal.unsavedChangesTitle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /terminal\.discardAndContinue/i }));
    await waitFor(() => {
      expect(screen.getByTestId('profiles-section')).toBeInTheDocument();
    });
  });

  it('wires custom template creation through the template picker workflow', async () => {
    const user = userEvent.setup();
    render(<TerminalPage />);

    await clickNavButton('Profiles');
    await waitFor(() => {
      expect(screen.getByTestId('profiles-section')).toBeInTheDocument();
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

  it('renders quick status widget', () => {
    render(<TerminalPage />);
    expect(screen.getByText('Quick Status')).toBeInTheDocument();
  });
});
