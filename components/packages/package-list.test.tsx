import { render, screen } from '@testing-library/react';
import { PackageList } from './package-list';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'packages.noPackages': 'No packages found',
        'packages.noResults': 'No packages found',
        'packages.noPackagesInstalled': 'No packages installed',
        'packages.searchTips': 'Try searching for a package',
        'packages.description': 'Install packages to get started',
        'packages.install': 'Install',
        'packages.uninstall': 'Uninstall',
        'packages.update': 'Update',
        'packages.pin': 'Pin',
        'packages.unpin': 'Unpin',
        'packages.bookmark': 'Bookmark',
        'packages.removeBookmark': 'Remove bookmark',
        'packages.installed': 'Installed',
        'packages.notInstalled': 'Not installed',
        'packages.selected': `${params?.count ?? 0} selected`,
        'packages.selectAll': 'Select all',
        'packages.deselectAll': 'Deselect all',
        'common.install': 'Install',
        'common.uninstall': 'Uninstall',
        'common.info': 'Info',
        'common.cancel': 'Cancel',
        'packages.installConfirm': 'Install package?',
        'packages.uninstallConfirm': 'Uninstall package?',
        'packages.version': 'Version',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: () => ({
    selectedPackages: [],
    togglePackageSelection: jest.fn(),
    selectAllPackages: jest.fn(),
    clearPackageSelection: jest.fn(),
  }),
}));

const mockPackages = [
  { name: 'numpy', version: '1.24.0', provider: 'pip', installed: true },
  { name: 'pandas', version: '2.0.0', provider: 'pip', installed: false },
];

const defaultProps = {
  packages: mockPackages as unknown as Parameters<typeof PackageList>[0]['packages'],
  type: 'search' as const,
  onInstall: jest.fn(),
  onUninstall: jest.fn(),
  onSelect: jest.fn(),
};

describe('PackageList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders package list', () => {
    render(<PackageList {...defaultProps} />);
    expect(screen.getByText('numpy')).toBeInTheDocument();
    expect(screen.getByText('pandas')).toBeInTheDocument();
  });

  it('shows empty state when no packages', () => {
    render(<PackageList {...defaultProps} packages={[]} />);
    // Component uses t('packages.noResults') for search type
    expect(screen.getByText('No packages found')).toBeInTheDocument();
  });

  it('renders install buttons for packages', () => {
    render(<PackageList {...defaultProps} />);

    // Check that install/info buttons are rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('displays package names in the list', () => {
    render(<PackageList {...defaultProps} />);

    // Verify package names are displayed
    expect(screen.getByText('numpy')).toBeInTheDocument();
    expect(screen.getByText('pandas')).toBeInTheDocument();
  });

  it('shows provider badge for packages', () => {
    render(<PackageList {...defaultProps} />);
    // Component shows provider badge, not "Installed" text
    expect(screen.getAllByText('pip').length).toBeGreaterThan(0);
  });
});
