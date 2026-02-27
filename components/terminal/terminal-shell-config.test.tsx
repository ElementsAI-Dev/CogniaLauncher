import { render, screen } from '@testing-library/react';
import { TerminalShellConfig } from './terminal-shell-config';
import type { ShellInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const shells: ShellInfo[] = [
  {
    id: 'bash',
    name: 'Bash',
    shellType: 'bash',
    version: '5.2',
    executablePath: '/bin/bash',
    configFiles: [
      { path: '/home/user/.bashrc', exists: true, sizeBytes: 1024 },
    ],
    isDefault: true,
  },
];

const shellNoConfig: ShellInfo[] = [
  {
    id: 'fish',
    name: 'Fish',
    shellType: 'fish',
    version: '3.6',
    executablePath: '/usr/bin/fish',
    configFiles: [
      { path: '/home/user/.config/fish/config.fish', exists: false, sizeBytes: 0 },
    ],
    isDefault: false,
  },
];

describe('TerminalShellConfig', () => {
  it('renders shell selector and config file dropdown', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
  });

  it('returns null when no shells provided', () => {
    const { container } = render(
      <TerminalShellConfig
        shells={[]}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders with onWriteConfig prop without error', () => {
    const { container } = render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
      />,
    );

    expect(container.querySelector('[role="combobox"]')).toBeInTheDocument();
  });

  it('has load button disabled when no config path selected', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();
  });

  it('shows noConfigFiles when shell has no existing config files', () => {
    render(
      <TerminalShellConfig
        shells={shellNoConfig}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noConfigFiles')).toBeInTheDocument();
  });

  it('renders config file dropdown for shell with existing config files', () => {
    render(
      <TerminalShellConfig
        shells={shells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
      />,
    );

    // Two comboboxes: shell selector + config file selector
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(2);

    // Load button exists but is disabled (no config path selected yet)
    const loadButton = screen.getByRole('button', { name: /terminal\.loadConfig/i });
    expect(loadButton).toBeDisabled();
  });

  it('renders multiple shells in selector when provided', () => {
    const multiShells: ShellInfo[] = [
      ...shells,
      {
        id: 'zsh',
        name: 'Zsh',
        shellType: 'zsh',
        version: '5.9',
        executablePath: '/bin/zsh',
        configFiles: [
          { path: '/home/user/.zshrc', exists: true, sizeBytes: 512 },
        ],
        isDefault: false,
      },
    ];

    render(
      <TerminalShellConfig
        shells={multiShells}
        onReadConfig={jest.fn()}
        onFetchConfigEntries={jest.fn()}
        onBackupConfig={jest.fn()}
        onWriteConfig={jest.fn()}
      />,
    );

    // Component renders without error with multiple shells
    expect(screen.getByText('terminal.shellConfig')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBe(2);
  });
});
