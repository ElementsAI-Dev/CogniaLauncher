import { fireEvent, render, screen } from '@testing-library/react';
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
});
