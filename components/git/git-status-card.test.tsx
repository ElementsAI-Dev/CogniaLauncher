import { render, screen, fireEvent } from '@testing-library/react';
import { GitStatusCard } from './git-status-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitStatusCard', () => {
  const defaultProps = {
    available: true,
    version: '2.47.1',
    executablePath: 'C:\\Program Files\\Git\\cmd\\git.exe',
    loading: false,
    onInstall: jest.fn(),
    onUpdate: jest.fn(),
    onRefresh: jest.fn(),
  };

  it('renders version when available', () => {
    render(<GitStatusCard {...defaultProps} />);
    expect(screen.getByText('2.47.1')).toBeInTheDocument();
  });

  it('renders executable path when available', () => {
    render(<GitStatusCard {...defaultProps} />);
    expect(screen.getByText('C:\\Program Files\\Git\\cmd\\git.exe')).toBeInTheDocument();
  });

  it('shows installed badge when available', () => {
    render(<GitStatusCard {...defaultProps} />);
    expect(screen.getByText('git.status.installed')).toBeInTheDocument();
  });

  it('shows install button when not available', () => {
    render(<GitStatusCard {...defaultProps} available={false} version={null} />);
    expect(screen.getByText('git.status.install')).toBeInTheDocument();
    expect(screen.getByText('git.status.notInstalled')).toBeInTheDocument();
  });

  it('calls onInstall when install button clicked', () => {
    const onInstall = jest.fn();
    render(<GitStatusCard {...defaultProps} available={false} version={null} onInstall={onInstall} />);
    fireEvent.click(screen.getByText('git.status.install'));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('shows update button when available', () => {
    render(<GitStatusCard {...defaultProps} />);
    expect(screen.getByText('git.status.update')).toBeInTheDocument();
  });

  it('renders skeleton when availability is null', () => {
    render(<GitStatusCard {...defaultProps} available={null} />);
    // When available is null, the card shows a loading skeleton state
    // It should NOT show the version or install button
    expect(screen.queryByText('2.47.1')).not.toBeInTheDocument();
    expect(screen.queryByText('git.status.install')).not.toBeInTheDocument();
    // Title should still be visible
    expect(screen.getByText('git.status.title')).toBeInTheDocument();
  });
});
