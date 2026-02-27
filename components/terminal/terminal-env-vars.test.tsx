import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalEnvVars } from './terminal-env-vars';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('TerminalEnvVars', () => {
  const mockVars: [string, string][] = [
    ['PATH', '/usr/bin:/usr/local/bin'],
    ['EDITOR', 'vim'],
    ['NODE_VERSION', '20.10.0'],
    ['HOME', '/home/user'],
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
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const copyButtons = screen.getAllByRole('button').filter(
      (btn) => !btn.textContent?.includes('common.refresh'),
    );
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it('shows error toast when clipboard copy fails', async () => {
    const { toast } = await import('sonner');
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    });

    render(
      <TerminalEnvVars
        shellEnvVars={mockVars}
        onFetchShellEnvVars={jest.fn()}
      />,
    );

    const copyButtons = screen.getAllByRole('button').filter(
      (btn) => !btn.textContent?.includes('common.refresh'),
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
});
