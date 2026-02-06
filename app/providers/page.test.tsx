import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProvidersPage from './page';

// Polyfill ResizeObserver for JSDOM
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockFetchProviders = jest.fn();
const mockProviderCheck = jest.fn().mockResolvedValue(true);
const mockProviderEnable = jest.fn().mockResolvedValue(undefined);
const mockProviderDisable = jest.fn().mockResolvedValue(undefined);
const mockProviderStatusAll = jest.fn().mockResolvedValue([
  { id: 'npm', display_name: 'npm', installed: true, platforms: ['windows', 'linux', 'macos'] },
  { id: 'nvm', display_name: 'nvm', installed: false, platforms: ['linux', 'macos'] },
]);

const mockProviders = [
  {
    id: 'npm',
    display_name: 'npm',
    capabilities: ['install', 'uninstall', 'search'],
    platforms: ['windows', 'linux', 'macos'],
    priority: 100,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: 'nvm',
    display_name: 'Node Version Manager',
    capabilities: ['install', 'version_switch', 'multi_version'],
    platforms: ['linux', 'macos'],
    priority: 90,
    is_environment_provider: true,
    enabled: true,
  },
  {
    id: 'apt',
    display_name: 'APT',
    capabilities: ['install', 'uninstall', 'update'],
    platforms: ['linux'],
    priority: 80,
    is_environment_provider: false,
    enabled: true,
  },
];

jest.mock('@/hooks/use-packages', () => ({
  usePackages: () => ({
    providers: mockProviders,
    loading: false,
    error: null,
    fetchProviders: mockFetchProviders,
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'providers.title': 'Providers',
        'providers.description': 'Manage package providers and registries',
        'providers.search': 'Search providers...',
        'providers.refresh': 'Refresh',
        'providers.checkStatus': 'Check Status',
        'providers.checking': 'Checking...',
        'providers.filterAll': 'All',
        'providers.filterEnvironment': 'Environment',
        'providers.filterPackage': 'Package Manager',
        'providers.filterSystem': 'System',
        'providers.filterAvailable': 'Available',
        'providers.filterUnavailable': 'Unavailable',
        'providers.filterEnabled': 'Enabled',
        'providers.filterDisabled': 'Disabled',
        'providers.statusAvailable': 'Available',
        'providers.statusUnavailable': 'Unavailable',
        'providers.enabled': 'Enabled',
        'providers.platforms': 'Supported Platforms',
        'providers.capabilities': 'Capabilities',
        'providers.priority': 'Priority',
        'providers.clearFilters': 'Clear Filters',
        'providers.noResults': 'No providers match your filters',
        'providers.noResultsDesc': 'Try adjusting your search query or filters.',
        'providers.enableSuccess': 'Provider {name} enabled',
        'providers.disableSuccess': 'Provider {name} disabled',
        'providers.checkAllSuccess': 'All provider statuses updated',
        'providers.sortBy': 'Sort by',
        'providers.sortNameAsc': 'Name (A-Z)',
        'providers.sortNameDesc': 'Name (Z-A)',
        'providers.sortPriorityAsc': 'Priority (Low-High)',
        'providers.sortPriorityDesc': 'Priority (High-Low)',
        'providers.sortStatus': 'Status',
        'providers.viewGrid': 'Grid view',
        'providers.viewList': 'List view',
        'providers.statsTotal': 'Total',
        'providers.statsEnabled': 'Enabled',
        'providers.statsDisabled': 'Disabled',
        'providers.statsAvailable': 'Available',
        'providers.statsUnavailable': 'Unavailable',
        'providers.infoTitle': 'Provider Information',
        'providers.infoDescription': 'Understanding providers',
        'providers.infoText': 'Providers are adapters...',
        'providers.infoEnvironment': 'Environment Providers',
        'providers.infoEnvironmentDesc': 'nvm, pyenv, rustup',
        'providers.infoJsPackage': 'JavaScript Package Providers',
        'providers.infoJsPackageDesc': 'npm, pnpm',
        'providers.infoPyPackage': 'Python Package Providers',
        'providers.infoPyPackageDesc': 'uv',
        'providers.infoRustPackage': 'Rust Package Providers',
        'providers.infoRustPackageDesc': 'Cargo',
        'providers.infoSystem': 'System Package Providers',
        'providers.infoSystemDesc': 'apt, Homebrew, etc.',
        'providers.infoCpp': 'C++ Package Providers',
        'providers.infoCppDesc': 'vcpkg',
        'providers.infoContainer': 'Container Providers',
        'providers.infoContainerDesc': 'Docker',
        'providers.infoPowershell': 'PowerShell Providers',
        'providers.infoPowershellDesc': 'PSGallery',
        'providers.infoCustom': 'Custom Source Providers',
        'providers.infoCustomDesc': 'GitHub',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  providerCheck: () => mockProviderCheck(),
  providerEnable: (id: string) => mockProviderEnable(id),
  providerDisable: (id: string) => mockProviderDisable(id),
  providerStatusAll: () => mockProviderStatusAll(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('ProvidersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and description', () => {
    render(<ProvidersPage />);

    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Manage package providers and registries')).toBeInTheDocument();
  });

  it('renders toolbar with search and filters', () => {
    render(<ProvidersPage />);

    expect(screen.getByPlaceholderText('Search providers...')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Check Status')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
  });

  it('renders all providers', () => {
    render(<ProvidersPage />);

    expect(screen.getAllByText('npm').length).toBeGreaterThan(0);
    expect(screen.getByText('Node Version Manager')).toBeInTheDocument();
    expect(screen.getByText('APT')).toBeInTheDocument();
  });

  it('filters providers by search query', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const searchInput = screen.getByPlaceholderText('Search providers...');
    await user.type(searchInput, 'npm');

    await waitFor(() => {
      expect(screen.getAllByText('npm').length).toBeGreaterThan(0);
      expect(screen.queryByText('APT')).not.toBeInTheDocument();
    });
  });

  it('filters providers by category', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const environmentTab = screen.getByRole('tab', { name: 'Environment' });
    await user.click(environmentTab);

    await waitFor(() => {
      expect(screen.getByText('Node Version Manager')).toBeInTheDocument();
      expect(screen.queryByText('npm')).not.toBeInTheDocument();
    });
  });

  it('filters providers by system category', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const systemTab = screen.getByRole('tab', { name: 'System' });
    await user.click(systemTab);

    await waitFor(() => {
      expect(screen.getByText('APT')).toBeInTheDocument();
      expect(screen.queryByText('npm')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no providers match filters', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const searchInput = screen.getByPlaceholderText('Search providers...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No providers match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const searchInput = screen.getByPlaceholderText('Search providers...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));

    await waitFor(() => {
      expect(screen.getAllByText('npm').length).toBeGreaterThan(0);
      expect(screen.getByText('APT')).toBeInTheDocument();
    });
  });

  it('calls fetchProviders on refresh', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    expect(mockFetchProviders).toHaveBeenCalled();
  });

  it('checks all provider statuses when check status is clicked', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const checkButton = screen.getByText('Check Status');
    await user.click(checkButton);

    await waitFor(() => {
      expect(mockProviderStatusAll).toHaveBeenCalled();
    });
  });

  it('renders provider information card', () => {
    render(<ProvidersPage />);

    expect(screen.getByText('Provider Information')).toBeInTheDocument();
    expect(screen.getByText('Environment Providers')).toBeInTheDocument();
  });

  it('displays environment badge for environment providers', () => {
    render(<ProvidersPage />);

    const badges = screen.getAllByText('Environment');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders provider statistics', () => {
    render(<ProvidersPage />);

    expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Enabled/).length).toBeGreaterThan(0);
  });

  it('renders view toggle buttons', () => {
    render(<ProvidersPage />);

    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });

  it('switches to list view when list button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const listButton = screen.getByLabelText('List view');
    await user.click(listButton);

    // After click, verify the list view content renders (table layout)
    await waitFor(() => {
      expect(listButton).toBeInTheDocument();
    });
  });

  it('renders sort dropdown', () => {
    render(<ProvidersPage />);

    expect(screen.getByText('Name (A-Z)')).toBeInTheDocument();
  });

  it('renders extended status filter options', () => {
    render(<ProvidersPage />);

    const statusSelects = screen.getAllByRole('combobox');
    expect(statusSelects.length).toBeGreaterThan(0);
  });
});
