import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvironmentBatchOperations } from '../batch-operations';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'common.install': 'Install',
        'common.uninstall': 'Uninstall',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.clear': 'Clear',
        'environments.batch.selected': `${params?.count || 0} selected`,
        'environments.batch.title': `Batch ${params?.action || 'Operation'}`,
        'environments.batch.description': `${params?.action || 'Operation'} ${params?.count || 0} versions`,
        'environments.batch.completed': 'Operation completed',
        'environments.batch.versions': 'Versions',
        'environments.batch.processing': 'Processing',
        'environments.batch.successful': 'Successful',
        'environments.batch.failed': 'Failed',
      };
      return translations[key] || key;
    },
  }),
}));

describe('EnvironmentBatchOperations', () => {
  const mockOnBatchInstall = jest.fn();
  const mockOnBatchUninstall = jest.fn();
  const mockOnClearSelection = jest.fn();

  const defaultProps = {
    selectedVersions: [
      { envType: 'node', version: '18.0.0' },
      { envType: 'node', version: '20.0.0' },
    ],
    onBatchInstall: mockOnBatchInstall,
    onBatchUninstall: mockOnBatchUninstall,
    onClearSelection: mockOnClearSelection,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnBatchInstall.mockResolvedValue(undefined);
    mockOnBatchUninstall.mockResolvedValue(undefined);
  });

  it('renders nothing when no versions are selected', () => {
    render(
      <EnvironmentBatchOperations
        {...defaultProps}
        selectedVersions={[]}
      />
    );
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('renders floating action bar with selected count', () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('renders install and uninstall buttons', () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    expect(screen.getByText('Install')).toBeInTheDocument();
    expect(screen.getByText('Uninstall')).toBeInTheDocument();
  });

  it('renders clear button', () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button is clicked', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Clear'));
    expect(mockOnClearSelection).toHaveBeenCalled();
  });

  it('opens install dialog when install button is clicked', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    
    expect(screen.getByText('Batch Install')).toBeInTheDocument();
    expect(screen.getByText('Versions:')).toBeInTheDocument();
  });

  it('opens uninstall dialog when uninstall button is clicked', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Uninstall'));
    
    expect(screen.getByText('Batch Uninstall')).toBeInTheDocument();
  });

  it('shows versions in dialog', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    
    // Check that versions are shown in the dialog
    await waitFor(() => {
      expect(screen.getByText('18.0.0')).toBeInTheDocument();
    });
  });

  it('calls onBatchInstall when confirmed', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    // Find the Install button inside the dialog (second Install button)
    const buttons = screen.getAllByRole('button', { name: /install/i });
    const dialogInstallButton = buttons[buttons.length - 1];
    await user.click(dialogInstallButton);
    
    await waitFor(() => {
      expect(mockOnBatchInstall).toHaveBeenCalled();
    });
  });

  it('executes batch uninstall operation', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Uninstall'));
    const buttons = screen.getAllByRole('button', { name: /uninstall/i });
    const dialogUninstallButton = buttons[buttons.length - 1];
    await user.click(dialogUninstallButton);
    
    await waitFor(() => {
      expect(mockOnBatchUninstall).toHaveBeenCalledTimes(2);
    });
  });

  it('has cancel button in dialog', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('dialog has proper structure', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    
    // Dialog should show title and version list
    expect(screen.getByText('Batch Install')).toBeInTheDocument();
  });

  it('shows success count in results', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    const buttons = screen.getAllByRole('button', { name: /install/i });
    const dialogInstallButton = buttons[buttons.length - 1];
    await user.click(dialogInstallButton);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // success count
      expect(screen.getByText('0')).toBeInTheDocument(); // failure count
    });
  });

  it('calls onBatchUninstall when confirmed', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Uninstall'));
    const buttons = screen.getAllByRole('button', { name: /uninstall/i });
    const dialogUninstallButton = buttons[buttons.length - 1];
    await user.click(dialogUninstallButton);
    
    await waitFor(() => {
      expect(mockOnBatchUninstall).toHaveBeenCalled();
    });
  });

  it('can cancel dialog before operation starts', async () => {
    render(<EnvironmentBatchOperations {...defaultProps} />);
    const user = userEvent.setup();
    
    await user.click(screen.getByText('Install'));
    await user.click(screen.getByText('Cancel'));
    
    await waitFor(() => {
      expect(screen.queryByText('Batch Install')).not.toBeInTheDocument();
    });
    expect(mockOnBatchInstall).not.toHaveBeenCalled();
  });
});
