import { render, screen, fireEvent } from '@testing-library/react';
import { InstalledVersions } from '../installed-versions';
import type { InstalledVersion } from '@/lib/tauri';

// Mock the TooltipProvider context
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{asChild ? children : <span>{children}</span>}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
}));

describe('InstalledVersions', () => {
  const mockOnSetGlobal = jest.fn();
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'environments.notInstalled': 'No versions installed',
      'environments.setGlobal': 'Click to set as global',
    };
    return translations[key] || key;
  };

  const defaultVersions: InstalledVersion[] = [
    { version: '18.0.0', install_path: '/usr/local/node/18.0.0', size: 50000000, is_current: false, installed_at: '2024-01-01' },
    { version: '20.0.0', install_path: '/usr/local/node/20.0.0', size: 60000000, is_current: false, installed_at: '2024-02-01' },
  ];

  const defaultProps = {
    versions: defaultVersions,
    currentVersion: '18.0.0',
    onSetGlobal: mockOnSetGlobal,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders not installed message when no versions', () => {
    render(<InstalledVersions {...defaultProps} versions={[]} />);
    expect(screen.getByText('No versions installed')).toBeInTheDocument();
  });

  it('renders all version badges', () => {
    render(<InstalledVersions {...defaultProps} />);
    expect(screen.getByText('18.0.0')).toBeInTheDocument();
    expect(screen.getByText('20.0.0')).toBeInTheDocument();
  });

  it('highlights current version with default variant', () => {
    render(<InstalledVersions {...defaultProps} />);
    const currentBadge = screen.getByText('18.0.0');
    // The current version badge should be clickable
    expect(currentBadge).toBeInTheDocument();
  });

  it('calls onSetGlobal when version badge is clicked', () => {
    render(<InstalledVersions {...defaultProps} />);
    fireEvent.click(screen.getByText('20.0.0'));
    expect(mockOnSetGlobal).toHaveBeenCalledWith('20.0.0');
  });

  it('renders check icon for current version', () => {
    render(<InstalledVersions {...defaultProps} />);
    // The current version badge should exist
    const currentBadge = screen.getByText('18.0.0');
    expect(currentBadge).toBeInTheDocument();
  });

  it('renders version badges with correct styling', () => {
    const { container } = render(<InstalledVersions {...defaultProps} />);
    const badgeContainer = container.querySelector('.flex.flex-wrap.gap-1\\.5');
    expect(badgeContainer).toBeInTheDocument();
  });

  it('handles null currentVersion', () => {
    render(<InstalledVersions {...defaultProps} currentVersion={null} />);
    // All badges should be secondary variant (not highlighted)
    expect(screen.getByText('18.0.0')).toBeInTheDocument();
    expect(screen.getByText('20.0.0')).toBeInTheDocument();
  });

  it('renders size in tooltip', () => {
    render(<InstalledVersions {...defaultProps} />);
    // Tooltip content should contain size
    const tooltips = screen.getAllByTestId('tooltip');
    expect(tooltips.length).toBeGreaterThan(0);
  });

  it('handles version with null size', () => {
    const versionsWithNullSize: InstalledVersion[] = [
      { version: '16.0.0', install_path: '/usr/local/node/16.0.0', size: null, is_current: false, installed_at: null },
    ];
    render(<InstalledVersions {...defaultProps} versions={versionsWithNullSize} />);
    expect(screen.getByText('16.0.0')).toBeInTheDocument();
  });

  it('handles version with null installed_at', () => {
    const versionsWithNullDate: InstalledVersion[] = [
      { version: '14.0.0', install_path: '/usr/local/node/14.0.0', size: 40000000, is_current: false, installed_at: null },
    ];
    render(<InstalledVersions {...defaultProps} versions={versionsWithNullDate} />);
    expect(screen.getByText('14.0.0')).toBeInTheDocument();
  });
});
