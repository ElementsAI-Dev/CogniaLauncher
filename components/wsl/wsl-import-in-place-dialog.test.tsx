import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslImportInPlaceDialog } from './wsl-import-in-place-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.dialog.importInPlace': 'Import In-Place',
    'wsl.dialog.importInPlaceDesc': 'Register an existing .vhdx file.',
    'wsl.name': 'Name',
    'wsl.vhdxFile': 'VHDX File',
    'wsl.importInPlace': 'Import In-Place',
    'common.cancel': 'Cancel',
    'common.browse': 'Browse',
  };
  return translations[key] || key;
};

describe('WslImportInPlaceDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title', () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    expect(screen.getAllByText('Import In-Place').length).toBeGreaterThanOrEqual(1);
  });

  it('renders description', () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    expect(screen.getByText('Register an existing .vhdx file.')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WslImportInPlaceDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Register an existing .vhdx file.')).not.toBeInTheDocument();
  });

  it('renders name and vhdx path inputs', () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('MyDistro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/vhdx/i)).toBeInTheDocument();
  });

  it('submit button disabled when fields empty', () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    const submitBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Import In-Place',
    );
    expect(submitBtns[submitBtns.length - 1]).toBeDisabled();
  });

  it('submit button disabled when only name is filled', async () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('MyDistro'), 'TestDistro');
    const submitBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Import In-Place',
    );
    expect(submitBtns[submitBtns.length - 1]).toBeDisabled();
  });

  it('enables submit when both fields filled', async () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('MyDistro'), 'TestDistro');
    await userEvent.type(screen.getByPlaceholderText(/vhdx/i), 'C:\\WSL\\ext4.vhdx');
    const submitBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Import In-Place',
    );
    expect(submitBtns[submitBtns.length - 1]).not.toBeDisabled();
  });

  it('calls onConfirm with name and path on submit', async () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('MyDistro'), 'TestDistro');
    await userEvent.type(screen.getByPlaceholderText(/vhdx/i), 'C:\\WSL\\ext4.vhdx');
    const submitBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Import In-Place',
    );
    await userEvent.click(submitBtns[submitBtns.length - 1]);
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('TestDistro', 'C:\\WSL\\ext4.vhdx');
  });

  it('calls onOpenChange(false) on cancel', async () => {
    render(<WslImportInPlaceDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
