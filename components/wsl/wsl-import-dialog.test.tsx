import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslImportDialog } from './wsl-import-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.import': 'Import',
    'wsl.importDesc': 'Import a WSL distribution from a backup file.',
    'wsl.importName': 'Distribution Name',
    'wsl.importFile': 'Source File',
    'wsl.importLocation': 'Install Location',
    'wsl.wslVersion': 'WSL Version',
    'wsl.wslVersion1': 'WSL 1',
    'wsl.wslVersion2': 'WSL 2',
    'wsl.importAsVhd': 'Import as VHD',
    'common.browse': 'Browse',
    'common.cancel': 'Cancel',
  };
  return translations[key] || key;
};

describe('WslImportDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onImport: jest.fn().mockResolvedValue(undefined),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title', () => {
    render(<WslImportDialog {...defaultProps} />);

    // 'Import' appears in both title and submit button, use getAllByText
    expect(screen.getAllByText('Import').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Import a WSL distribution from a backup file.')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<WslImportDialog {...defaultProps} />);

    expect(screen.getByText('Distribution Name')).toBeInTheDocument();
    expect(screen.getByText('Source File')).toBeInTheDocument();
    expect(screen.getByText('Install Location')).toBeInTheDocument();
    expect(screen.getByText('WSL Version')).toBeInTheDocument();
    expect(screen.getByText('Import as VHD')).toBeInTheDocument();
  });

  it('renders Browse buttons with i18n key (not hardcoded)', () => {
    render(<WslImportDialog {...defaultProps} />);

    const browseButtons = screen.getAllByText('Browse');
    expect(browseButtons).toHaveLength(2); // file + location
  });

  it('disables import button when fields are empty', () => {
    render(<WslImportDialog {...defaultProps} />);

    // Find the Import button in the footer (not the title)
    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import',
    );
    const submitBtn = importButtons[importButtons.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it('enables import button when all fields are filled', async () => {
    render(<WslImportDialog {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText('MyDistro'), 'TestDistro');
    await userEvent.type(screen.getByPlaceholderText('/path/to/distro.tar'), 'C:\\backup.tar');
    await userEvent.type(screen.getByLabelText('Install Location'), 'C:\\WSL\\Test');

    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import',
    );
    const submitBtn = importButtons[importButtons.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onImport with camelCase fields on submit', async () => {
    render(<WslImportDialog {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText('MyDistro'), 'TestDistro');
    await userEvent.type(screen.getByPlaceholderText('/path/to/distro.tar'), 'C:\\backup.tar');
    await userEvent.type(screen.getByLabelText('Install Location'), 'C:\\WSL\\Test');

    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import',
    );
    await userEvent.click(importButtons[importButtons.length - 1]);

    expect(defaultProps.onImport).toHaveBeenCalledWith({
      name: 'TestDistro',
      installLocation: 'C:\\WSL\\Test',
      filePath: 'C:\\backup.tar',
      wslVersion: 2,
      asVhd: false,
    });
  });

  it('calls onOpenChange when cancel clicked', async () => {
    render(<WslImportDialog {...defaultProps} />);

    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    render(<WslImportDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Import a WSL distribution from a backup file.')).not.toBeInTheDocument();
  });
});
