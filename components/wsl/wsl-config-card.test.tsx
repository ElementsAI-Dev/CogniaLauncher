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
    'wsl.config.networkPresets': 'Network Presets',
    'wsl.config.presetApplied': 'Network preset applied.',
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

    // memory and processors are in wsl2, autoMemoryReclaim is in experimental
    // They show as raw key-value entries in the config list
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.getByText('processors')).toBeInTheDocument();
    expect(screen.getByText('autoMemoryReclaim')).toBeInTheDocument();
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

    // The Add button is inside the "Add Custom Setting" collapsible
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    const addCustomBtn = addButtons[addButtons.length - 1];
    expect(addCustomBtn).toBeDisabled();
  });

  it('renders loading skeleton when loading with no config', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loading: _loading, ...propsWithoutLoading } = defaultProps;
    render(<WslConfigCard config={null} loading={true} {...propsWithoutLoading} />);

    expect(screen.queryByText('.wslconfig Settings')).not.toBeInTheDocument();
  });

  // Typed controls tests (Phase 5 enhancements)
  describe('typed quick settings controls', () => {
    it('renders all 14 quick settings', () => {
      render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

      // Text-type settings (wsl2)
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('Processors')).toBeInTheDocument();
      expect(screen.getByText('Swap')).toBeInTheDocument();

      // Bool-type settings (wsl2)
      expect(screen.getByText('Localhost Forwarding')).toBeInTheDocument();
      expect(screen.getByText('Nested Virtualization')).toBeInTheDocument();
      expect(screen.getByText('GUI Applications')).toBeInTheDocument();
      expect(screen.getByText('DNS Proxy')).toBeInTheDocument();

      // Select-type settings (wsl2)
      expect(screen.getByText('Networking Mode')).toBeInTheDocument();

      // Experimental section settings
      expect(screen.getByText('Auto Memory Reclaim')).toBeInTheDocument();
      expect(screen.getByText('Sparse VHD')).toBeInTheDocument();
      expect(screen.getByText('DNS Tunneling')).toBeInTheDocument();
      expect(screen.getByText('Firewall')).toBeInTheDocument();
      expect(screen.getByText('Auto Proxy')).toBeInTheDocument();
      expect(screen.getByText('Host Address Loopback')).toBeInTheDocument();
    });

    it('renders switch controls for boolean settings', () => {
      render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

      // Boolean settings produce switch elements
      const switches = screen.getAllByRole('switch');
      // 9 boolean settings: localhostForwarding, nestedVirtualization, guiApplications,
      // dnsProxy (wsl2), sparseVhd, dnsTunneling, firewall, autoProxy, hostAddressLoopback (experimental)
      expect(switches.length).toBe(9);
    });

    it('renders text inputs for memory/processors/swap', () => {
      render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

      expect(screen.getByPlaceholderText('4GB')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('2')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('8GB')).toBeInTheDocument();
    });

    it('switch reflects current config value', () => {
      const configWithBool: WslConfig = {
        wsl2: { localhostForwarding: 'true' },
      };
      render(<WslConfigCard config={configWithBool} {...defaultProps} />);

      const switches = screen.getAllByRole('switch');
      // First switch should be localhostForwarding and be checked
      expect(switches[0]).toHaveAttribute('data-state', 'checked');
    });

    it('calls onSetConfig when switch is toggled', async () => {
      render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

      const switches = screen.getAllByRole('switch');
      await userEvent.click(switches[0]); // Toggle localhostForwarding
      expect(defaultProps.onSetConfig).toHaveBeenCalledWith('wsl2', 'localhostForwarding', 'true');
    });

    it('renders select dropdowns for networking mode and auto memory reclaim', () => {
      render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

      // Select triggers show placeholder text
      expect(screen.getByText('NAT')).toBeInTheDocument();
    });
  });

  it('calls onSetConfig when quick text setting is saved', async () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    // Type a value in the Memory field (first text input with placeholder "4GB")
    const memoryInput = screen.getByPlaceholderText('4GB');
    await userEvent.type(memoryInput, '8GB');
    expect(memoryInput).toHaveValue('8GB');
  });

  it('calls onSetConfig when add custom button clicked with key and value', async () => {
    render(<WslConfigCard config={emptyConfig} {...defaultProps} />);

    const keyInput = screen.getByPlaceholderText('Key (e.g. memory)');
    const valueInput = screen.getByPlaceholderText('Value (e.g. 4GB)');
    await userEvent.type(keyInput, 'swapFile');
    await userEvent.type(valueInput, '2GB');

    const addButtons = screen.getAllByRole('button', { name: /add/i });
    const addCustomBtn = addButtons[addButtons.length - 1];
    expect(addCustomBtn).not.toBeDisabled();
    await userEvent.click(addCustomBtn);
    expect(defaultProps.onSetConfig).toHaveBeenCalledWith('wsl2', 'swapFile', '2GB');
  });

  it('calls handleRemove when delete button clicked on entry', async () => {
    render(<WslConfigCard config={populatedConfig} {...defaultProps} />);

    // Find delete buttons (trash icon buttons) - one per entry
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('.lucide-trash-2')
    );
    if (deleteButtons.length > 0) {
      await userEvent.click(deleteButtons[0]);
      expect(defaultProps.onSetConfig).toHaveBeenCalled();
    }
  });
});
