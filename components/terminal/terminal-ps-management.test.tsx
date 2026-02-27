import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TerminalPsManagement } from './terminal-ps-management';
import type { PSProfileInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const psProfiles: PSProfileInfo[] = [
  { scope: 'CurrentUserCurrentHost', path: 'C:/profile.ps1', exists: true, sizeBytes: 256 },
  { scope: 'AllUsersAllHosts', path: 'C:/allprofile.ps1', exists: false, sizeBytes: 0 },
];

const executionPolicy: [string, string][] = [
  ['MachinePolicy', 'Undefined'],
  ['LocalMachine', 'RemoteSigned'],
];

describe('TerminalPsManagement', () => {
  it('renders PS profiles list', () => {
    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    expect(screen.getByText('CurrentUserCurrentHost')).toBeInTheDocument();
    expect(screen.getByText('AllUsersAllHosts')).toBeInTheDocument();
    expect(screen.getByText('terminal.exists')).toBeInTheDocument();
    expect(screen.getByText('terminal.notExists')).toBeInTheDocument();
  });

  it('renders execution policy table', () => {
    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    expect(screen.getByText('LocalMachine')).toBeInTheDocument();
    expect(screen.getByText('RemoteSigned')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalPsManagement
        psProfiles={[]}
        executionPolicy={[]}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.psProfiles')).not.toBeInTheDocument();
  });

  it('shows empty state when no PS profiles', () => {
    render(
      <TerminalPsManagement
        psProfiles={[]}
        executionPolicy={[]}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noPsProfiles')).toBeInTheDocument();
  });

  it('calls both fetch callbacks when refresh clicked', () => {
    const onFetchPSProfiles = jest.fn().mockResolvedValue(undefined);
    const onFetchExecutionPolicy = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={onFetchPSProfiles}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={onFetchExecutionPolicy}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /common\.refresh/i }));
    expect(onFetchPSProfiles).toHaveBeenCalledTimes(1);
    expect(onFetchExecutionPolicy).toHaveBeenCalledTimes(1);
  });

  it('calls onReadPSProfile when eye button clicked on existing profile', () => {
    const onReadPSProfile = jest.fn().mockResolvedValue('# profile content');

    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={onReadPSProfile}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    // Eye button only appears for profiles where exists=true
    const eyeButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('.lucide-eye') !== null
    );
    expect(eyeButtons.length).toBe(1);
    fireEvent.click(eyeButtons[0]);
    expect(onReadPSProfile).toHaveBeenCalledWith('CurrentUserCurrentHost');
  });

  it('displays profile size for existing profiles', () => {
    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={jest.fn()}
        onWritePSProfile={jest.fn()}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    expect(screen.getByText('0.3 KB')).toBeInTheDocument();
  });

  it('loads profile content then saves after editing', async () => {
    const onReadPSProfile = jest.fn().mockResolvedValue('# original content');
    const onWritePSProfile = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalPsManagement
        psProfiles={psProfiles}
        executionPolicy={executionPolicy}
        onFetchPSProfiles={jest.fn()}
        onReadPSProfile={onReadPSProfile}
        onWritePSProfile={onWritePSProfile}
        onFetchExecutionPolicy={jest.fn()}
        onSetExecutionPolicy={jest.fn()}
      />,
    );

    // Click eye button to load profile
    const eyeButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('.lucide-eye') !== null
    );
    fireEvent.click(eyeButtons[0]);

    await waitFor(() => {
      expect(onReadPSProfile).toHaveBeenCalledWith('CurrentUserCurrentHost');
    });

    // After loading, the scope name should appear as a heading and edit button should show
    await waitFor(() => {
      expect(screen.getByText('terminal.edit')).toBeInTheDocument();
    });

    // Click edit button
    fireEvent.click(screen.getByRole('button', { name: /terminal\.edit/i }));

    // Save button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /terminal\.save/i })).toBeInTheDocument();
    });

    // Click save
    fireEvent.click(screen.getByRole('button', { name: /terminal\.save/i }));
    expect(onWritePSProfile).toHaveBeenCalledWith('CurrentUserCurrentHost', '# original content');
  });
});
