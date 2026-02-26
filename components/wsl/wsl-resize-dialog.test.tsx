import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslResizeDialog } from './wsl-resize-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.dialog.resize': 'Resize Virtual Disk',
    'wsl.dialog.resizeDesc': 'Set a new maximum size.',
    'wsl.resizeSize': 'New Disk Size',
    'common.cancel': 'Cancel',
  };
  return translations[key] || key;
};

describe('WslResizeDialog', () => {
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
    render(<WslResizeDialog {...defaultProps} />);
    expect(screen.getByText(/Resize Virtual Disk — Ubuntu/)).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<WslResizeDialog {...defaultProps} />);
    expect(screen.getByText('Set a new maximum size.')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WslResizeDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Set a new maximum size.')).not.toBeInTheDocument();
  });

  it('renders size input and unit selector', () => {
    render(<WslResizeDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('256')).toBeInTheDocument();
    // Default unit is GB
    expect(screen.getByText('GB')).toBeInTheDocument();
  });

  it('resize button disabled when size empty', () => {
    render(<WslResizeDialog {...defaultProps} />);
    const resizeBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Resize Virtual Disk',
    );
    expect(resizeBtns[resizeBtns.length - 1]).toBeDisabled();
  });

  it('enables resize button after typing size', async () => {
    render(<WslResizeDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('256'), '512');
    const resizeBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Resize Virtual Disk',
    );
    expect(resizeBtns[resizeBtns.length - 1]).not.toBeDisabled();
  });

  it('calls onConfirm with size+unit on submit', async () => {
    render(<WslResizeDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('256'), '100');
    const resizeBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Resize Virtual Disk',
    );
    await userEvent.click(resizeBtns[resizeBtns.length - 1]);
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('100GB');
  });

  it('calls onOpenChange(false) on cancel', async () => {
    render(<WslResizeDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits on Enter key in input', async () => {
    render(<WslResizeDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText('256'), '200{Enter}');
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('200GB');
  });
});
