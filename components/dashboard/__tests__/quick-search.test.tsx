import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickSearch } from '../quick-search';
import type { EnvironmentInfo, InstalledPackage } from '@/lib/tauri';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock locale provider
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'dashboard.quickSearch.placeholder': 'Search environments, packages...',
        'dashboard.quickSearch.noResults': 'No results found',
        'dashboard.quickSearch.environments': 'Environments',
        'dashboard.quickSearch.packages': 'Packages',
        'dashboard.quickSearch.actions': 'Quick Actions',
        'dashboard.quickSearch.recentSearches': 'Recent Searches',
        'dashboard.quickSearch.clearRecent': 'Clear recent',
        'dashboard.quickActions.addEnvironment': 'Add Environment',
        'dashboard.quickActions.installPackage': 'Install Package',
        'dashboard.quickActions.openSettings': 'Settings',
        'common.clear': 'Clear',
        'common.none': 'None',
      };
      return translations[key] || key;
    },
  }),
}));

const mockEnvironments: EnvironmentInfo[] = [
  {
    env_type: 'node',
    provider: 'nvm',
    provider_id: 'nvm',
    available: true,
    current_version: '20.0.0',
    installed_versions: [
      { version: '18.0.0', install_path: '/path/to/18', size: null, installed_at: null, is_current: false },
      { version: '20.0.0', install_path: '/path/to/20', size: null, installed_at: null, is_current: true },
    ],
  },
  {
    env_type: 'python',
    provider: 'pyenv',
    provider_id: 'pyenv',
    available: true,
    current_version: '3.11.0',
    installed_versions: [
      { version: '3.10.0', install_path: '/path/to/310', size: null, installed_at: null, is_current: false },
      { version: '3.11.0', install_path: '/path/to/311', size: null, installed_at: null, is_current: true },
    ],
  },
];

const mockPackages: InstalledPackage[] = [
  { name: 'typescript', version: '5.0.0', provider: 'npm', install_path: '/path', installed_at: '2024-01-01', is_global: true },
  { name: 'react', version: '18.2.0', provider: 'npm', install_path: '/path', installed_at: '2024-01-01', is_global: true },
];

describe('QuickSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders search input with placeholder', () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    expect(screen.getByPlaceholderText('Search environments, packages...')).toBeInTheDocument();
  });

  it('shows dropdown when focused', () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    
    // Should show quick actions when no query
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('filters environments when typing', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'node' } });
    
    await waitFor(() => {
      expect(screen.getByText('node')).toBeInTheDocument();
    });
  });

  it('filters packages when typing', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'typescript' } });
    
    await waitFor(() => {
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  it('shows no results message when no matches', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('clears input when clear button is clicked', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(input.value).toBe('test');
    
    const clearButton = screen.getByLabelText('Clear');
    fireEvent.click(clearButton);
    
    expect(input.value).toBe('');
  });

  it('navigates when selecting an environment result', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'node' } });
    
    await waitFor(() => {
      expect(screen.getByText('node')).toBeInTheDocument();
    });
    
    // Click on the result
    const result = screen.getByText('node').closest('button');
    if (result) {
      fireEvent.click(result);
    }
    
    expect(mockPush).toHaveBeenCalledWith('/environments');
  });

  it('handles keyboard navigation with arrow keys', async () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    
    // Arrow down should select first item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    // No error should occur
    expect(input).toBeInTheDocument();
  });

  it('closes dropdown on Escape key', () => {
    render(
      <QuickSearch environments={mockEnvironments} packages={mockPackages} />
    );
    
    const input = screen.getByPlaceholderText('Search environments, packages...');
    fireEvent.focus(input);
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    
    fireEvent.keyDown(input, { key: 'Escape' });
    
    // Dropdown should be closed (Quick Actions not visible)
    expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
  });
});
