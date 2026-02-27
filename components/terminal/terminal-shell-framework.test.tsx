import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalShellFramework } from './terminal-shell-framework';
import type { ShellInfo, ShellFrameworkInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const shells: ShellInfo[] = [
  {
    id: 'zsh',
    name: 'Zsh',
    shellType: 'zsh',
    version: '5.9',
    executablePath: '/bin/zsh',
    configFiles: [],
    isDefault: true,
  },
];

const frameworks: ShellFrameworkInfo[] = [
  {
    name: 'Oh My Zsh',
    version: '1.0.0',
    path: '/home/user/.oh-my-zsh',
    shellType: 'zsh',
  },
];

describe('TerminalShellFramework', () => {
  it('renders framework list', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('Oh My Zsh')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('shows empty state when no frameworks', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noFrameworks')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.noFrameworks')).not.toBeInTheDocument();
  });

  it('renders plugins when framework selected', () => {
    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[
          { name: 'git', enabled: true, source: 'oh-my-zsh' },
          { name: 'docker', enabled: false, source: 'oh-my-zsh' },
        ]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    expect(screen.getByText('Oh My Zsh')).toBeInTheDocument();
  });

  it('calls onDetectFrameworks for each shell when detect button clicked', async () => {
    const onDetectFrameworks = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={onDetectFrameworks}
        onFetchPlugins={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.detectFrameworks/i }));

    await waitFor(() => {
      expect(onDetectFrameworks).toHaveBeenCalledWith('zsh');
    });
  });

  it('calls onFetchPlugins when framework clicked', async () => {
    const onFetchPlugins = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalShellFramework
        shells={shells}
        frameworks={frameworks}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={onFetchPlugins}
      />,
    );

    fireEvent.click(screen.getByText('Oh My Zsh'));

    await waitFor(() => {
      expect(onFetchPlugins).toHaveBeenCalledWith('Oh My Zsh', '/home/user/.oh-my-zsh', 'zsh');
    });
  });

  it('disables detect button when no shells provided', () => {
    render(
      <TerminalShellFramework
        shells={[]}
        frameworks={[]}
        plugins={[]}
        onDetectFrameworks={jest.fn()}
        onFetchPlugins={jest.fn()}
      />,
    );

    const detectButton = screen.getByRole('button', { name: /terminal\.detectFrameworks/i });
    expect(detectButton).toBeDisabled();
  });
});
