import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslInstallLocationDialog } from './wsl-install-location-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.installWithLocation': 'Install to Location',
    'wsl.installWithLocationDesc': 'Install distro to a custom location.',
    'wsl.importLocation': 'Location',
    'common.cancel': 'Cancel',
    'common.browse': 'Browse',
  };
  return translations[key] || key;
};

describe('WslInstallLocationDialog', () => {
  const defaultProps = {
    open: true,
    distroName: 'Fedora',
    onOpenChange: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and description', () => {
    render(<WslInstallLocationDialog {...defaultProps} />);
    expect(screen.getByText('Install to Location — Fedora')).toBeInTheDocument();
    expect(screen.getByText('Install distro to a custom location.')).toBeInTheDocument();
  });

  it('prefills default location and enables submit button', () => {
    render(<WslInstallLocationDialog {...defaultProps} />);
    expect(screen.getByLabelText('Location')).toHaveValue('C:\\WSL\\Fedora');
    const submitBtn = screen.getAllByRole('button', { name: 'Install to Location' }).at(-1);
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls onConfirm with trimmed location and closes dialog', async () => {
    const user = userEvent.setup();
    render(<WslInstallLocationDialog {...defaultProps} />);

    const locationInput = screen.getByLabelText('Location');
    await user.clear(locationInput);
    await user.type(locationInput, '  D:\\WSL\\Fedora  ');
    const submitBtn = screen.getAllByRole('button', { name: 'Install to Location' }).at(-1);
    await user.click(submitBtn!);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('Fedora', 'D:\\WSL\\Fedora');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets location after dialog is closed and reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WslInstallLocationDialog {...defaultProps} />);

    await user.type(screen.getByLabelText('Location'), 'D:\\WSL\\Fedora');

    rerender(<WslInstallLocationDialog {...defaultProps} open={false} />);
    rerender(<WslInstallLocationDialog {...defaultProps} open />);

    expect(screen.getByLabelText('Location')).toHaveValue('C:\\WSL\\Fedora');
  });
});
