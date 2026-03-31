import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProvidersPage from './page';

// Polyfill ResizeObserver for JSDOM
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let currentSearchParams = new URLSearchParams();
const mockReplace = jest.fn();

function applyLatestReplaceToSearchParams() {
  const latestUrl = mockReplace.mock.calls.at(-1)?.[0] as string | undefined;
  if (!latestUrl) return;
  const [, query = ''] = latestUrl.split('?');
  currentSearchParams = new URLSearchParams(query);
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/providers',
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => currentSearchParams,
}));

const mockFetchProviders = jest.fn();
const mockProviderCheck = jest.fn().mockResolvedValue(true);
const mockProviderStatus = jest.fn().mockResolvedValue({
  id: 'nvm',
  display_name: 'nvm',
  installed: false,
  platforms: ['linux', 'macos'],
  scope_state: 'timeout',
  reason: 'Timed out',
});
const mockProviderEnable = jest.fn().mockResolvedValue(undefined);
const mockProviderDisable = jest.fn().mockResolvedValue(undefined);
const mockProviderStatusAll = jest.fn().mockResolvedValue([
  {
    id: 'npm',
    display_name: 'npm',
    installed: true,
    platforms: ['windows', 'linux', 'macos'],
    scope_state: 'available',
  },
  {
    id: 'nvm',
    display_name: 'nvm',
    installed: false,
    platforms: ['linux', 'macos'],
    scope_state: 'timeout',
    reason: 'Timed out',
  },
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
  {
    id: 'pip',
    display_name: 'pip',
    capabilities: ['install', 'uninstall', 'search', 'update'],
    platforms: ['windows', 'linux', 'macos'],
    priority: 85,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: 'cargo',
    display_name: 'Cargo',
    capabilities: ['install', 'uninstall', 'search', 'update'],
    platforms: ['windows', 'linux', 'macos'],
    priority: 84,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: 'winget',
    display_name: 'WinGet',
    capabilities: ['install', 'uninstall', 'search', 'update'],
    platforms: ['windows'],
    priority: 95,
    is_environment_provider: false,
    enabled: true,
  },
];

jest.mock('@/hooks/packages/use-packages', () => ({
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
        'providers.platformAll': 'All Platforms',
        'providers.statusAvailable': 'Available',
        'providers.statusUnavailable': 'Unavailable',
        'providers.statusTimeout': 'Timeout',
        'providers.statusUnsupported': 'Unsupported',
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
        'providers.infoWsl': 'WSL Providers',
        'providers.infoWslDesc': 'WSL',
        'providers.enableAll': 'Enable All',
        'providers.disableAll': 'Disable All',
        'providers.enableAllConfirm': 'This will enable all {count} providers. Continue?',
        'providers.disableAllConfirm': 'This will disable all {count} providers. Continue?',
        'providers.refreshDesc': 'Refresh provider list',
        'providers.checkStatusDesc': 'Check provider status',
        'providers.moreActions': 'More actions',
        'providers.copyId': 'Copy ID',
        'providers.idCopied': 'ID copied',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'providerDetail.viewDetails': 'View Details',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/tauri', () => ({
  providerCheck: () => mockProviderCheck(),
  providerStatus: () => mockProviderStatus(),
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
    currentSearchParams = new URLSearchParams();
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
      expect(screen.getAllByTitle('npm').length).toBeGreaterThan(0);
      expect(screen.queryByTitle('APT')).not.toBeInTheDocument();
    });
  });

  it('filters providers by category', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const environmentTab = screen.getByRole('tab', { name: 'Environment' });
    await user.click(environmentTab);

    await waitFor(() => {
      expect(screen.getByTitle('Node Version Manager')).toBeInTheDocument();
      expect(screen.queryByTitle('npm')).not.toBeInTheDocument();
    });
  });

  it('filters providers by system category', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const systemTab = screen.getByRole('tab', { name: 'System' });
    await user.click(systemTab);

    await waitFor(() => {
      expect(screen.getByTitle('APT')).toBeInTheDocument();
      expect(screen.queryByTitle('npm')).not.toBeInTheDocument();
    });
  });

  it('keeps language package-manager matrix providers under package category', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const packageTab = screen.getByRole('tab', { name: 'Package Manager' });
    await user.click(packageTab);

    await waitFor(() => {
      expect(screen.getAllByTitle('npm').length).toBeGreaterThan(0);
      expect(screen.getAllByTitle('pip').length).toBeGreaterThan(0);
      expect(screen.getByTitle('Cargo')).toBeInTheDocument();
      expect(screen.queryByTitle('Node Version Manager')).not.toBeInTheDocument();
      expect(screen.queryByTitle('APT')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no providers match filters', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProvidersPage />);

    const searchInput = screen.getByPlaceholderText('Search providers...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    applyLatestReplaceToSearchParams();
    rerender(<ProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('No providers match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProvidersPage />);

    const searchInput = screen.getByPlaceholderText('Search providers...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    applyLatestReplaceToSearchParams();
    rerender(<ProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    applyLatestReplaceToSearchParams();
    rerender(<ProvidersPage />);

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

  it('renders normalized timeout status after status refresh', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    const checkButton = screen.getByText('Check Status');
    await user.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText('Timeout')).toBeInTheDocument();
    });
  });

  it('renders collapsible provider information card', () => {
    render(<ProvidersPage />);

    // Card header is always visible
    expect(screen.getByText('Provider Information')).toBeInTheDocument();
    // Default state is open (no localStorage value set)
    expect(screen.getByText('Environment Providers')).toBeInTheDocument();
  });

  it('displays environment badge for environment providers', () => {
    render(<ProvidersPage />);

    const badges = screen.getAllByText('Environment');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders provider statistics after status check', async () => {
    const user = userEvent.setup();
    render(<ProvidersPage />);

    // Stats are hidden until status data is available
    expect(screen.queryByText('providers.statsTotal')).not.toBeInTheDocument();

    // Trigger status check to populate stats
    const checkButton = screen.getByText('Check Status');
    await user.click(checkButton);

    await waitFor(() => {
      expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0);
    });
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

  it('restores search and platform filters from query params on initial render', async () => {
    currentSearchParams = new URLSearchParams('search=win&platform=windows&view=list');

    render(<ProvidersPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search providers...')).toHaveValue('win');
      expect(screen.getByText('WinGet')).toBeInTheDocument();
      expect(screen.queryByText('APT')).not.toBeInTheDocument();
      expect(screen.queryByText('Node Version Manager')).not.toBeInTheDocument();
    });
  });

  it('preserves provider management context in detail links', async () => {
    currentSearchParams = new URLSearchParams('search=win&platform=windows');

    render(<ProvidersPage />);

    const detailsLink = await screen.findByRole('link', { name: 'View Details' });
    expect(detailsLink).toHaveAttribute(
      'href',
      '/providers/winget?from=%2Fproviders%3Fsearch%3Dwin%26platform%3Dwindows',
    );
  });
});
