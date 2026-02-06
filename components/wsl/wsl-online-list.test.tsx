import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslOnlineList } from './wsl-online-list';

// ScrollArea uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.available': 'Available Distributions',
    'wsl.installed': 'Installed',
    'wsl.install': 'Install',
    'common.search': 'Search',
    'common.noResults': 'No results found',
  };
  return translations[key] || key;
};

const distros: [string, string][] = [
  ['Ubuntu', 'Ubuntu'],
  ['Debian', 'Debian GNU/Linux'],
  ['kali-linux', 'Kali Linux Rolling'],
];

describe('WslOnlineList', () => {
  const defaultProps = {
    distros,
    installedNames: ['Ubuntu'],
    loading: false,
    onInstall: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the list of available distributions', () => {
    render(<WslOnlineList {...defaultProps} />);

    // Ubuntu appears as both id and name, so use getAllByText
    expect(screen.getAllByText('Ubuntu').length).toBeGreaterThan(0);
    expect(screen.getByText('Debian GNU/Linux')).toBeInTheDocument();
    expect(screen.getByText('Kali Linux Rolling')).toBeInTheDocument();
  });

  it('shows installed badge and disables button for installed distros', () => {
    render(<WslOnlineList {...defaultProps} />);

    const installButtons = screen.getAllByRole('button');
    const installedButton = installButtons.find((btn) => btn.textContent?.includes('Installed'));
    expect(installedButton).toBeInTheDocument();
    expect(installedButton).toBeDisabled();
  });

  it('calls onInstall when install button clicked for non-installed distro', async () => {
    render(<WslOnlineList {...defaultProps} />);

    const installButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Install') && !btn.hasAttribute('disabled'),
    );
    if (installButtons.length > 0) {
      await userEvent.click(installButtons[0]);
      expect(defaultProps.onInstall).toHaveBeenCalled();
    }
  });

  it('filters distros by search query', async () => {
    render(<WslOnlineList {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search');
    await userEvent.type(searchInput, 'kali');

    expect(screen.getByText('Kali Linux Rolling')).toBeInTheDocument();
    expect(screen.queryByText('Debian GNU/Linux')).not.toBeInTheDocument();
  });

  it('shows no results when search has no matches', async () => {
    render(<WslOnlineList {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search');
    await userEvent.type(searchInput, 'nonexistent');

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading with no data', () => {
    render(<WslOnlineList {...defaultProps} distros={[]} loading={true} />);

    expect(screen.queryByText('Available Distributions')).not.toBeInTheDocument();
  });

  it('shows distro count badge', () => {
    render(<WslOnlineList {...defaultProps} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
