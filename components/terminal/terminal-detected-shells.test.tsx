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
});
