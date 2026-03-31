import { render, screen } from '@testing-library/react';
import PackagesPage from './page';

const mockPanel = jest.fn(() => <div data-testid="shared-panel-root">Shared Panel</div>);

jest.mock('@/hooks/packages/use-packages', () => ({
  usePackages: () => ({
    searchResults: [],
    installedPackages: [],
    providers: [],
    loading: false,
    installing: false,
    error: null,
    pinnedPackages: [],
    checkForUpdates: jest.fn(),
    installPackages: jest.fn(),
    uninstallPackages: jest.fn(),
    fetchInstalledPackages: jest.fn(),
    fetchProviders: jest.fn(),
    fetchPackageInfo: jest.fn(),
    advancedSearch: jest.fn(),
    getSuggestions: jest.fn(),
    batchInstall: jest.fn(),
    batchUpdate: jest.fn(),
    batchUninstall: jest.fn(),
    resolveDependencies: jest.fn(),
    resolveConflicts: jest.fn(),
    comparePackages: jest.fn(),
    pinPackage: jest.fn(),
    unpinPackage: jest.fn(),
    rollbackPackage: jest.fn(),
    fetchPinnedPackages: jest.fn(),
    getInstallHistory: jest.fn(),
    clearInstallHistory: jest.fn(),
    preflightSummary: null,
    preflightPackages: [],
    isPreflightOpen: false,
    confirmPreflight: jest.fn(),
    dismissPreflight: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: () => ({
    selectedPackages: [],
    clearPackageSelection: jest.fn(),
    bookmarkedPackages: [],
    toggleBookmark: jest.fn(),
    restoreBookmarks: jest.fn(),
    availableUpdates: [],
    updateCheckProgress: null,
    isCheckingUpdates: false,
    updateCheckErrors: [],
    updateCheckProviderOutcomes: [],
    updateCheckCoverage: null,
    lastUpdateCheck: null,
    searchMeta: null,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => true,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => ({
      'packages.title': 'Packages',
      'packages.description': 'Search, install, and manage packages',
    }[key] ?? key),
  }),
}));

jest.mock('@/hooks/shared/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('@/components/packages/shared/package-operation-panel', () => ({
  PackageOperationPanel: (props: Record<string, unknown>) => mockPanel(props),
}));

jest.mock('@/components/packages/shared/package-operation-context', () => ({
  PackageOperationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/packages/package-details-dialog', () => ({
  PackageDetailsDialog: () => null,
}));

jest.mock('@/components/packages/batch-operations', () => ({
  BatchOperations: () => null,
}));

jest.mock('@/components/packages/package-comparison-dialog', () => ({
  PackageComparisonDialog: () => null,
}));

jest.mock('@/components/packages/provider-status-badge', () => ({
  ProviderStatusBadge: () => null,
}));

jest.mock('@/components/packages/export-import-dialog', () => ({
  ExportImportDialog: () => null,
}));

jest.mock('@/components/packages/shared/pre-flight-dialog', () => ({
  PreFlightDialog: () => null,
}));

describe('PackagesPage shared panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the desktop package workspace through PackageOperationPanel full mode', () => {
    render(<PackagesPage />);

    expect(screen.getByTestId('shared-panel-root')).toBeInTheDocument();
    expect(mockPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'full',
      }),
    );
  });
});
