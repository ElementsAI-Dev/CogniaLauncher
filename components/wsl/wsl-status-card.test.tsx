import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslStatusCard } from './wsl-status-card';
import type { WslStatus } from '@/types/tauri';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.status': 'WSL Status',
    'wsl.kernelVersion': 'Kernel Version',
    'wsl.wslgVersion': 'WSLg Version',
    'wsl.windowsVersion': 'Windows Version',
    'wsl.runningDistros': 'Running Distributions',
    'wsl.noRunning': 'No distributions currently running',
    'wsl.shutdown': 'Shutdown All',
    'wsl.infoState': 'Information State',
    'wsl.infoState.partial': 'Partial',
    'wsl.infoState.stale': 'Stale',
    'wsl.infoLastUpdated': 'Last Updated',
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

  it('groups key runtime facts and running distro state into separate sections', () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    expect(screen.getByTestId('wsl-status-metrics')).toHaveTextContent('5.15.90.1');
    expect(screen.getByTestId('wsl-status-running-section')).toHaveTextContent('Ubuntu');
  });

  it('keeps running distro badges in a scroll-safe container', () => {
    render(<WslStatusCard status={statusWithRunning} {...defaultProps} />);

    const badgesContainer = screen.getByText('Ubuntu').parentElement;
    expect(badgesContainer).toHaveClass('overflow-y-auto');
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

  it('renders richer version readouts and snapshot state when runtime info is provided', () => {
    render(
      <WslStatusCard
        status={statusWithRunning}
        runtimeInfo={{
          state: 'partial',
          runtime: { state: 'ready', data: null, failure: null, updatedAt: '2026-03-15T12:00:00.000Z' },
          status: { state: 'ready', data: statusWithRunning, failure: null, updatedAt: '2026-03-15T12:00:00.000Z' },
          capabilities: { state: 'failed', data: null, failure: { category: 'runtime', message: 'Capability probe timed out', raw: 'Capability probe timed out', retryable: true }, updatedAt: null, reason: 'Capability probe timed out' },
          versionInfo: {
            state: 'ready',
            data: {
              wslVersion: '2.4.0',
              kernelVersion: '6.6.87.2-1',
              wslgVersion: '1.0.66',
              windowsVersion: '10.0.26100.6584',
            },
            failure: null,
            updatedAt: '2026-03-15T12:00:00.000Z',
          },
          lastUpdatedAt: '2026-03-15T12:00:00.000Z',
        }}
        {...defaultProps}
      />,
    );

    expect(screen.getByText('WSLg Version')).toBeInTheDocument();
    expect(screen.getByText('1.0.66')).toBeInTheDocument();
    expect(screen.getByText('Windows Version')).toBeInTheDocument();
    expect(screen.getByText('10.0.26100.6584')).toBeInTheDocument();
    expect(screen.getByText('Information State')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });
});
