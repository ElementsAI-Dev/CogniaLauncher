import { render, screen } from '@testing-library/react';
import { TerminalDetectedShells } from './terminal-detected-shells';
import type { ShellInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const shells: ShellInfo[] = [
  {
    id: 'bash',
    name: 'Bash',
    shellType: 'bash',
    version: '5.2',
    executablePath: '/bin/bash',
    configFiles: [],
    isDefault: true,
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    shellType: 'powershell',
    version: '7.4',
    executablePath: 'C:/pwsh.exe',
    configFiles: [{ path: 'C:/profile.ps1', exists: true, sizeBytes: 512 }],
    isDefault: false,
  },
];

describe('TerminalDetectedShells', () => {
  it('renders shell cards with name and version', () => {
    render(<TerminalDetectedShells shells={shells} loading={false} />);

    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('PowerShell')).toBeInTheDocument();
    expect(screen.getByText('v5.2')).toBeInTheDocument();
  });

  it('shows empty state when no shells', () => {
    render(<TerminalDetectedShells shells={[]} loading={false} />);

    expect(screen.getByText('terminal.noShellsDetected')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(<TerminalDetectedShells shells={[]} loading />);

    expect(screen.queryByText('terminal.noShellsDetected')).not.toBeInTheDocument();
  });

  it('renders default badge for default shell', () => {
    render(<TerminalDetectedShells shells={shells} loading={false} />);

    expect(screen.getByText('terminal.default')).toBeInTheDocument();
  });

  it('renders config files with exists indicator and size', () => {
    const shellsWithConfig: ShellInfo[] = [
      {
        id: 'zsh',
        name: 'Zsh',
        shellType: 'zsh',
        version: null,
        executablePath: '/bin/zsh',
        configFiles: [
          { path: '/home/user/.zshrc', exists: true, sizeBytes: 512 },
          { path: '/home/user/.zprofile', exists: false, sizeBytes: 0 },
        ],
        isDefault: false,
      },
    ];
    render(<TerminalDetectedShells shells={shellsWithConfig} loading={false} />);

    expect(screen.getByText('/home/user/.zshrc')).toBeInTheDocument();
    expect(screen.getByText('/home/user/.zprofile')).toBeInTheDocument();
    expect(screen.getByText('(0.5 KB)')).toBeInTheDocument();
    expect(screen.queryByText('v')).not.toBeInTheDocument();
  });
});
