import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslExportDialog } from './wsl-export-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.export': 'Export',
    'wsl.exportDesc': 'Export this distribution as a backup file.',
    'wsl.exportAsVhd': 'Export as VHD',
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
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title with distro name', () => {
    render(<WslExportDialog {...defaultProps} />);

    // Title contains "Export — Ubuntu"
    expect(screen.getByText(/Export — Ubuntu/)).toBeInTheDocument();
  });

  it('renders export description', () => {
    render(<WslExportDialog {...defaultProps} />);

    expect(screen.getByText('Export this distribution as a backup file.')).toBeInTheDocument();
  });

  it('renders Browse button with i18n key (not hardcoded)', () => {
    render(<WslExportDialog {...defaultProps} />);

    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('renders VHD toggle switch', () => {
    render(<WslExportDialog {...defaultProps} />);

    expect(screen.getByText('Export as VHD')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('disables export button when path is empty', () => {
    render(<WslExportDialog {...defaultProps} />);

    const exportButtons = screen.getAllByText('Export');
    const submitButton = exportButtons.find((el) => el.closest('button[disabled]'));
    expect(submitButton).toBeTruthy();
  });

  it('enables export button when path is provided', async () => {
    render(<WslExportDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Backup/);
    await userEvent.type(input, 'C:\\backup\\ubuntu.tar');

    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Export',
    );
    const submitBtn = exportButtons[exportButtons.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onExport with correct params on submit', async () => {
    render(<WslExportDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Backup/);
    await userEvent.type(input, 'C:\\backup\\ubuntu.tar');

    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Export',
    );
    await userEvent.click(exportButtons[exportButtons.length - 1]);

    expect(defaultProps.onExport).toHaveBeenCalledWith('Ubuntu', 'C:\\backup\\ubuntu.tar', false);
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
