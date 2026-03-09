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
const mockClearInstallHistory = jest.fn().mockResolvedValue(undefined);
const mockPinPackage = jest.fn().mockResolvedValue(undefined);
const mockUnpinPackage = jest.fn().mockResolvedValue(undefined);
const mockRollbackPackage = jest.fn().mockResolvedValue(undefined);
const mockFetchPinnedPackages = jest.fn().mockResolvedValue([]);
const mockUseKeyboardShortcuts = jest.fn();
const mockPush = jest.fn();
let mockPackageDetailsDialogProps: Record<string, unknown> | null = null;
const mockResolveDependencies = jest.fn().mockResolvedValue({
  success: true,
  packages: [],
  tree: [],
  conflicts: [],
  install_order: [],
  total_packages: 0,
  total_size: null,
});
const mockInstalledPackages = [
  { name: 'typescript', version: '5.0.0', provider: 'npm', description: 'TypeScript language' },
  { name: 'lodash', version: '4.17.21', provider: 'npm', description: 'Utility library' },
];
let mockSearchResults: Array<{
  name: string;
  provider: string;
  description: string | null;
  latest_version: string | null;
}> = [];
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
    reason_code?: string | null;
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
  searchMeta: null as null | {
    total: number;
    page: number;
    pageSize: number;
    facets: {
      providers: Record<string, number>;
      licenses: Record<string, number>;
    };
  },
};

jest.mock('@/hooks/use-packages', () => ({
  usePackages: () => ({
    searchResults: mockSearchResults,
    installedPackages: mockInstalledPackages,
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
    resolveDependencies: mockResolveDependencies,
    comparePackages: jest.fn(),
    pinPackage: mockPinPackage,
    unpinPackage: mockUnpinPackage,
    rollbackPackage: mockRollbackPackage,
    fetchPinnedPackages: mockFetchPinnedPackages,
    getInstallHistory: mockGetInstallHistory,
    clearInstallHistory: mockClearInstallHistory,
  }),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: () => mockPackageStoreState,
}));

jest.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: (...args: unknown[]) => mockUseKeyboardShortcuts(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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
        'packages.searchSummary': `Showing ${params?.from ?? 0}-${params?.to ?? 0} of ${params?.total ?? 0}`,
        'packages.searchFacets': 'Search facets',
        'packages.searchFacetProviders': 'Providers',
        'packages.searchFacetLicenses': 'Licenses',
        'packages.searchPrevPage': 'Previous page',
        'packages.searchNextPage': 'Next page',
        'packages.clickToCheck': 'Click to check for updates',
        'packages.allUpToDate': 'All packages up to date',
        'packages.noUpdates': 'No updates available',
        'packages.checkForUpdates': 'Check for Updates',
        'packages.installHistory': 'Install History',
        'packages.installHistoryDesc': 'Recent package operations',
        'packages.historyNameFilter': 'Filter history by package',
        'packages.historyActionFilter': 'Action',
        'packages.historyStatusFilter': 'Status',
        'packages.historyApplyFilters': 'Apply Filters',
        'packages.historyResetFilters': 'Reset Filters',
        'packages.historyStatusAll': 'All statuses',
        'packages.historyStatusSuccess': 'Success',
        'packages.historyStatusFailed': 'Failed',
        'packages.historyOpenDetails': 'View Details',
        'packages.noHistory': 'No history entries',
        'packages.clearHistory': 'Clear History',
        'packages.historyCleared': 'History cleared',
        'packages.historyClearFailed': `Failed to clear history: ${params?.error ?? ''}`,
        'packages.updatesFound': `${params?.count ?? 0} updates found`,
        'packages.updateCheckCoverage': `${params?.supported ?? 0}/${params?.partial ?? 0}/${params?.unsupported ?? 0}/${params?.error ?? 0}`,
        'packages.updateCheckPartial': `${params?.count ?? 0} providers partially supported`,
        'packages.updateCheckUnsupported': `${params?.count ?? 0} providers unsupported`,
        'packages.dependencyResolveFailedFor': `Failed to resolve dependencies for ${params?.name ?? ""}: ${params?.error ?? ""}`,
        'packages.dependencyResolveFailedWithManualHint': `Failed to resolve dependencies for ${params?.name ?? ""}: ${params?.error ?? ""}`,
        'providers.refresh': 'Refresh',
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
  SearchBar: ({
    inputRef,
    onSearch,
  }: {
    inputRef?: { current: HTMLInputElement | null };
    onSearch?: (
      query: string,
      options: {
        providers?: string[];
        installedOnly?: boolean;
        notInstalled?: boolean;
        hasUpdates?: boolean;
        sortBy?: string;
      },
    ) => void;
  }) => (
    <div data-testid="search-bar">
      <input data-testid="packages-search-input" ref={inputRef} />
      <button
        data-testid="trigger-advanced-search"
        onClick={() =>
          onSearch?.('vite', {
            providers: ['npm'],
            installedOnly: true,
            notInstalled: false,
            hasUpdates: true,
            sortBy: 'name',
          })
        }
      >
        Trigger search
      </button>
    </div>
  ),
}));

jest.mock('@/components/packages/package-list', () => ({
  PackageList: ({ packages, type, onUninstall, onInstall, onSelect, onResolveDependencies, onPin, onUnpin, onBookmark }: {
    packages: { name: string }[];
    type: string;
    onUninstall?: (n: string) => void;
    onInstall?: (n: string) => void;
    onSelect?: (p: { name: string }) => void;
    onResolveDependencies?: (p: { name: string; provider?: string; version?: string; latest_version?: string }, source: 'installed' | 'search') => void;
    onPin?: (n: string, version?: string, provider?: string) => void;
    onUnpin?: (n: string) => void;
    onBookmark?: (n: string) => void;
  }) => (
    <div data-testid={`package-list-${type}`}>
      {packages.length} packages
      {onUninstall && <button data-testid={`uninstall-${type}`} onClick={() => onUninstall('typescript')}>Uninstall</button>}
      {onInstall && <button data-testid={`install-${type}`} onClick={() => onInstall('lodash')}>Install</button>}
      {onSelect && packages[0] && <button data-testid={`select-${type}`} onClick={() => onSelect(packages[0])}>Select</button>}
      {onResolveDependencies && packages[0] && (
        <button
          data-testid={`resolve-${type}`}
          onClick={() => onResolveDependencies(packages[0], type as 'installed' | 'search')}
        >
          Resolve
        </button>
      )}
      {onPin && <button data-testid={`pin-${type}`} onClick={() => onPin('typescript', '5.0.0', 'npm')}>Pin</button>}
      {onUnpin && <button data-testid={`unpin-${type}`} onClick={() => onUnpin('typescript')}>Unpin</button>}
      {onBookmark && <button data-testid={`bookmark-${type}`} onClick={() => onBookmark('typescript')}>Bookmark</button>}
    </div>
  ),
}));

jest.mock('@/components/packages/package-details-dialog', () => ({
  PackageDetailsDialog: (props: Record<string, unknown>) => {
    mockPackageDetailsDialogProps = props;
    return null;
  },
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
  ProviderStatusBadge: ({ onRefresh }: { onRefresh?: () => void }) => (
    <div data-testid="provider-status">
      Providers
      <button data-testid="provider-refresh" onClick={() => onRefresh?.()}>
        Refresh providers
      </button>
    </div>
  ),
}));

jest.mock('@/components/packages/stats-overview', () => ({
  StatsOverview: () => <div data-testid="stats-overview">Stats</div>,
}));

describe('PackagesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPackageDetailsDialogProps = null;
    mockGetInstallHistory.mockResolvedValue([]);
    mockClearInstallHistory.mockResolvedValue(undefined);
    mockResolveDependencies.mockResolvedValue({
      success: true,
      packages: [],
      tree: [],
      conflicts: [],
      install_order: [],
      total_packages: 0,
      total_size: null,
    });
    mockSearchResults = [];
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

  it('maps advanced search options into backend search payload contract', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByTestId('trigger-advanced-search'));

    await waitFor(() => {
      expect(mockAdvancedSearch).toHaveBeenCalledWith(
        'vite',
        expect.objectContaining({
          providers: ['npm'],
          sortBy: 'name',
          filters: expect.objectContaining({
            installedOnly: true,
            notInstalled: false,
            hasUpdates: true,
          }),
        }),
      );
    });
  });

  it('focuses package search input when keyboard shortcut action runs', () => {
    render(<PackagesPage />);

    const registration = mockUseKeyboardShortcuts.mock.calls[0][0] as {
      shortcuts: Array<{ key: string; ctrlKey?: boolean; action: () => void }>;
    };
    const searchShortcut = registration.shortcuts.find(
      (shortcut) => shortcut.key === 'f' && shortcut.ctrlKey,
    );
    expect(searchShortcut).toBeDefined();

    searchShortcut?.action();

    expect(screen.getByTestId('packages-search-input')).toHaveFocus();
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

  it('shows history error state when load fails', async () => {
    mockGetInstallHistory.mockRejectedValueOnce(new Error('history unavailable'));
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/History/));
    await waitFor(() => {
      expect(screen.getByText(/history unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^refresh$/i })).toBeInTheDocument();
    });
  });

  it('clears history from history tab', async () => {
    mockGetInstallHistory.mockResolvedValueOnce([
      {
        id: '1',
        name: 'react',
        version: '18.0.0',
        action: 'install',
        timestamp: '2026-03-04T08:00:00.000Z',
        provider: 'npm',
        success: true,
        error_message: null,
      },
    ]);

    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/History/));
    await waitFor(() => {
      expect(screen.getByText('react')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /clear history/i }));
    await waitFor(() => {
      expect(mockClearInstallHistory).toHaveBeenCalled();
    });
  });

  it('renders provider status badge', () => {
    render(<PackagesPage />);
    expect(screen.getByTestId('provider-status')).toBeInTheDocument();
  });

  it('forces provider refresh when provider status badge requests refresh', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    mockFetchProviders.mockClear();

    await user.click(screen.getByTestId('provider-refresh'));

    expect(mockFetchProviders).toHaveBeenCalledTimes(1);
    expect(mockFetchProviders).toHaveBeenCalledWith(true);
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

  it('shows partial provider summary separately from unsupported/errors', async () => {
    mockPackageStoreState.updateCheckProviderOutcomes = [
      {
        provider: 'npm',
        status: 'partial',
        reason: null,
        reason_code: 'native_update_check_failed_with_fallback',
        checked: 10,
        updates: 3,
        errors: 1,
      },
    ];
    mockPackageStoreState.updateCheckCoverage = {
      supported: 0,
      partial: 1,
      unsupported: 0,
      error: 0,
    };

    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Updates/));

    await waitFor(() => {
      expect(screen.getByText('1 providers partially supported')).toBeInTheDocument();
      expect(screen.getByText('0/1/0/0')).toBeInTheDocument();
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

  it('passes selected version through pin action from package detail dialog', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByTestId('select-installed'));

    expect(mockPackageDetailsDialogProps).toBeTruthy();
    const onPin = mockPackageDetailsDialogProps?.onPin as
      | ((name: string, version?: string) => Promise<void>)
      | undefined;
    expect(onPin).toBeDefined();

    await onPin?.('typescript', '4.9.0');

    expect(mockPinPackage).toHaveBeenCalledWith('npm:typescript', '4.9.0');
  });

  it('evaluates installed/current version by provider-aware package identity in detail dialog', async () => {
    mockSearchResults = [
      {
        name: 'typescript',
        provider: 'pip',
        description: 'python wrapper',
        latest_version: '1.0.0',
      },
    ];

    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/Search Results/));
    await user.click(screen.getByTestId('select-search'));

    expect(mockPackageDetailsDialogProps).toBeTruthy();
    expect(mockPackageDetailsDialogProps?.isInstalled).toBe(false);
    expect(mockPackageDetailsDialogProps?.currentVersion).toBeUndefined();
  });

  it('switches to dependencies tab', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Dependencies/));
    await waitFor(() => {
      expect(screen.getByTestId('dependency-tree')).toBeInTheDocument();
    });
  });

  it('resolves dependencies directly from installed list context', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByTestId('resolve-installed'));
    await waitFor(() => {
      expect(mockResolveDependencies).toHaveBeenCalledWith('npm:typescript@5.0.0');
    });
  });

  it('falls back to provider:name lookup when selected context has no version', async () => {
    mockSearchResults = [
      {
        name: 'vite',
        provider: 'npm',
        description: 'Build tool',
        latest_version: null,
      },
    ];
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/Search Results/));
    await user.click(screen.getByTestId('resolve-search'));

    await waitFor(() => {
      expect(mockResolveDependencies).toHaveBeenCalledWith('npm:vite');
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

  it('applies provider-aware history filters through backend query params', async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/History/));
    await user.type(screen.getByPlaceholderText('Filter history by package'), 'react');
    await user.click(screen.getByRole('combobox', { name: /Action/i }));
    await user.click(screen.getByText('install'));
    await user.click(screen.getByRole('combobox', { name: /Status/i }));
    await user.click(screen.getByText('Success'));
    await user.click(screen.getByRole('button', { name: /Apply Filters/i }));

    await waitFor(() => {
      expect(mockGetInstallHistory).toHaveBeenLastCalledWith({
        limit: 200,
        name: 'react',
        provider: undefined,
        action: 'install',
        success: true,
      });
    });
  });

  it('preserves provider context when opening package detail from history', async () => {
    mockGetInstallHistory.mockResolvedValueOnce([
      {
        id: '1',
        name: 'react',
        version: '18.0.0',
        action: 'install',
        timestamp: '2026-03-04T08:00:00.000Z',
        provider: 'npm',
        success: true,
        error_message: null,
      },
    ]);

    const user = userEvent.setup();
    render(<PackagesPage />);

    await user.click(screen.getByText(/History/));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View Details/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /View Details/i }));

    expect(mockPush).toHaveBeenCalledWith('/packages/detail?name=react&provider=npm');
  });

  it('shows synchronized search facets and pagination summary', async () => {
    mockSearchResults = [
      {
        name: 'react',
        provider: 'npm',
        description: 'React library',
        latest_version: '19.0.0',
      },
    ];
    mockPackageStoreState.searchMeta = {
      total: 25,
      page: 1,
      pageSize: 10,
      facets: {
        providers: { npm: 20, pip: 5 },
        licenses: { MIT: 15, Apache: 10 },
      },
    };

    const user = userEvent.setup();
    render(<PackagesPage />);
    await user.click(screen.getByText(/Search Results/));

    await waitFor(() => {
      expect(screen.getByText('Showing 11-11 of 25')).toBeInTheDocument();
      expect(screen.getByText('npm (20)')).toBeInTheDocument();
      expect(screen.getByText('MIT (15)')).toBeInTheDocument();
    });
  });
});
