import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslChangeUserDialog } from './wsl-change-user-dialog';
import type { WslUser } from '@/types/tauri';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.changeDefaultUser': 'Change Default User',
    'wsl.dialog.changeUserDesc': 'Select or enter a username.',
    'wsl.dialog.selectUser': 'Select user',
    'wsl.dialog.manualInput': 'Enter username manually',
    'wsl.dialog.selectFromList': 'Select from list',
    'wsl.username': 'Username',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
  };
  return translations[key] || key;
};

const mockUsers: WslUser[] = [
  { username: 'root', uid: 0, gid: 0, home: '/root', shell: '/bin/bash' },
  { username: 'alice', uid: 1000, gid: 1000, home: '/home/alice', shell: '/bin/bash' },
  { username: 'bob', uid: 1001, gid: 1001, home: '/home/bob', shell: '/bin/zsh' },
];

describe('WslChangeUserDialog', () => {
  const defaultProps = {
    open: true,
    distroName: 'Ubuntu',
    onOpenChange: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    listUsers: jest.fn().mockResolvedValue(mockUsers),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title with distro name', async () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    expect(screen.getByText(/Change Default User — Ubuntu/)).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    expect(screen.getByText('Select or enter a username.')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WslChangeUserDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Select or enter a username.')).not.toBeInTheDocument();
  });

  it('calls listUsers on open', async () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    await waitFor(() => {
      expect(defaultProps.listUsers).toHaveBeenCalledWith('Ubuntu');
    });
  });

  it('shows manual input link when users are loaded', async () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Enter username manually')).toBeInTheDocument();
    });
  });

  it('falls back to manual input when listUsers returns empty', async () => {
    const props = {
      ...defaultProps,
      listUsers: jest.fn().mockResolvedValue([]),
    };
    render(<WslChangeUserDialog {...props} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
    });
  });

  it('falls back to manual input when listUsers rejects', async () => {
    const props = {
      ...defaultProps,
      listUsers: jest.fn().mockRejectedValue(new Error('fail')),
    };
    render(<WslChangeUserDialog {...props} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
    });
  });

  it('calls onOpenChange(false) when cancel clicked', async () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirm button is disabled when no user is selected', async () => {
    render(<WslChangeUserDialog {...defaultProps} />);
    await waitFor(() => {
      const confirmBtn = screen.getByText('Confirm').closest('button');
      expect(confirmBtn).toBeDisabled();
    });
  });

  it('enables confirm when manual username is typed', async () => {
    const props = {
      ...defaultProps,
      listUsers: jest.fn().mockResolvedValue([]),
    };
    render(<WslChangeUserDialog {...props} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText('username'), 'testuser');
    const confirmBtn = screen.getByText('Confirm').closest('button');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('calls onConfirm with manual username on submit', async () => {
    const props = {
      ...defaultProps,
      listUsers: jest.fn().mockResolvedValue([]),
    };
    render(<WslChangeUserDialog {...props} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText('username'), 'testuser');
    await userEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith('Ubuntu', 'testuser');
  });
});
