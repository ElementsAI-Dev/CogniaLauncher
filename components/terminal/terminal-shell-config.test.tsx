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
});
