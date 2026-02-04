import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../command-palette';

const mockPush = jest.fn();
const mockToggleDrawer = jest.fn();
const mockOnOpenChange = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.dashboard': 'Dashboard',
        'nav.environments': 'Environments',
        'nav.packages': 'Packages',
        'nav.providers': 'Providers',
        'nav.cache': 'Cache',
        'nav.logs': 'Logs',
        'nav.settings': 'Settings',
        'nav.about': 'About',
        'commandPalette.open': 'Open command palette',
        'commandPalette.placeholder': 'Search commands...',
        'commandPalette.noResults': 'No results found.',
        'commandPalette.groups.navigation': 'Navigation',
        'commandPalette.groups.actions': 'Actions',
        'commandPalette.actions.toggleLogs': 'Toggle logs',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/stores/log', () => ({
  useLogStore: () => ({ toggleDrawer: mockToggleDrawer }),
}));

jest.mock('@/lib/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation and actions', () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByPlaceholderText('Search commands...')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Packages')).toBeInTheDocument();
    expect(screen.getByText('Toggle logs')).toBeInTheDocument();
  });

  it('navigates and closes when a navigation item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    await user.click(screen.getByText('Packages'));

    expect(mockPush).toHaveBeenCalledWith('/packages');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles logs and closes when action is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    await user.click(screen.getByText('Toggle logs'));

    expect(mockToggleDrawer).toHaveBeenCalled();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
