import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslDistroCard } from './wsl-distro-card';
import type { WslDistroStatus } from '@/types/tauri';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.running': 'Running',
    'wsl.stopped': 'Stopped',
    'wsl.launch': 'Launch',
    'wsl.terminate': 'Terminate',
    'wsl.setDefault': 'Set as Default',
    'wsl.setVersion': 'Set WSL Version',
    'wsl.export': 'Export',
    'wsl.unregister': 'Unregister',
  };
  return translations[key] || key;
};

const runningDistro: WslDistroStatus = {
  name: 'Ubuntu',
  state: 'Running',
  wslVersion: '2',
  isDefault: true,
};

const stoppedDistro: WslDistroStatus = {
  name: 'Debian',
  state: 'Stopped',
  wslVersion: '1',
  isDefault: false,
};

describe('WslDistroCard', () => {
  const defaultProps = {
    onLaunch: jest.fn(),
    onTerminate: jest.fn(),
    onSetDefault: jest.fn(),
    onSetVersion: jest.fn(),
    onExport: jest.fn(),
    onUnregister: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders distro name and WSL version', () => {
    render(<WslDistroCard distro={runningDistro} {...defaultProps} />);

    expect(screen.getByText('Ubuntu')).toBeInTheDocument();
    expect(screen.getByText('WSL 2')).toBeInTheDocument();
  });

  it('shows Running badge for running distro', () => {
    render(<WslDistroCard distro={runningDistro} {...defaultProps} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows Stopped badge for stopped distro', () => {
    render(<WslDistroCard distro={stoppedDistro} {...defaultProps} />);

    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('shows Default badge for default distro', () => {
    render(<WslDistroCard distro={runningDistro} {...defaultProps} />);

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('does not show Default badge for non-default distro', () => {
    render(<WslDistroCard distro={stoppedDistro} {...defaultProps} />);

    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('shows Terminate button for running distro', () => {
    render(<WslDistroCard distro={runningDistro} {...defaultProps} />);

    expect(screen.getByText('Terminate')).toBeInTheDocument();
    expect(screen.queryByText('Launch')).not.toBeInTheDocument();
  });

  it('shows Launch button for stopped distro', () => {
    render(<WslDistroCard distro={stoppedDistro} {...defaultProps} />);

    expect(screen.getByText('Launch')).toBeInTheDocument();
    expect(screen.queryByText('Terminate')).not.toBeInTheDocument();
  });

  it('calls onLaunch when Launch button is clicked', async () => {
    render(<WslDistroCard distro={stoppedDistro} {...defaultProps} />);

    await userEvent.click(screen.getByText('Launch'));
    expect(defaultProps.onLaunch).toHaveBeenCalledWith('Debian');
  });

  it('calls onTerminate when Terminate button is clicked', async () => {
    render(<WslDistroCard distro={runningDistro} {...defaultProps} />);

    await userEvent.click(screen.getByText('Terminate'));
    expect(defaultProps.onTerminate).toHaveBeenCalledWith('Ubuntu');
  });

  it('uses camelCase fields correctly (wslVersion, isDefault)', () => {
    const distro: WslDistroStatus = {
      name: 'Alpine',
      state: 'Stopped',
      wslVersion: '2',
      isDefault: false,
    };
    render(<WslDistroCard distro={distro} {...defaultProps} />);

    expect(screen.getByText('Alpine')).toBeInTheDocument();
    expect(screen.getByText('WSL 2')).toBeInTheDocument();
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });
});
