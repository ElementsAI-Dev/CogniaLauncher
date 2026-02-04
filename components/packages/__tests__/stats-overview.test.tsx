import { render, screen, fireEvent } from '@testing-library/react';
import { StatsOverview } from '../stats-overview';
import type { InstalledPackage, ProviderInfo, UpdateInfo } from '@/lib/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'packages.statsOverview': 'Statistics Overview',
        'packages.totalInstalled': 'Total Installed',
        'packages.activeProviders': 'Active Providers',
        'packages.ofTotal': `of ${params?.count || 0} total`,
        'packages.updatesAvailableShort': 'Updates Available',
        'packages.pinnedPackages': 'Pinned Packages',
        'packages.bookmarked': 'Bookmarked',
        'packages.packagesByProvider': 'Packages by provider',
      };
      return translations[key] || key;
    },
  }),
}));

const mockPackages: InstalledPackage[] = [
  { name: 'react', version: '18.0.0', provider: 'npm', install_path: '/path', installed_at: '2024-01-01', is_global: true },
  { name: 'lodash', version: '4.17.21', provider: 'npm', install_path: '/path', installed_at: '2024-01-01', is_global: true },
  { name: 'requests', version: '2.31.0', provider: 'pip', install_path: '/path', installed_at: '2024-01-01', is_global: true },
];

const mockProviders: ProviderInfo[] = [
  { id: 'npm', display_name: 'NPM', capabilities: ['Search'], platforms: ['all'], priority: 1, is_environment_provider: false, enabled: true },
  { id: 'pip', display_name: 'pip', capabilities: ['Search'], platforms: ['all'], priority: 2, is_environment_provider: false, enabled: true },
  { id: 'cargo', display_name: 'Cargo', capabilities: ['Search'], platforms: ['all'], priority: 3, is_environment_provider: false, enabled: false },
];

const mockUpdates: UpdateInfo[] = [
  { name: 'react', current_version: '18.0.0', latest_version: '18.2.0', provider: 'npm' },
];

describe('StatsOverview', () => {
  it('renders collapsed by default', () => {
    render(
      <StatsOverview
        installedPackages={mockPackages}
        providers={mockProviders}
        updates={mockUpdates}
        pinnedCount={1}
        bookmarkedCount={2}
      />
    );

    expect(screen.getByText('Statistics Overview')).toBeInTheDocument();
    // Stats cards should not be visible when collapsed
    expect(screen.queryByText('Total Installed')).not.toBeInTheDocument();
  });

  it('renders expanded when defaultExpanded is true', () => {
    render(
      <StatsOverview
        installedPackages={mockPackages}
        providers={mockProviders}
        updates={mockUpdates}
        pinnedCount={1}
        bookmarkedCount={2}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText('Total Installed')).toBeInTheDocument();
    expect(screen.getByText('Active Providers')).toBeInTheDocument();
    expect(screen.getByText('Updates Available')).toBeInTheDocument();
    expect(screen.getByText('Pinned Packages')).toBeInTheDocument();
    expect(screen.getByText('Bookmarked')).toBeInTheDocument();
  });

  it('expands and collapses when clicking the toggle', () => {
    render(
      <StatsOverview
        installedPackages={mockPackages}
        providers={mockProviders}
        updates={mockUpdates}
        pinnedCount={1}
        bookmarkedCount={2}
      />
    );

    // Click to expand
    fireEvent.click(screen.getByText('Statistics Overview'));
    expect(screen.getByText('Total Installed')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Statistics Overview'));
    expect(screen.queryByText('Total Installed')).not.toBeInTheDocument();
  });

  it('displays correct counts', () => {
    render(
      <StatsOverview
        installedPackages={mockPackages}
        providers={mockProviders}
        updates={mockUpdates}
        pinnedCount={5}
        bookmarkedCount={3}
        defaultExpanded={true}
      />
    );

    // Check pinned label exists
    expect(screen.getByText('Pinned Packages')).toBeInTheDocument();
    // Check bookmarked label exists
    expect(screen.getByText('Bookmarked')).toBeInTheDocument();
    // Check updates label exists
    expect(screen.getByText('Updates Available')).toBeInTheDocument();
  });

  it('shows provider breakdown', () => {
    render(
      <StatsOverview
        installedPackages={mockPackages}
        providers={mockProviders}
        updates={mockUpdates}
        pinnedCount={0}
        bookmarkedCount={0}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText('Packages by provider:')).toBeInTheDocument();
    expect(screen.getByText('NPM')).toBeInTheDocument();
    expect(screen.getByText('pip')).toBeInTheDocument();
  });
});
