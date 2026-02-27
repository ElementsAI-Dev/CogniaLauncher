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

  it('adds and removes env var rows', () => {
    render(
      <TerminalProfileDialog
        open
        onOpenChange={jest.fn()}
        profile={null}
        shells={[shellBash]}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /terminal\.addEnvVar/i }));
    const keyInputs = screen.getAllByPlaceholderText('KEY');
    expect(keyInputs.length).toBeGreaterThanOrEqual(1);

    const removeButtons = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('svg.lucide-trash-2') || btn.classList.contains('text-destructive'),
    );
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.queryAllByPlaceholderText('KEY').length).toBe(0);
  });

  it('saves profile with edited env vars', () => {
    const onSave = jest.fn();
    render(
      <TerminalProfileDialog
        open
        onOpenChange={jest.fn()}
        profile={null}
        shells={[shellBash]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('terminal.profileName'), {
      target: { value: 'WithEnv' },
    });

    fireEvent.click(screen.getByRole('button', { name: /terminal\.addEnvVar/i }));
    const keyInputs = screen.getAllByPlaceholderText('KEY');
    const valueInputs = screen.getAllByPlaceholderText('value');
    fireEvent.change(keyInputs[0], { target: { value: 'MY_VAR' } });
    fireEvent.change(valueInputs[0], { target: { value: 'hello' } });

    fireEvent.click(screen.getByRole('button', { name: 'terminal.create' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ envVars: { MY_VAR: 'hello' } }),
    );
  });

  it('splits args string into array on save', () => {
    const onSave = jest.fn();
    render(
      <TerminalProfileDialog
        open
        onOpenChange={jest.fn()}
        profile={null}
        shells={[shellBash]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('terminal.profileName'), {
      target: { value: 'WithArgs' },
    });
    fireEvent.change(screen.getByLabelText('terminal.shellArgs'), {
      target: { value: 'arg1 arg2 arg3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'terminal.create' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['arg1', 'arg2', 'arg3'] }),
    );
  });

  it('calls onOpenChange(false) when cancel clicked', () => {
    const onOpenChange = jest.fn();
    render(
      <TerminalProfileDialog
        open
        onOpenChange={onOpenChange}
        profile={null}
        shells={[shellBash]}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'terminal.cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falls back to first shell when profile shellId not in list', () => {
    const onSave = jest.fn();
    const profileBadShell = makeProfile({ id: 'p1', name: 'Bad Shell', shellId: 'nonexistent' });

    render(
      <TerminalProfileDialog
        key="fallback"
        open
        onOpenChange={jest.fn()}
        profile={profileBadShell}
        shells={[shellBash, shellPowerShell]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'terminal.save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ shellId: 'bash' }),
    );
  });
});
