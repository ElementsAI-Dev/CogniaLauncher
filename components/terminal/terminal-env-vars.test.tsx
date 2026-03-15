import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalEnvVars } from './terminal-env-vars';

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

const clipboardMock = jest.requireMock('@/lib/clipboard');

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('TerminalEnvVars', () => {
  const mockVars = [
    {
      key: 'PATH',
      value: {
        displayValue: '/usr/bin:/usr/local/bin',
        masked: false,
        hasValue: true,
        length: 23,
        isSensitive: false,
      },
    },
    {
      key: 'EDITOR',
      value: {
        displayValue: 'vim',
        masked: false,
        hasValue: true,
        length: 3,
        isSensitive: false,
      },
    },
    {
      key: 'NODE_VERSION',
      value: {
        displayValue: '20.10.0',
        masked: false,
        hasValue: true,
        length: 7,
        isSensitive: false,
      },
    },
    {
      key: 'HOME',
      value: {
        displayValue: '/home/user',
        masked: false,
        hasValue: true,
        length: 10,
        isSensitive: false,
      },
    },
    {
      key: 'API_TOKEN',
      value: {
        displayValue: '[hidden: 12 chars]',
        masked: true,
        hasValue: true,
        length: 12,
        isSensitive: true,
      },
    },
  ];

  it('renders categorized environment variables', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByText('PATH')).toBeInTheDocument();
    expect(screen.getByText('EDITOR')).toBeInTheDocument();
    expect(screen.getByText('NODE_VERSION')).toBeInTheDocument();
  });

  it('shows empty state when no vars', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={[]}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noEnvVars')).toBeInTheDocument();
  });

  it('filters variables by search', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('terminal.searchEnvVars');
    fireEvent.change(searchInput, { target: { value: 'NODE' } });

    expect(screen.getByText('NODE_VERSION')).toBeInTheDocument();
    expect(screen.queryByText('EDITOR')).not.toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={[]}
        onFetchShellEnvVars={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.noEnvVars')).not.toBeInTheDocument();
  });

  it('calls onFetchShellEnvVars when refresh button clicked', () => {
    const onFetch = jest.fn();
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={onFetch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /common\.refresh/i }));
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it('copies value to clipboard on copy button click', async () => {
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const copyButtons = screen.getAllByRole('button').filter((btn) =>
      !!btn.querySelector('.lucide-copy'),
    );
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(clipboardMock.writeClipboard).toHaveBeenCalledWith('/usr/bin:/usr/local/bin');
    });
  });

  it('shows error toast when clipboard copy fails', async () => {
    const { toast } = await import('sonner');
    clipboardMock.writeClipboard.mockRejectedValueOnce(new Error('denied'));

    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const copyButtons = screen.getAllByRole('button').filter((btn) =>
      !!btn.querySelector('.lucide-copy'),
    );
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy');
    });
  });

  it('filters variables by value', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('terminal.searchEnvVars');
    fireEvent.change(searchInput, { target: { value: 'vim' } });

    expect(screen.getByText('EDITOR')).toBeInTheDocument();
    expect(screen.queryByText('PATH')).not.toBeInTheDocument();
  });

  it('renders manage-envvars navigation link', () => {
    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /nav\.envvar/i })).toHaveAttribute('href', '/envvar');
  });

  it('reveals sensitive values before copying them', async () => {
    const onRevealShellEnvVar = jest.fn().mockResolvedValue('super-secret-token');

    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
        onRevealShellEnvVar={onRevealShellEnvVar}
      />,
    );

    const copyButtons = screen.getAllByRole('button').filter((btn) =>
      !!btn.querySelector('.lucide-copy'),
    );
    fireEvent.click(copyButtons[copyButtons.length - 1]);

    await waitFor(() => {
      expect(onRevealShellEnvVar).toHaveBeenCalledWith('API_TOKEN');
    });
    expect(clipboardMock.writeClipboard).toHaveBeenCalledWith('super-secret-token');
  });

  it('renders revealed sensitive values after explicit reveal', async () => {
    const onRevealShellEnvVar = jest.fn().mockResolvedValue('super-secret-token');

    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
        onRevealShellEnvVar={onRevealShellEnvVar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.revealSensitiveValue/i }));

    await waitFor(() => {
      expect(screen.getByText('super-secret-token')).toBeInTheDocument();
    });
  });
});
