import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvironmentsPage from './page';

const mockFetchEnvironments = jest.fn().mockResolvedValue(undefined);
const mockFetchProviders = jest.fn().mockResolvedValue(undefined);
const mockDetectVersions = jest.fn().mockResolvedValue(undefined);
const mockInstallVersion = jest.fn().mockResolvedValue(undefined);
const mockUninstallVersion = jest.fn().mockResolvedValue(undefined);
const mockSetGlobalVersion = jest.fn().mockResolvedValue(undefined);
const mockSetLocalVersion = jest.fn().mockResolvedValue(undefined);
const mockOpenAddDialog = jest.fn();
const mockCheckAllEnvUpdates = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/use-environments', () => ({
  useEnvironments: () => ({
    environments: [
      {
        env_type: 'node',
        provider: 'nvm',
        provider_id: 'nvm',
        available: true,
        current_version: '20.0.0',
        installed_versions: [
          { version: '18.0.0', install_path: '/path/18', installed_at: '' },
          { version: '20.0.0', install_path: '/path/20', installed_at: '' },
        ],
      },
      {
        env_type: 'python',
        provider: 'pyenv',
        provider_id: 'pyenv',
        available: true,
        current_version: '3.12.0',
        installed_versions: [
          { version: '3.12.0', install_path: '/path/312', installed_at: '' },
        ],
      },
    ],
    detectedVersions: [],
    availableProviders: [
      { id: 'nvm', display_name: 'nvm', env_type: 'node' },
      { id: 'pyenv', display_name: 'pyenv', env_type: 'python' },
    ],
    loading: false,
    error: null,
    fetchEnvironments: mockFetchEnvironments,
    installVersion: mockInstallVersion,
    uninstallVersion: mockUninstallVersion,
    setGlobalVersion: mockSetGlobalVersion,
    setLocalVersion: mockSetLocalVersion,
    detectVersions: mockDetectVersions,
    fetchProviders: mockFetchProviders,
    openAddDialog: mockOpenAddDialog,
    checkAllEnvUpdates: mockCheckAllEnvUpdates,
  }),
}));

jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: Object.assign(
    () => ({
      versionBrowserOpen: false,
      versionBrowserEnvType: null,
      closeVersionBrowser: jest.fn(),
      detailsPanelOpen: false,
      detailsPanelEnvType: null,
      closeDetailsPanel: jest.fn(),
      selectedVersions: [],
      clearVersionSelection: jest.fn(),
      searchQuery: '',
      statusFilter: 'all',
      sortBy: 'name',
      viewMode: 'grid',
      setSearchQuery: jest.fn(),
      setStatusFilter: jest.fn(),
      setSortBy: jest.fn(),
      setViewMode: jest.fn(),
      clearFilters: jest.fn(),
      updateCheckResults: [],
    }),
    {
      getState: () => ({
        setEnvSettings: jest.fn(),
        getEnvSettings: jest.fn().mockReturnValue({}),
      }),
    }
  ),
}));

jest.mock('@/hooks/use-auto-version', () => ({
  useAutoVersionSwitch: jest.fn(),
  useProjectPath: () => ({ projectPath: '/test/project' }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'environments.title': 'Environments',
        'environments.description': 'Manage your development environments',
        'environments.addEnvironment': 'Add Environment',
        'environments.noMatchingEnvironments': 'No matching environments',
        'environments.toolbar.clearAll': 'Clear All',
        'environments.errorBoundary.title': 'Error',
        'environments.errorBoundary.description': 'Something went wrong',
        'environments.errorBoundary.tryAgain': 'Try Again',
        'environments.profiles.title': 'Profiles',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/components/environments/environment-card', () => ({
  EnvironmentCard: ({ env }: { env: { env_type: string } }) => (
    <div data-testid={`env-card-${env.env_type}`}>{env.env_type}</div>
  ),
}));

jest.mock('@/components/environments/add-environment-dialog', () => ({
  AddEnvironmentDialog: () => <div data-testid="add-dialog" />,
}));

jest.mock('@/components/environments/installation-progress-dialog', () => ({
  InstallationProgressDialog: () => null,
}));

jest.mock('@/components/environments/version-browser-panel', () => ({
  VersionBrowserPanel: () => null,
}));

jest.mock('@/components/environments/environment-details-panel', () => ({
  EnvironmentDetailsPanel: () => null,
}));

jest.mock('@/components/environments/environment-error-boundary', () => ({
  EnvironmentErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EnvironmentCardErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/environments/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state">No environments</div>,
}));

jest.mock('@/components/environments/batch-operations', () => ({
  EnvironmentBatchOperations: () => null,
}));

jest.mock('@/components/environments/environment-toolbar', () => ({
  EnvironmentToolbar: ({ searchQuery, onSearchChange }: { searchQuery: string; onSearchChange: (v: string) => void }) => (
    <div data-testid="toolbar">
      <input
        data-testid="search-input"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
      />
    </div>
  ),
}));

jest.mock('@/components/environments/env-updates-summary', () => ({
  EnvUpdatesSummary: () => null,
}));

jest.mock('@/components/environments/profile-manager', () => ({
  ProfileManager: () => null,
}));

describe('EnvironmentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByText('Environments')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByText('Manage your development environments')).toBeInTheDocument();
  });

  it('renders add environment button', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByRole('button', { name: /add environment/i })).toBeInTheDocument();
  });

  it('calls openAddDialog when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<EnvironmentsPage />);

    await user.click(screen.getByRole('button', { name: /add environment/i }));
    expect(mockOpenAddDialog).toHaveBeenCalled();
  });

  it('renders environment cards', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByTestId('env-card-node')).toBeInTheDocument();
    expect(screen.getByTestId('env-card-python')).toBeInTheDocument();
  });

  it('renders toolbar', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('renders profiles button', () => {
    render(<EnvironmentsPage />);
    expect(screen.getByRole('button', { name: /profiles/i })).toBeInTheDocument();
  });

  it('fetches environments and providers on mount', () => {
    render(<EnvironmentsPage />);
    expect(mockFetchEnvironments).toHaveBeenCalled();
    expect(mockFetchProviders).toHaveBeenCalled();
    expect(mockDetectVersions).toHaveBeenCalledWith('.');
  });
});
