import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalDetectedShells } from './terminal-detected-shells';
import type { ShellInfo } from '@/types/tauri';
import type { TerminalShellReadout } from '@/types/terminal';

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

    expect(screen.getAllByText('Bash').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PowerShell').length).toBeGreaterThan(0);
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

  it('renders config files with exists indicator and size', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: 'terminal.configFilesCount' }));
    expect(screen.getByText('.zshrc')).toBeInTheDocument();
    expect(screen.getByText('.zprofile')).toBeInTheDocument();
    expect(screen.getByText('(0.5 KB)')).toBeInTheDocument();
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  it('opens a shell detail drilldown with executable path and config targets', async () => {
    const user = userEvent.setup();
    const onGetShellInfo = jest.fn().mockResolvedValue(shells[1]);

    render(
      <TerminalDetectedShells
        shells={shells}
        loading={false}
        onGetShellInfo={onGetShellInfo}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /terminal\.viewShellDetails/i })[1]);

    expect(onGetShellInfo).toHaveBeenCalledWith('powershell');
    expect(await screen.findByText('terminal.shellDetailsTitle')).toBeInTheDocument();
    expect(screen.getByText('C:/pwsh.exe')).toBeInTheDocument();
    expect(screen.getByText('C:/profile.ps1')).toBeInTheDocument();
  });

  it('surfaces degraded shell readout reasons without discarding shell details', async () => {
    const user = userEvent.setup();
    const shellReadouts: Record<string, TerminalShellReadout> = {
      bash: {
        shellId: 'bash',
        status: 'failed',
        degradedReason: 'Health check failed: timeout',
        startupStatus: 'ready',
        healthStatus: 'failed',
        frameworkSummaryCount: 0,
        pluginSummaryCount: 0,
        lastUpdatedAt: Date.now(),
      },
    };

    render(
      <TerminalDetectedShells
        shells={[shells[0]]}
        loading={false}
        shellReadouts={shellReadouts}
        onGetShellInfo={jest.fn().mockResolvedValue(shells[0])}
      />,
    );

    expect(screen.getByText('Health check failed: timeout')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'terminal.viewShellDetails' }));
    expect((await screen.findAllByText('Health check failed: timeout')).length).toBeGreaterThan(1);
    expect(screen.getByText('/bin/bash')).toBeInTheDocument();
  });

});
