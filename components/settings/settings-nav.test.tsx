import { render, screen } from '@testing-library/react';
import { SettingsNav } from './settings-nav';
import type { SettingsSection } from '@/lib/constants/settings-registry';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.nav.label': 'Settings navigation',
    'settings.nav.title': 'Settings',
    'settings.nav.hasChanges': 'Has unsaved changes',
    'settings.nav.collapsed': 'Collapsed',
    'settings.nav.hint': 'Keyboard shortcuts',
    'settings.nav.hintSearch': 'Focus search',
    'settings.nav.hintNavigate': 'Navigate sections',
    'settings.general': 'General',
    'settings.generalDesc': 'General settings',
    'settings.network': 'Network',
    'settings.networkDesc': 'Network settings',
    'settings.security': 'Security',
    'settings.securityDesc': 'Security settings',
    'settings.mirrors': 'Mirrors',
    'settings.mirrorsDesc': 'Mirror settings',
    'settings.appearance': 'Appearance',
    'settings.appearanceDesc': 'Appearance settings',
    'settings.updates': 'Updates',
    'settings.updatesDesc': 'Update settings',
    'settings.tray': 'System Tray',
    'settings.trayDesc': 'Tray settings',
    'settings.paths': 'Paths',
    'settings.pathsDesc': 'Path settings',
    'settings.providerSettings': 'Provider Settings',
    'settings.providerSettingsDesc': 'Provider settings',
    'settings.systemInfo': 'System Information',
    'settings.systemInfoDesc': 'System info',
  };
  return translations[key] || key;
};

describe('SettingsNav', () => {
  const defaultProps = {
    activeSection: 'general' as SettingsSection,
    onSectionClick: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation title', () => {
    render(<SettingsNav {...defaultProps} />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders all section buttons', () => {
    render(<SettingsNav {...defaultProps} />);

    expect(screen.getByRole('button', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Network/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Security/i })).toBeInTheDocument();
  });

  it('highlights active section', () => {
    render(<SettingsNav {...defaultProps} activeSection="network" />);

    const networkButton = screen.getByRole('button', { name: /Network/i });
    expect(networkButton).toHaveAttribute('aria-current', 'true');
  });

  it('renders section buttons', () => {
    const onSectionClick = jest.fn();

    render(<SettingsNav {...defaultProps} onSectionClick={onSectionClick} />);

    // Verify section buttons are rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Check that section names are visible
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('dims non-matching sections during search', () => {
    const matchingSections = new Set(['general'] as SettingsSection[]);

    render(
      <SettingsNav
        {...defaultProps}
        isSearching={true}
        matchingSections={matchingSections}
      />
    );

    const networkButton = screen.getByRole('button', { name: /Network/i });
    expect(networkButton).toHaveClass('opacity-40');
  });

  it('shows change indicator for sections with changes', () => {
    const sectionHasChanges = (section: SettingsSection) => section === 'general';

    render(
      <SettingsNav
        {...defaultProps}
        sectionHasChanges={sectionHasChanges}
      />
    );

    const changeIndicator = screen.getByTitle('Has unsaved changes');
    expect(changeIndicator).toBeInTheDocument();
  });

  it('shows collapsed badge for collapsed sections', () => {
    const collapsedSections = new Set(['network'] as SettingsSection[]);

    render(
      <SettingsNav
        {...defaultProps}
        collapsedSections={collapsedSections}
      />
    );

    expect(screen.getByText('Collapsed')).toBeInTheDocument();
  });

  it('shows keyboard shortcuts hint', () => {
    render(<SettingsNav {...defaultProps} />);

    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Focus search')).toBeInTheDocument();
    expect(screen.getByText('Navigate sections')).toBeInTheDocument();
  });
});
