import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslStatusCard } from './wsl-status-card';
import type { WslStatus } from '@/types/tauri';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.status': 'WSL Status',
    'wsl.kernelVersion': 'Kernel Version',
    'wsl.runningDistros': 'Running Distributions',
    'wsl.noRunning': 'No distributions currently running',
    'wsl.shutdown': 'Shutdown All',
  };
  return translations[key] || key;
};

const statusWithRunning: WslStatus = {
  version: '5.15.90.1',
  statusInfo: 'OK',
  runningDistros: ['Ubuntu', 'Debian'],
};

const statusNoRunning: WslStatus = {
  version: '5.15.90.1',
  statusInfo: 'OK',
  runningDistros: [],
};

describe('WslStatusCard', () => {
  const defaultProps = {
    loading: false,
    onRefresh: jest.fn(),
    onShutdownAll: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and kernel version', () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    expect(screen.getByText('WSL Status')).toBeInTheDocument();
    expect(screen.getByText('5.15.90.1')).toBeInTheDocument();
  });

  it('shows running distro names using camelCase runningDistros', () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    expect(screen.getByText('Ubuntu')).toBeInTheDocument();
    expect(screen.getByText('Debian')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // count badge
  });

  it('shows no running message when runningDistros is empty', () => {
    render(<WslStatusCard status={statusNoRunning} {...defaultProps} />);

    expect(screen.getByText('No distributions currently running')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // count badge
  });

  it('shows shutdown button when distros are running', () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    expect(screen.getByText('Shutdown All')).toBeInTheDocument();
  });

  it('hides shutdown button when no distros are running', () => {
    render(<WslStatusCard status={statusNoRunning} {...defaultProps} />);

    expect(screen.queryByText('Shutdown All')).not.toBeInTheDocument();
  });

  it('calls onShutdownAll when shutdown button clicked', async () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    await userEvent.click(screen.getByText('Shutdown All'));
    expect(defaultProps.onShutdownAll).toHaveBeenCalled();
  });

  it('renders dash for version when status is null', () => {
    render(<WslStatusCard status={null} {...defaultProps} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
