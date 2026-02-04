import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionInstallForm } from '../version-install-form';

describe('VersionInstallForm', () => {
  const mockOnInstall = jest.fn();
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'environments.installNewVersion': 'Install New Version',
      'environments.latest': 'Latest',
      'environments.lts': 'LTS',
      'environments.selectVersion': 'Custom',
      'environments.versionPlaceholder': 'e.g., 18.0.0',
      'environments.quickInstall': 'Install',
    };
    return translations[key] || key;
  };

  const defaultProps = {
    onInstall: mockOnInstall,
    isInstalling: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnInstall.mockResolvedValue(undefined);
  });

  it('renders install new version label', () => {
    render(<VersionInstallForm {...defaultProps} />);
    expect(screen.getByText('Install New Version')).toBeInTheDocument();
  });

  it('renders version select dropdown', () => {
    render(<VersionInstallForm {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders install button', () => {
    render(<VersionInstallForm {...defaultProps} />);
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('calls onInstall with latest when install button is clicked', async () => {
    render(<VersionInstallForm {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    
    await waitFor(() => {
      expect(mockOnInstall).toHaveBeenCalledWith('latest');
    });
  });

  it('disables install button when installing', () => {
    render(<VersionInstallForm {...defaultProps} isInstalling={true} />);
    const installButton = screen.getByText('Install').closest('button');
    expect(installButton).toBeDisabled();
  });

  it('shows loading spinner when installing', () => {
    const { container } = render(<VersionInstallForm {...defaultProps} isInstalling={true} />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders combobox for version selection', () => {
    render(<VersionInstallForm {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
