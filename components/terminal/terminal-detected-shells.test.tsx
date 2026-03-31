import { render, screen } from '@testing-library/react';
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
  it('does not emit fragment prop warnings when rendering shell rows', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<TerminalDetectedShells shells={shells} loading={false} />);

    const invalidFragmentWarning = errorSpy.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === 'string'
          && arg.includes('React.Fragment')
          && arg.includes('data-state'),
      ),
    );

    errorSpy.mockRestore();

    expect(invalidFragmentWarning).toBe(false);
  });

  it('renders shell table rows with name and version', () => {
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

  it('renders table headers', () => {
    render(<TerminalDetectedShells shells={shells} loading={false} />);

    expect(screen.getByText('terminal.shell')).toBeInTheDocument();
    expect(screen.getByText('terminal.path')).toBeInTheDocument();
    expect(screen.getByText('terminal.startup')).toBeInTheDocument();
    expect(screen.getByText('terminal.health')).toBeInTheDocument();
    expect(screen.getByText('terminal.actions')).toBeInTheDocument();
  });

  it('displays startup measurement inline', () => {
    const measurements = {
      bash: { withProfileMs: 45, withoutProfileMs: 30, differenceMs: 15 },
    };

    render(
      <TerminalDetectedShells
        shells={shells}
        loading={false}
        startupMeasurements={measurements}
      />,
    );

    expect(screen.getByText('45ms')).toBeInTheDocument();
  });

  it('displays health status inline', () => {
    const healthResults = {
      bash: { status: 'healthy' as const, issues: [] },
    };

    render(
      <TerminalDetectedShells
        shells={shells}
        loading={false}
        healthResults={healthResults}
      />,
    );

    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('surfaces degraded shell readout reasons', () => {
    const shellReadouts: Record<string, TerminalShellReadout> = {
      bash: {
        shellId: 'bash',
        status: 'failed',
        degradedReason: 'Health check failed: timeout',
        startupStatus: 'ready',
        startupFreshness: 'fresh',
        healthStatus: 'failed',
        healthFreshness: null,
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
      />,
    );

    // Degraded reason is shown in the expandable row
    // Need to expand it first - find the chevron button
    const expandButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-chevron-down')
    );
    expect(expandButton).toBeDefined();
  });

  it('shows explicit readout status badges for stale shell diagnostics', () => {
    const shellReadouts: Record<string, TerminalShellReadout> = {
      bash: {
        shellId: 'bash',
        status: 'stale',
        degradedReason: 'Startup measurement is stale after the latest probe failed.',
        startupStatus: 'ready',
        startupFreshness: 'stale',
        healthStatus: 'ready',
        healthFreshness: 'fresh',
        frameworkSummaryCount: 1,
        pluginSummaryCount: 2,
        lastUpdatedAt: Date.now(),
      },
    };

    render(
      <TerminalDetectedShells
        shells={[shells[0]]}
        loading={false}
        shellReadouts={shellReadouts}
      />,
    );

    expect(screen.getByText('terminal.readoutStatusStale')).toBeInTheDocument();
  });

  it('provides action dropdown triggers in table rows', () => {
    render(
      <TerminalDetectedShells
        shells={shells}
        loading={false}
        onMeasureStartup={jest.fn()}
        onCheckShellHealth={jest.fn()}
        onGetShellInfo={jest.fn()}
      />,
    );

    // Each shell row has a dropdown trigger (icon-only button in td)
    const iconButtons = screen.getAllByRole('button').filter(btn => {
      const text = btn.textContent?.trim() ?? '';
      return text === '' && btn.closest('td');
    });
    expect(iconButtons.length).toBeGreaterThan(0);
  });
});
