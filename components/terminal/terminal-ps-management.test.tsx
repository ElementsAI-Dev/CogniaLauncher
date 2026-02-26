import { render, screen } from '@testing-library/react';
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
});
