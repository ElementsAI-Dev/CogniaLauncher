import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslExportDialog } from './wsl-export-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.export': 'Export',
    'wsl.exportDesc': 'Export this distribution as a backup file.',
    'wsl.exportAsVhd': 'Export as VHD',
    'wsl.exportFormat': 'Export Format',
    'wsl.capabilityUnsupported': "Feature '{feature}' is unavailable on this system (WSL {version}).",
    'common.save': 'Save',
    'common.path': 'Path',
    'common.browse': 'Browse',
    'common.cancel': 'Cancel',
  };
  return translations[key] || key;
};

describe('WslExportDialog', () => {
  const defaultProps = {
    open: true,
    distroName: 'Ubuntu',
    onOpenChange: jest.fn(),
    onExport: jest.fn().mockResolvedValue(undefined),
    capabilities: { exportFormat: true, version: '2.4.0' },
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title with distro name', () => {
    render(<WslExportDialog {...defaultProps} />);
    expect(screen.getByText(/Export — Ubuntu/)).toBeInTheDocument();
  });

  it('renders export description', () => {
    render(<WslExportDialog {...defaultProps} />);
    expect(screen.getByText('Export this distribution as a backup file.')).toBeInTheDocument();
  });

  it('disables export button when path is empty', () => {
    render(<WslExportDialog {...defaultProps} />);
    const exportButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === 'Export');
    const submitBtn = exportButtons[exportButtons.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it('enables export button when path is provided', async () => {
    render(<WslExportDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Backup/);
    await userEvent.type(input, 'C:\\backup\\ubuntu');

    const exportButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === 'Export');
    const submitBtn = exportButtons[exportButtons.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it('normalizes tar output path on submit', async () => {
    render(<WslExportDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Backup/);
    await userEvent.type(input, 'C:\\backup\\ubuntu');

    const exportButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === 'Export');
    await userEvent.click(exportButtons[exportButtons.length - 1]);

    expect(defaultProps.onExport).toHaveBeenCalledWith('Ubuntu', 'C:\\backup\\ubuntu.tar', false);
  });

  it('supports vhd export format when capability exists', async () => {
    render(<WslExportDialog {...defaultProps} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('VHD (.vhdx)'));

    const input = screen.getByPlaceholderText(/vhdx/);
    await userEvent.type(input, 'C:\\backup\\ubuntu.tar');

    const exportButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === 'Export');
    await userEvent.click(exportButtons[exportButtons.length - 1]);

    expect(defaultProps.onExport).toHaveBeenCalledWith('Ubuntu', 'C:\\backup\\ubuntu.vhdx', true);
  });

  it('hides vhd option when capability is unavailable', async () => {
    render(
      <WslExportDialog
        {...defaultProps}
        capabilities={{ exportFormat: false, version: '2.0.0' }}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByText('VHD (.vhdx)')).not.toBeInTheDocument();
    expect(screen.getByText(/Feature 'Export as VHD' is unavailable/)).toBeInTheDocument();
  });

  it('calls onOpenChange when cancel clicked', async () => {
    render(<WslExportDialog {...defaultProps} />);

    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    render(<WslExportDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Export this distribution as a backup file.')).not.toBeInTheDocument();
  });
});
