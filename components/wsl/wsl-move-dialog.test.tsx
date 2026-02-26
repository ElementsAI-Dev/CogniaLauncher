import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslMoveDialog } from './wsl-move-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.dialog.move': 'Move Distribution',
    'wsl.dialog.moveDesc': 'Move the virtual disk to a new location.',
    'wsl.dialog.moveWarning': 'This may take a long time.',
    'wsl.moveLocation': 'Target Location',
    'common.cancel': 'Cancel',
    'common.browse': 'Browse',
  };
  return translations[key] || key;
};

describe('WslMoveDialog', () => {
  const defaultProps = {
    open: true,
    distroName: 'Ubuntu',
    onOpenChange: jest.fn(),
    onConfirm: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title with distro name', () => {
    render(<WslMoveDialog {...defaultProps} />);
    expect(screen.getByText(/Move Distribution — Ubuntu/)).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<WslMoveDialog {...defaultProps} />);
    expect(screen.getByText('Move the virtual disk to a new location.')).toBeInTheDocument();
  });

  it('renders warning alert', () => {
    render(<WslMoveDialog {...defaultProps} />);
    expect(screen.getByText('This may take a long time.')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WslMoveDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Move the virtual disk to a new location.')).not.toBeInTheDocument();
  });

  it('renders location input', () => {
    render(<WslMoveDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText(/WSL/)).toBeInTheDocument();
  });

  it('move button disabled when path empty', () => {
    render(<WslMoveDialog {...defaultProps} />);
    const footerBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Move Distribution',
    );
    expect(footerBtns[footerBtns.length - 1]).toBeDisabled();
  });

  it('enables move button after typing location', async () => {
    render(<WslMoveDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/WSL/), 'D:\\WSL');
    const footerBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Move Distribution',
    );
    expect(footerBtns[footerBtns.length - 1]).not.toBeDisabled();
  });

  it('calls onConfirm with location on submit', async () => {
    render(<WslMoveDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/WSL/), 'D:\\WSL\\Distros');
    const footerBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Move Distribution',
    );
    await userEvent.click(footerBtns[footerBtns.length - 1]);
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('D:\\WSL\\Distros');
  });

  it('calls onOpenChange(false) on cancel', async () => {
    render(<WslMoveDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits on Enter key in input', async () => {
    render(<WslMoveDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/WSL/);
    await userEvent.type(input, 'D:\\WSL{Enter}');
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('D:\\WSL');
  });
});
