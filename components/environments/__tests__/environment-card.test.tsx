import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvironmentCard } from '../environment-card';
import { useEnvironmentStore } from '@/lib/stores/environment';

jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'environments.available': 'Available',
        'environments.notInstalled': 'Not Installed',
        'environments.provider': 'Provider',
        'environments.currentVersion': 'Current Version',
        'environments.installedVersions': 'Installed Versions',
        'environments.installNewVersion': 'Install New Version',
        'environments.quickInstall': 'Quick Install',
        'environments.latest': 'Latest',
        'environments.lts': 'LTS',
        'environments.versionPlaceholder': 'e.g., 18.0.0',
        'environments.uninstallVersion': 'Uninstall Version',
        'environments.selectVersion': 'Select Version',
        'environments.setLocalVersion': 'Set Local Version',
        'environments.projectPath': 'Project Path',
        'environments.setLocal': 'Set Local',
        'environments.setGlobal': 'Click to set as global',
        'environments.createVersionFile': 'Creates .{type}-version file',
        'environments.browseVersions': 'Browse Versions',
        'environments.viewDetails': 'View Details',
        'environments.detected': 'Detected',
        'environments.toast.installing': `Installing ${params?.type || ''} ${params?.version || ''}`,
        'environments.toast.installFailed': `Install failed: ${params?.error || ''}`,
        'environments.toast.uninstalled': `Uninstalled ${params?.type || ''} ${params?.version || ''}`,
        'environments.toast.uninstallFailed': `Uninstall failed: ${params?.error || ''}`,
        'environments.toast.globalSet': `Global set to ${params?.version || ''}`,
        'environments.toast.globalFailed': `Global failed: ${params?.error || ''}`,
        'environments.toast.localSet': `Local set: ${params?.path || ''}`,
        'environments.toast.localFailed': `Local failed: ${params?.error || ''}`,
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
        'common.uninstall': 'Uninstall',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseEnvironmentStore = useEnvironmentStore as unknown as jest.Mock;

describe('EnvironmentCard', () => {
  const mockOpenVersionBrowser = jest.fn();
  const mockOpenDetailsPanel = jest.fn();
  const mockOnInstall = jest.fn();
  const mockOnUninstall = jest.fn();
  const mockOnSetGlobal = jest.fn();
  const mockOnSetLocal = jest.fn();

  const defaultEnv = {
    env_type: 'Node',
    provider: 'fnm',
    provider_id: 'fnm',
    available: true,
    current_version: '18.0.0',
    installed_versions: [
      { version: '18.0.0', install_path: '/usr/local/node/18.0.0', size: 50000000, is_current: true, installed_at: '2024-01-01' },
      { version: '20.0.0', install_path: '/usr/local/node/20.0.0', size: 60000000, is_current: false, installed_at: '2024-02-01' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentStore.mockReturnValue({
      openVersionBrowser: mockOpenVersionBrowser,
      openDetailsPanel: mockOpenDetailsPanel,
    });
    mockOnInstall.mockResolvedValue(undefined);
    mockOnUninstall.mockResolvedValue(undefined);
    mockOnSetGlobal.mockResolvedValue(undefined);
    mockOnSetLocal.mockResolvedValue(undefined);
  });

  it('renders environment type', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('Node')).toBeInTheDocument();
  });

  it('renders available badge when environment is available', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders not installed badge when environment is not available', () => {
    render(<EnvironmentCard env={{ ...defaultEnv, available: false }} />);
    expect(screen.getByText('Not Installed')).toBeInTheDocument();
  });

  it('renders provider name', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('fnm')).toBeInTheDocument();
  });

  it('renders current version', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    // Version may appear multiple times (current version + badges)
    const versions = screen.getAllByText('18.0.0');
    expect(versions.length).toBeGreaterThan(0);
  });

  it('renders installed versions as badges', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    // Versions appear in badges
    expect(screen.getAllByText('18.0.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20.0.0').length).toBeGreaterThan(0);
  });

  it('renders detected version when provided', () => {
    const detectedVersion = { env_type: 'Node', version: '18.0.0', source: 'nvmrc', source_path: '/project/.nvmrc' };
    render(<EnvironmentCard env={defaultEnv} detectedVersion={detectedVersion} />);
    expect(screen.getByText(/Detected.*18\.0\.0/)).toBeInTheDocument();
  });

  it('renders version install section', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('Install New Version')).toBeInTheDocument();
  });

  it('renders quick install select', () => {
    render(<EnvironmentCard env={defaultEnv} onInstall={mockOnInstall} />);
    // Quick install dropdown should be rendered
    const selectTriggers = screen.getAllByRole('combobox');
    expect(selectTriggers.length).toBeGreaterThan(0);
  });

  it('calls onSetGlobal when clicking on installed version badge', async () => {
    render(<EnvironmentCard env={defaultEnv} onSetGlobal={mockOnSetGlobal} />);
    const user = userEvent.setup();
    
    const versionBadge = screen.getAllByText('20.0.0')[0];
    await user.click(versionBadge);
    
    await waitFor(() => {
      expect(mockOnSetGlobal).toHaveBeenCalledWith('20.0.0');
    });
  });

  it('renders uninstall section when versions are installed', () => {
    render(<EnvironmentCard env={defaultEnv} onUninstall={mockOnUninstall} />);
    expect(screen.getByText('Uninstall Version')).toBeInTheDocument();
  });

  it('renders set local version section when onSetLocal is provided', () => {
    render(<EnvironmentCard env={defaultEnv} onSetLocal={mockOnSetLocal} />);
    expect(screen.getByText('Set Local Version')).toBeInTheDocument();
  });

  it('renders browse versions button', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('Browse Versions')).toBeInTheDocument();
  });

  it('calls openVersionBrowser when browse versions is clicked', async () => {
    render(<EnvironmentCard env={defaultEnv} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Browse Versions'));
    expect(mockOpenVersionBrowser).toHaveBeenCalledWith('Node');
  });

  it('renders view details button', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('calls openDetailsPanel when view details is clicked', async () => {
    render(<EnvironmentCard env={defaultEnv} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('View Details'));
    expect(mockOpenDetailsPanel).toHaveBeenCalledWith('Node');
  });

  it('shows loading state when loading prop is true', () => {
    const { container } = render(<EnvironmentCard env={defaultEnv} loading={true} />);
    expect(container.querySelector('.opacity-70')).toBeInTheDocument();
  });

  it('renders provider selector when multiple providers are available', () => {
    render(
      <EnvironmentCard 
        env={defaultEnv} 
        availableProviders={[
          { id: 'fnm', name: 'fnm' },
          { id: 'nvm', name: 'nvm' },
        ]}
        onProviderChange={jest.fn()}
      />
    );
    // Should have a select for provider
    expect(screen.getByText('fnm')).toBeInTheDocument();
  });

  it('renders custom version input', () => {
    render(<EnvironmentCard env={defaultEnv} onInstall={mockOnInstall} />);
    expect(screen.getByPlaceholderText('e.g., 18.0.0')).toBeInTheDocument();
  });

  it('renders quick install placeholder', () => {
    render(<EnvironmentCard env={defaultEnv} />);
    // Quick Install is always shown as a placeholder in the select
    expect(screen.getByText('Quick Install')).toBeInTheDocument();
  });
});
