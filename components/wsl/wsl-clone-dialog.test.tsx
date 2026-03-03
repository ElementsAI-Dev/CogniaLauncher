import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslCloneDialog } from './wsl-clone-dialog';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.clone': 'Clone',
    'wsl.cloneDesc': 'Create a new distro by cloning the source distro.',
    'wsl.cloneName': 'Clone Name',
    'wsl.cloneNameMustDiffer': 'Clone name must be different from source distro name.',
    'wsl.cloneLocation': 'Install Location',
    'common.cancel': 'Cancel',
    'common.browse': 'Browse',
  };
  return translations[key] || key;
};

describe('WslCloneDialog', () => {
  const defaultProps = {
    open: true,
    distroName: 'Ubuntu',
    onOpenChange: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and description', () => {
    render(<WslCloneDialog {...defaultProps} />);
    expect(screen.getByText('Clone — Ubuntu')).toBeInTheDocument();
    expect(screen.getByText('Create a new distro by cloning the source distro.')).toBeInTheDocument();
  });

  it('keeps submit button disabled when fields are empty', () => {
    render(<WslCloneDialog {...defaultProps} />);
    const submitBtn = screen.getAllByRole('button', { name: 'Clone' }).at(-1);
    expect(submitBtn).toBeDisabled();
  });

  it('disables submit and shows validation when clone name equals source name', async () => {
    const user = userEvent.setup();
    render(<WslCloneDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Ubuntu-Clone'), 'ubuntu');
    await user.type(screen.getByLabelText('Install Location'), 'D:\\WSL\\Clones');

    expect(screen.getByText('Clone name must be different from source distro name.')).toBeInTheDocument();
    const submitBtn = screen.getAllByRole('button', { name: 'Clone' }).at(-1);
    expect(submitBtn).toBeDisabled();
  });

  it('calls onConfirm with trimmed values and closes dialog', async () => {
    const user = userEvent.setup();
    render(<WslCloneDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Ubuntu-Clone'), '  Ubuntu-Copy  ');
    await user.type(screen.getByLabelText('Install Location'), '  D:\\WSL\\Clones  ');
    const submitBtn = screen.getAllByRole('button', { name: 'Clone' }).at(-1);
    await user.click(submitBtn!);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('Ubuntu', 'Ubuntu-Copy', 'D:\\WSL\\Clones');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets inputs after dialog is closed and reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WslCloneDialog {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Ubuntu-Clone'), 'Ubuntu-Copy');
    await user.type(screen.getByLabelText('Install Location'), 'D:\\WSL\\Clones');

    rerender(<WslCloneDialog {...defaultProps} open={false} />);
    rerender(<WslCloneDialog {...defaultProps} open />);

    expect(screen.getByPlaceholderText('Ubuntu-Clone')).toHaveValue('');
    expect(screen.getByLabelText('Install Location')).toHaveValue('');
  });
});
