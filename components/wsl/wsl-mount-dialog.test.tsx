import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslMountDialog } from './wsl-mount-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.dialog.mount': 'Mount Disk',
    'wsl.dialog.mountDesc': 'Attach a physical or virtual disk.',
    'wsl.dialog.mountDiskPath': 'Disk Path',
    'wsl.dialog.mountIsVhd': 'VHD File',
    'wsl.dialog.mountBare': 'Bare (attach only)',
    'wsl.dialog.mountFsType': 'Filesystem Type',
    'wsl.dialog.mountPartition': 'Partition',
    'wsl.dialog.mountName': 'Mount Name',
    'wsl.dialog.mountOptions': 'Mount Options',
    'wsl.mountNameOptional': 'Mount Name (optional)',
    'common.cancel': 'Cancel',
    'common.browse': 'Browse',
  };
  return translations[key] || key;
};

describe('WslMountDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    capabilities: { manage: true, move: true, resize: true, setSparse: true, setDefaultUser: true, mountOptions: true, shutdownForce: true, exportFormat: true, importInPlace: true, version: '2.0.0' },
    onConfirm: jest.fn().mockResolvedValue('ok'),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title', () => {
    render(<WslMountDialog {...defaultProps} />);
    expect(screen.getAllByText('Mount Disk').length).toBeGreaterThanOrEqual(1);
  });

  it('renders description', () => {
    render(<WslMountDialog {...defaultProps} />);
    expect(screen.getByText('Attach a physical or virtual disk.')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WslMountDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Attach a physical or virtual disk.')).not.toBeInTheDocument();
  });

  it('renders disk path input', () => {
    render(<WslMountDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText(/PhysicalDrive/)).toBeInTheDocument();
  });

  it('renders VHD and bare switches', () => {
    render(<WslMountDialog {...defaultProps} />);
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  it('renders filesystem type and partition inputs', () => {
    render(<WslMountDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('ext4')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
  });

  it('mount submit button disabled when disk path empty', () => {
    render(<WslMountDialog {...defaultProps} />);
    const mountBtns = screen.getAllByText('Mount Disk');
    const submitBtn = mountBtns.find((el) => el.closest('button'));
    expect(submitBtn?.closest('button')).toBeDisabled();
  });

  it('mount submit button enabled after path typed', async () => {
    render(<WslMountDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/PhysicalDrive/);
    await userEvent.type(input, '\\\\.\\PhysicalDrive1');
    const mountBtns = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Mount Disk',
    );
    expect(mountBtns[mountBtns.length - 1]).not.toBeDisabled();
  });

  it('calls onConfirm with correct options on submit', async () => {
    render(<WslMountDialog {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/PhysicalDrive/), '\\\\.\\PhysicalDrive1');
    const mountBtns = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Mount Disk',
    );
    await userEvent.click(mountBtns[mountBtns.length - 1]);
    expect(defaultProps.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ diskPath: '\\\\.\\PhysicalDrive1', isVhd: false, bare: false }),
    );
  });

  it('calls onOpenChange(false) on cancel', async () => {
    render(<WslMountDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
