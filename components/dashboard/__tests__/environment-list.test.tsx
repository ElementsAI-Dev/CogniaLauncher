import { render, screen, fireEvent } from '@testing-library/react';
import { EnvironmentList } from '../environment-list';
import type { EnvironmentInfo } from '@/lib/tauri';

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
        'dashboard.environmentList.title': 'Environments',
        'dashboard.environmentList.all': 'All',
        'dashboard.environmentList.available': 'Available',
        'dashboard.environmentList.unavailable': 'Unavailable',
        'dashboard.environmentList.noResults': 'No environments match the filter',
        'dashboard.environmentList.showMore': 'Show more',
        'dashboard.environmentList.showLess': 'Show less',
        'dashboard.activeEnvironmentsDesc': 'Currently available environment managers',
        'dashboard.noEnvironments': 'No environments detected',
        'dashboard.packageList.viewAll': 'View All',
        'environments.details.versions': 'versions',
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
      { version: '18.0.0', install_path: '/path', size: null, installed_at: null, is_current: false },
      { version: '20.0.0', install_path: '/path', size: null, installed_at: null, is_current: true },
    ],
  },
  {
    env_type: 'python',
    provider: 'pyenv',
    provider_id: 'pyenv',
    available: false,
    current_version: null,
    installed_versions: [],
  },
  {
    env_type: 'rust',
    provider: 'rustup',
    provider_id: 'rustup',
    available: true,
    current_version: '1.70.0',
    installed_versions: [
      { version: '1.70.0', install_path: '/path', size: null, installed_at: null, is_current: true },
    ],
  },
];

describe('EnvironmentList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders environment list title', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    expect(screen.getByText('Environments')).toBeInTheDocument();
  });

  it('renders environments', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('nvm')).toBeInTheDocument();
  });

  it('shows empty state when no environments', () => {
    render(<EnvironmentList environments={[]} />);
    
    expect(screen.getByText('No environments detected')).toBeInTheDocument();
  });

  it('filters environments by availability', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    // Open filter dropdown and select "Available"
    const filterTrigger = screen.getByRole('combobox');
    fireEvent.click(filterTrigger);
    
    const availableOption = screen.getByText('Available');
    fireEvent.click(availableOption);
    
    // Should show only available environments
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.queryByText('python')).not.toBeInTheDocument();
  });

  it('navigates to environment details when clicked', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    const envItem = screen.getByText('node').closest('button');
    if (envItem) {
      fireEvent.click(envItem);
    }
    
    expect(mockPush).toHaveBeenCalledWith('/environments?selected=node');
  });

  it('shows version badge for current version', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    expect(screen.getByText('20.0.0')).toBeInTheDocument();
  });

  it('limits displayed environments based on initialLimit', () => {
    render(<EnvironmentList environments={mockEnvironments} initialLimit={2} />);
    
    // Should show "Show more" button since there are 3 environments but limit is 2
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('expands list when Show more is clicked', () => {
    render(<EnvironmentList environments={mockEnvironments} initialLimit={2} />);
    
    const showMoreButton = screen.getByText('Show more');
    fireEvent.click(showMoreButton);
    
    // Should now show "Show less"
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('navigates to environments page when View All is clicked', () => {
    render(<EnvironmentList environments={mockEnvironments} />);
    
    const viewAllButton = screen.getByText('View All');
    fireEvent.click(viewAllButton);
    
    expect(mockPush).toHaveBeenCalledWith('/environments');
  });
});
