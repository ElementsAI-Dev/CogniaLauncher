import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DependencyTree } from './dependency-tree';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'packages.dependencyTree': 'Dependency Tree',
        'packages.resolveDependencies': 'Resolve',
        'packages.noDependencies': 'No dependencies',
        'packages.totalPackages': 'Total packages',
        'packages.conflicts': 'Conflicts',
        'packages.installed': 'Installed',
        'packages.notInstalled': 'Not installed',
        'packages.searchDependencies': 'Search dependencies...',
      };
      return translations[key] || key;
    },
  }),
}));

const mockOnResolve = jest.fn();

const defaultProps = {
  packageId: 'numpy',
  onResolve: mockOnResolve,
  loading: false,
};

describe('DependencyTree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dependency tree component', () => {
    render(<DependencyTree {...defaultProps} />);
    expect(screen.getByText('Dependency Tree')).toBeInTheDocument();
  });

  it('shows resolve button', () => {
    render(<DependencyTree {...defaultProps} />);
    expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
  });

  it('calls onResolve when resolve button is clicked', async () => {
    const user = userEvent.setup();
    // Provide packageId so input is pre-filled
    render(<DependencyTree {...defaultProps} packageId="numpy" />);
    
    // Click resolve button
    const resolveButton = screen.getByRole('button', { name: /resolve/i });
    await user.click(resolveButton);

    expect(mockOnResolve).toHaveBeenCalledWith('numpy');
  });

  it('renders package input field', () => {
    render(<DependencyTree {...defaultProps} />);
    // The search input only appears after resolution; initial state shows package input
    expect(screen.getByPlaceholderText('packages.enterPackageName')).toBeInTheDocument();
  });
});
