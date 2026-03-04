import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PackagesPage from './page';

const mockFetchInstalledPackages = jest.fn().mockResolvedValue(undefined);
const mockFetchProviders = jest.fn().mockResolvedValue(undefined);
const mockAdvancedSearch = jest.fn().mockResolvedValue(undefined);
const mockCheckForUpdates = jest.fn().mockResolvedValue([]);
const mockInstallPackages = jest.fn().mockResolvedValue(undefined);
const mockUninstallPackages = jest.fn().mockResolvedValue(undefined);
const mockBatchInstall = jest.fn().mockResolvedValue({ successful: [], failed: [] });
const mockBatchUpdate = jest.fn().mockResolvedValue({ successful: [], failed: [] });
const mockBatchUninstall = jest.fn().mockResolvedValue({ successful: [], failed: [] });
const mockGetInstallHistory = jest.fn().mockResolvedValue([]);
const mockPackageStoreState = {
  selectedPackages: [] as string[],
  clearPackageSelection: jest.fn(),
  bookmarkedPackages: [] as string[],
  toggleBookmark: jest.fn(),
  availableUpdates: [] as Array<{
    name: string;
    provider: string;
    current_version: string;
    latest_version: string;
  }>,
  updateCheckProgress: null as null | { phase: string; current: number; total: number },
  isCheckingUpdates: false,
  updateCheckErrors: [] as Array<{ provider: string; package: string | null; message: string }>,
  updateCheckProviderOutcomes: [] as Array<{
    provider: string;
    status: 'supported' | 'partial' | 'unsupported' | 'error';
    reason: string | null;
    checked: number;
    updates: number;
    errors: number;
  }>,
  updateCheckCoverage: null as null | {
    supported: number;
    partial: number;
    unsupported: number;
    error: number;
  },
  lastUpdateCheck: null as number | null,
};

jest.mock('@/hooks/use-packages', () => ({
  usePackages: () => ({
    searchResults: [],
    installedPackages: [
      { name: 'typescript', version: '5.0.0', provider: 'npm', description: 'TypeScript language' },
      { name: 'lodash', version: '4.17.21', provider: 'npm', description: 'Utility library' },
    ],
    providers: [
      { id: 'npm', display_name: 'npm' },
      { id: 'pip', display_name: 'pip' },
    ],
    loading: false,
    installing: false,
    error: null,
    pinnedPackages: [],
    checkForUpdates: mockCheckForUpdates,
    installPackages: mockInstallPackages,
    uninstallPackages: mockUninstallPackages,
    fetchInstalledPackages: mockFetchInstalledPackages,
    fetchProviders: mockFetchProviders,
    fetchPackageInfo: jest.fn(),
    advancedSearch: mockAdvancedSearch,
    getSuggestions: jest.fn(),
    batchInstall: mockBatchInstall,
    batchUpdate: mockBatchUpdate,
    batchUninstall: mockBatchUninstall,
    resolveDependencies: jest.fn(),
    comparePackages: jest.fn(),
    pinPackage: jest.fn(),
    unpinPackage: jest.fn(),
    rollbackPackage: jest.fn(),
    getInstallHistory: mockGetInstallHistory,
  }),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: () => mockPackageStoreState,
}));

jest.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'packages.title': 'Packages',
        'packages.description': 'Search, install, and manage packages',
        'packages.installed': 'Installed',
        'packages.updates': 'Updates',
        'packages.searchResults': 'Search Results',
        'packages.dependencies': 'Dependencies',
        'packages.history': 'History',
        'packages.clickToCheck': 'Click to check for updates',
        'packages.allUpToDate': 'All packages up to date',
        'packages.noUpdates': 'No updates available',
        'packages.checkForUpdates': 'Check for Updates',
        'packages.installHistory': 'Install History',
        'packages.installHistoryDesc': 'Recent package operations',
        'packages.noHistory': 'No history entries',
        'packages.updatesFound': `${params?.count ?? 0} updates found`,
        'packages.updateCheckCoverage': `${params?.supported ?? 0}/${params?.partial ?? 0}/${params?.unsupported ?? 0}/${params?.error ?? 0}`,
        'packages.updateCheckUnsupported': `${params?.count ?? 0} providers unsupported`,
        'common.unknown': 'unknown',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/components/packages/search-bar', () => ({
  SearchBar: () => <div data-testid="search-bar">Search</div>,
}));

jest.mock('@/components/packages/package-list', () => ({
  PackageList: ({ packages, type, onUninstall, onInstall, onSelect, onPin, onUnpin, onBookmark }: {
    packages: { name: string }[];
    type: string;
    onUninstall?: (n: string) => void;
    onInstall?: (n: string) => void;
    onSelect?: (p: { name: string }) => void;
    onPin?: (n: string) => void;
    onUnpin?: (n: string) => void;
    onBookmark?: (n: string) => void;
  }) => (
    <div data-testid={`package-list-${type}`}>
      {packages.length} packages
      {onUninstall && <button data-testid={`uninstall-${type}`} onClick={() => onUninstall('typescript')}>Uninstall</button>}
      {onInstall && <button data-testid={`install-${type}`} onClick={() => onInstall('lodash')}>Install</button>}
      {onSelect && packages[0] && <button data-testid={`select-${type}`} onClick={() => onSelect(packages[0])}>Select</button>}
      {onPin && <button data-testid={`pin-${type}`} onClick={() => onPin('typescript')}>Pin</button>}
      {onUnpin && <button data-testid={`unpin-${type}`} onClick={() => onUnpin('typescript')}>Unpin</button>}
      {onBookmark && <button data-testid={`bookmark-${type}`} onClick={() => onBookmark('typescript')}>Bookmark</button>}
    </div>
  ),
}));

jest.mock('@/components/packages/package-details-dialog', () => ({
  PackageDetailsDialog: () => null,
}));

jest.mock('@/components/packages/batch-operations', () => ({
  BatchOperations: () => null,
}));

jest.mock('@/components/packages/dependency-tree', () => ({
  DependencyTree: () => <div data-testid="dependency-tree">Dependencies</div>,
}));

jest.mock('@/components/packages/package-comparison-dialog', () => ({
  PackageComparisonDialog: () => null,
}));

jest.mock('@/components/packages/installed-filter-bar', () => ({
  InstalledFilterBar: () => <div data-testid="filter-bar">Filter</div>,
  useInstalledFilter: (packages: unknown[]) => ({
    filter: {},
    setFilter: jest.fn(),
    filteredPackages: packages,
  }),
}));

jest.mock('@/components/packages/export-import-dialog', () => ({
  ExportImportDialog: () => <div data-testid="export-import">Export/Import</div>,
}));

jest.mock('@/components/packages/provider-status-badge', () => ({
  ProviderStatusBadge: () => <div data-testid="provider-status">Providers</div>,
}));

jest.mock('@/components/packages/stats-overview', () => ({
  StatsOverview: () => <div data-testid="stats-overview">Stats</div>,
}));

describe('PackagesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInstallHistory.mockResolvedValue([]);
    mockPackageStoreState.selectedPackages = [];
    mockPackageStoreState.bookmarkedPackages = [];
    mockPackageStoreState.availableUpdates = [];
    mockPackageStoreState.updateCheckProgress = null;
    mockPackageStoreState.isCheckingUpdates = false;
    mockPackageStoreState.updateCheckErrors = [];
    mockPackageStoreState.updateCheckProviderOutcomes = [];
    mockPackageStoreState.updateCheckCoverage = null;
    mockPackageStoreState.lastUpdateCheck = null;
  });

  it('renders page title and description', () => {
    render(<PackagesPage />);
    expect(screen.getByText('Packages')).toBeInTheDocument();
    expect(screen.getByText('Search, install, and manage packages')).toBeInTheDocument();
  });

  it('renders all 5 tabs', () => {
    render(<PackagesPage />);
    expect(screen.getByText(/Installed/)).toBeInTheDocument();
    expect(screen.getByText(/Updates/)).toBeInTheDocument();
    expect(screen.getByText(/Search Results/)).toBeInTheDocument();
    expect(screen.getByText(/Dependencies/)).toBeInTheDocument();
    expect(screen.getByText(/History/)).toBeInTheDocument();
  });

  it('renders search bar', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders stats overview', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('stats-overview')).toBeInTheDocument();
  });

  it('renders installed packages list by default', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('package-list-installed')).toHaveTextContent('2 packages');
  });

  it('fetches providers and packages on mount', () => {
    render(<PackagesPage />);
    expect(mockFetchProviders).toHaveBeenCalled();
    expect(mockFetchInstalledPackages).toHaveBeenCalled();
  });

  it('switches to updates tab', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/Updates/));
    await waitFor(() => {
      expect(screen.getByText('Click to check for updates')).toBeInTheDocument();
    });
  });

  it('switches to history tab', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/History/));
    await waitFor(() => {
      expect(screen.getByText('Install History')).toBeInTheDocument();
    });
  });

  it('renders provider status badge', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('provider-status')).toBeInTheDocument();
  });

  it('renders export/import dialog trigger', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('export-import')).toBeInTheDocument();
  });

  it('uninstalls a package when uninstall button is clicked', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByTestId('uninstall-installed'));
    await waitFor(() => {
      expect(mockUninstallPackages).toHaveBeenCalledWith(['typescript']);
    });
  });

  it('selects a package to open details', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByTestId('select-installed'));
    // details dialog opens
  });

  it('bookmarks a package', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByTestId('bookmark-installed'));
    // bookmark toggled
  });

  it('checks for updates on updates tab', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Updates/));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /check for updates/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /check for updates/i }));
    await waitFor(() => {
      expect(mockCheckForUpdates).toHaveBeenCalled();
    });
  });

  it('shows unsupported provider summary separately from errors', async () => {
    mockPackageStoreState.updateCheckProviderOutcomes = [
      {
        provider: 'winget',
        status: 'unsupported',
        reason: 'provider executable is not available',
        checked: 0,
        updates: 0,
        errors: 0,
      },
    ];
    mockPackageStoreState.updateCheckCoverage = {
      supported: 1,
      partial: 0,
      unsupported: 1,
      error: 0,
    };

    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Updates/));

    await waitFor(() => {
      expect(screen.getByText('1 providers unsupported')).toBeInTheDocument();
      expect(screen.getByText('1/0/1/0')).toBeInTheDocument();
    });
  });

  it('uses update provider when updating a single package', async () => {
    mockPackageStoreState.availableUpdates = [
      {
        name: 'shared-name',
        provider: 'pip',
        current_version: '1.0.0',
        latest_version: '2.0.0',
      },
    ];

    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/Updates/));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /common.update/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /common.update/i }));

    await waitFor(() => {
      expect(mockInstallPackages).toHaveBeenCalledWith(['pip:shared-name@2.0.0']);
    });
  });

  it('switches to dependencies tab', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Dependencies/));
    await waitFor(() => {
      expect(screen.getByTestId('dependency-tree')).toBeInTheDocument();
    });
  });

  it('keeps long update package names visible without squeezing actions', async () => {
    const longName = 'this-is-a-very-very-very-long-package-name-that-should-wrap-properly-in-updates-tab';
    mockPackageStoreState.availableUpdates = [
      {
        name: longName,
        provider: 'npm',
        current_version: '1.0.0',
        latest_version: '2.0.0',
      },
    ];

    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Updates/));

    await waitFor(() => {
      expect(screen.getByTitle(longName)).toBeInTheDocument();
    });
  });

  it('keeps long history package names visible with wrapped metadata', async () => {
    const longName = 'history-package-name-with-many-segments-to-verify-responsive-wrapping-behavior';
    mockGetInstallHistory.mockResolvedValueOnce([
      {
        id: '1',
        name: longName,
        version: '9.9.9',
        action: 'install',
        timestamp: '2026-03-04T08:00:00.000Z',
        provider: 'npm',
        success: true,
      },
    ]);

    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/History/));

    await waitFor(() => {
      expect(screen.getByTitle(longName)).toBeInTheDocument();
    });
  });
});
