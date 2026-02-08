import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslConfigCard } from './wsl-config-card';
import type { WslConfig } from '@/types/tauri';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.config.title': '.wslconfig Settings',
    'wsl.config.empty': 'No .wslconfig settings configured',
    'wsl.config.saved': 'Setting saved successfully',
    'wsl.config.removed': 'Setting removed',
    'wsl.config.quickSettings': 'Quick Settings',
    'wsl.config.addCustom': 'Add Custom Setting',
    'wsl.config.keyPlaceholder': 'Key (e.g. memory)',
    'wsl.config.valuePlaceholder': 'Value (e.g. 4GB)',
    'wsl.config.restartNote': 'Changes require WSL restart (wsl --shutdown) to take effect.',
    'common.add': 'Add',
  };
  return translations[key] || key;
};

const emptyConfig: WslConfig = {};

const populatedConfig: WslConfig = {
  wsl2: {
    memory: '4GB',
    processors: '2',
  },
  experimental: {
    autoMemoryReclaim: 'gradual',
  },
};

describe('WslConfigCard', () => {
  const defaultProps = {
    loading: false,
    onRefresh: jest.fn(),
    onSetConfig: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    expect(screen.getByText('.wslconfig Settings')).toBeInTheDocument();
  });

  it('shows empty message when no config', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    expect(screen.getByText('No .wslconfig settings configured')).toBeInTheDocument();
  });

  it('displays existing config entries with section badges', () => {
    render(<WslConfigCard config={populatedConfig} {...defaultProps} />);

    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.getByText('4GB')).toBeInTheDocument();
    expect(screen.getByText('processors')).toBeInTheDocument();
    expect(screen.getByText('autoMemoryReclaim')).toBeInTheDocument();
    expect(screen.getByText('gradual')).toBeInTheDocument();
  });

  it('shows section badges for wsl2 and experimental', () => {
    render(<WslConfigCard config={populatedConfig} {...defaultProps} />);

    const wsl2Badges = screen.getAllByText('wsl2');
    const experimentalBadges = screen.getAllByText('experimental');
    expect(wsl2Badges.length).toBeGreaterThan(0);
    expect(experimentalBadges.length).toBeGreaterThan(0);
  });

  it('shows quick settings section', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    expect(screen.getByText('Quick Settings')).toBeInTheDocument();
  });

  it('shows add custom setting section', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    expect(screen.getByText('Add Custom Setting')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Key (e.g. memory)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Value (e.g. 4GB)')).toBeInTheDocument();
  });

  it('shows restart note', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    expect(
      screen.getByText('Changes require WSL restart (wsl --shutdown) to take effect.'),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    const refreshButtons = screen.getAllByRole('button');
    // The first small icon button is the refresh button
    const refreshButton = refreshButtons[0];
    await userEvent.click(refreshButton);
    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it('disables Add button when key or value is empty', () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeDisabled();
  });

  it('renders loading skeleton when loading with no config', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loading: _loading, ...propsWithoutLoading } = defaultProps;
    render(<WslConfigCard config={null} loading={true} {...propsWithoutLoading} />);

    expect(screen.queryByText('.wslconfig Settings')).not.toBeInTheDocument();
  });
});
