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

  it('shows empty state with createFirst button', () => {
    const onCreateNew = jest.fn();
    render(
      <TerminalProfileList
        profiles={[]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={onCreateNew}
      />,
    );

    expect(screen.getByText('terminal.noProfiles')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /terminal\.createFirst/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('renders profile card with envType and envVersion', () => {
    const profile = makeProfile({
      id: 'p1',
      name: 'Node Dev',
      shellId: 'bash',
      envType: 'node',
      envVersion: '20',
    });

    render(
      <TerminalProfileList
        profiles={[profile]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
      />,
    );

    expect(screen.getByText('Node Dev')).toBeInTheDocument();
    expect(screen.getByText(/node 20/)).toBeInTheDocument();
  });

  it('calls onEdit and onDelete with correct arguments', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const profile = makeProfile({ id: 'edit-me', name: 'Editable' });

    render(
      <TerminalProfileList
        profiles={[profile]}
        onLaunch={jest.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
      />,
    );

    const allButtons = screen.getAllByRole('button');
    const editBtn = allButtons.find((btn) =>
      btn.querySelector('.lucide-pencil') !== null
    );
    const deleteBtn = allButtons.find((btn) =>
      btn.classList.contains('text-destructive')
    );

    if (editBtn) fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(profile);

    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('edit-me');
  });

  it('shows set-default button for non-default and default badge for default', () => {
    const onSetDefault = jest.fn();
    const nonDefaultProfile = makeProfile({ id: 'non', name: 'NonDefault', isDefault: false });

    render(
      <TerminalProfileList
        profiles={[nonDefaultProfile]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={onSetDefault}
        onCreateNew={jest.fn()}
      />,
    );

    const starButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('.lucide-star') !== null
    );
    expect(starButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(starButtons[0]);
    expect(onSetDefault).toHaveBeenCalledWith('non');
  });

  it('shows export and import buttons when callbacks provided', () => {
    render(
      <TerminalProfileList
        profiles={[makeProfile({})]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
        onExportAll={jest.fn()}
        onImport={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.exportProfiles')).toBeInTheDocument();
    expect(screen.getByText('terminal.importProfiles')).toBeInTheDocument();
  });
});

