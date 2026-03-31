import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalProfileList } from './terminal-profile-list';
import type { LaunchResult, TerminalProfile } from '@/types/tauri';
import { toast } from 'sonner';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
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
    color: partial.color ?? null,
    isDefault: partial.isDefault ?? false,
    createdAt: partial.createdAt ?? '',
    updatedAt: partial.updatedAt ?? '',
  };
}

function getDropdownTriggers() {
  // The dropdown triggers are the small icon buttons in each row,
  // excluding launch buttons and action bar buttons
  return screen.getAllByRole('button').filter((btn) => {
    const text = btn.textContent?.trim() ?? '';
    // Dropdown triggers have no visible text (just an icon)
    return text === '' && btn.closest('td');
  });
}

describe('TerminalProfileList', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFilePickerWith(file: File) {
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'input') {
        const input = element as HTMLInputElement;
        Object.defineProperty(input, 'files', {
          configurable: true,
          get: () => [file],
        });
        input.click = () => {
          input.onchange?.({
            target: { files: [file] },
          } as unknown as Event);
        };
        return input;
      }
      return element;
    });
  }

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
    expect(screen.getByText('terminal.launchFailed')).toBeInTheDocument();
    expect(screen.getByText('terminal.exitCode: 2')).toBeInTheDocument();

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

    const launchButtons = screen.getAllByRole('button').filter((btn) =>
      btn.textContent?.includes('terminal.launch'),
    );
    expect(launchButtons.length).toBe(2);
    expect(launchButtons[0]).toBeDisabled();
    expect(launchButtons[1]).toBeEnabled();

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

  it('renders profile row with envType and envVersion', () => {
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
    expect(screen.getByText('node 20')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(
      <TerminalProfileList
        profiles={[makeProfile({})]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.profile')).toBeInTheDocument();
    expect(screen.getByText('terminal.shell')).toBeInTheDocument();
    expect(screen.getByText('terminal.environment')).toBeInTheDocument();
    expect(screen.getByText('terminal.actions')).toBeInTheDocument();
  });

  it('calls onEdit via dropdown menu', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const profile = makeProfile({ id: 'edit-me', name: 'Editable' });

    render(
      <TerminalProfileList
        profiles={[profile]}
        onLaunch={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
      />,
    );

    const triggers = getDropdownTriggers();
    await user.click(triggers[0]);
    await waitFor(() => {
      expect(screen.getByText('terminal.edit')).toBeInTheDocument();
    });
    await user.click(screen.getByText('terminal.edit'));
    expect(onEdit).toHaveBeenCalledWith(profile);
  });

  it('shows set-default in dropdown for non-default profile', async () => {
    const user = userEvent.setup();
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

    const triggers = getDropdownTriggers();
    await user.click(triggers[0]);
    await waitFor(() => {
      expect(screen.getByText('terminal.setDefault')).toBeInTheDocument();
    });
    await user.click(screen.getByText('terminal.setDefault'));
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

  it('previews import and confirms with merge strategy by default', async () => {
    const user = userEvent.setup();
    const onImport = jest.fn().mockResolvedValue(1);
    const payload = JSON.stringify([{ id: 'profile-2', name: 'Imported', shellId: 'bash' }]);
    mockFilePickerWith(new File([payload], 'profiles.json', { type: 'application/json' }));

    render(
      <TerminalProfileList
        profiles={[makeProfile({ id: 'profile-1' })]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByRole('button', { name: /terminal\.importProfiles/i }));
    await screen.findByText('terminal.importPreviewTitle');
    await user.click(screen.getByRole('button', { name: /terminal\.importConfirm/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(payload, true);
    });
  });

  it('rejects invalid import payload before opening confirmation dialog', async () => {
    const user = userEvent.setup();
    const onImport = jest.fn();
    mockFilePickerWith(new File(['{invalid-json'], 'profiles.json', { type: 'application/json' }));

    render(
      <TerminalProfileList
        profiles={[makeProfile({ id: 'profile-1' })]}
        onLaunch={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onSetDefault={jest.fn()}
        onCreateNew={jest.fn()}
        onImport={onImport}
      />,
    );

    await user.click(screen.getByRole('button', { name: /terminal\.importProfiles/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('terminal.importValidationInvalidJson');
    });
    expect(screen.queryByText('terminal.importPreviewTitle')).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });
});
