import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalProfileDialog } from './terminal-profile-dialog';
import type { ShellInfo, TerminalProfile } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const shellBash: ShellInfo = {
  id: 'bash',
  name: 'Bash',
  shellType: 'bash',
  version: '5.2',
  executablePath: '/bin/bash',
  configFiles: [],
  isDefault: true,
};

const shellPowerShell: ShellInfo = {
  id: 'powershell',
  name: 'PowerShell',
  shellType: 'powershell',
  version: '7.4',
  executablePath: 'C:/pwsh.exe',
  configFiles: [],
  isDefault: false,
};

function makeProfile(partial: Partial<TerminalProfile>): TerminalProfile {
  return {
    id: partial.id ?? 'profile-1',
    name: partial.name ?? 'Profile',
    shellId: partial.shellId ?? 'bash',
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

describe('TerminalProfileDialog', () => {
  it('resets form values when editing target changes', async () => {
    const onSave = jest.fn();
    const profileA = makeProfile({ id: 'a', name: 'Alpha', shellId: 'bash' });
    const profileB = makeProfile({ id: 'b', name: 'Beta', shellId: 'powershell' });

    const { rerender } = render(
      <TerminalProfileDialog
        key={profileA.id}
        open
        onOpenChange={jest.fn()}
        profile={profileA}
        shells={[shellBash, shellPowerShell]}
        onSave={onSave}
      />,
    );

    const nameInput = screen.getByLabelText('terminal.profileName');
    fireEvent.change(nameInput, { target: { value: 'Changed Locally' } });
    expect(nameInput).toHaveValue('Changed Locally');

    rerender(
      <TerminalProfileDialog
        key={profileB.id}
        open
        onOpenChange={jest.fn()}
        profile={profileB}
        shells={[shellBash, shellPowerShell]}
        onSave={onSave}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('terminal.profileName')).toHaveValue('Beta');
    });
  });

  it('uses first detected shell as default when creating profile', () => {
    const onSave = jest.fn();
    render(
      <TerminalProfileDialog
        open
        onOpenChange={jest.fn()}
        profile={null}
        shells={[shellBash, shellPowerShell]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('terminal.profileName'), {
      target: { value: 'My Profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'terminal.create' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Profile',
        shellId: 'bash',
      }),
    );
  });

  it('disables save when no shells are available', () => {
    render(
      <TerminalProfileDialog
        open
        onOpenChange={jest.fn()}
        profile={null}
        shells={[]}
        onSave={jest.fn()}
      />,
    );

    const createButton = screen.getByRole('button', { name: 'terminal.create' });
    expect(createButton).toBeDisabled();
  });
});
