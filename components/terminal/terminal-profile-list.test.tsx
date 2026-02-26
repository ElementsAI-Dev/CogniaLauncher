import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalProfileList } from './terminal-profile-list';
import type { LaunchResult, TerminalProfile } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

function makeProfile(partial: Partial<TerminalProfile>): TerminalProfile {
  return {
    id: partial.id ?? 'profile-1',
    name: partial.name ?? 'Default Profile',
    shellId: partial.shellId ?? 'powershell',
    args: partial.args ?? [],
    envVars: partial.envVars ?? {},
    cwd: partial.cwd ?? null,
    startupCommand: partial.startupCommand ?? null,
    envType: partial.envType ?? null,
    envVersion: partial.envVersion ?? null,
    isDefault: partial.isDefault ?? false,
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
  };
}

describe('TerminalProfileList', () => {
  it('renders latest launch result and supports clearing', () => {
    const onClearLaunchResult = jest.fn();
    const lastResult: LaunchResult = {
      success: false,
      exitCode: 2,
      stdout: 'stdout text',
      stderr: 'stderr text',
    };

    render(
      <TerminalProfileList
        profiles={[makeProfile({ id: 'profile-1' })]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
        lastLaunchResult={{ profileId: 'profile-1', result: lastResult }}
        onClearLaunchResult={onClearLaunchResult}
      />,
    );

    expect(screen.getByText('terminal.lastLaunchResult')).toBeInTheDocument();
    expect(screen.getByText('terminal.profileId: profile-1')).toBeInTheDocument();
    expect(screen.getByText('terminal.launchFailed')).toBeInTheDocument();
    expect(screen.getByText('terminal.exitCode: 2')).toBeInTheDocument();
    expect(screen.getByText('stdout text')).toBeInTheDocument();
    expect(screen.getByText('stderr text')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'terminal.clearLaunchResult' }));
    expect(onClearLaunchResult).toHaveBeenCalledTimes(1);
  });

  it('shows per-profile launching state and disables only active launch button', () => {
    const onLaunch = jest.fn();
    const profiles = [
      makeProfile({ id: 'profile-running', name: 'Running' }),
      makeProfile({ id: 'profile-idle', name: 'Idle', shellId: 'bash' }),
    ];

    render(
      <TerminalProfileList
        profiles={profiles}
        onLaunch={onLaunch}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
        launchingProfileId="profile-running"
      />,
    );

    const launchButtons = screen.getAllByRole('button', { name: /terminal\.launch|terminal\.launching/ });
    expect(launchButtons[0]).toBeDisabled();
    expect(launchButtons[1]).toBeEnabled();
    expect(screen.getByRole('button', { name: 'terminal.launching' })).toBeInTheDocument();

    fireEvent.click(launchButtons[1]);
    expect(onLaunch).toHaveBeenCalledWith('profile-idle');
  });
});

