import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslDistroNetwork } from './wsl-distro-network';
import type { WslExecResult } from '@/types/tauri';

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn(() => Promise.resolve()),
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.detail.networkInfo': 'Network Info',
    'wsl.detail.networkNotRunning': 'Distro is not running',
    'wsl.detail.hostname': 'Hostname',
    'wsl.detail.networkInterfaces': 'Network Interfaces',
    'wsl.detail.listeningPorts': 'Listening Ports',
    'wsl.detail.noPorts': 'No listening ports',
    'wsl.detail.portProtocol': 'Protocol',
    'wsl.detail.portAddress': 'Address',
    'wsl.detail.portNumber': 'Port',
    'wsl.detail.portProcess': 'Process',
    'wsl.ipAddress': 'IP Address',
    'wsl.highRiskHint': 'High risk operation.',
    'wsl.detail.portForward.title': 'Port Forwarding',
    'wsl.detail.portForward.desc': 'Manage port forwarding.',
    'wsl.detail.portForward.riskHint': 'Port-forward mutation needs admin permissions.',
    'wsl.detail.portForward.listenPort': 'Listen Port',
    'wsl.detail.portForward.connectAddr': 'Connect Address',
    'wsl.detail.portForward.connectPort': 'Connect Port',
    'wsl.detail.portForward.added': 'Port forwarding rule added',
    'wsl.detail.portForward.removed': 'Port forwarding rule removed',
    'wsl.detail.portForward.confirmAddTitle': 'Add Port Forward Rule',
    'wsl.detail.portForward.confirmAddDesc': 'Add listen:{listenPort} -> {connectAddress}:{connectPort}?',
    'wsl.detail.portForward.confirmRemoveTitle': 'Remove Port Forward Rule',
    'wsl.detail.portForward.confirmRemoveDesc': 'Remove listen port {listenPort}?',
    'wsl.detail.portForward.actionFailed': 'Port forward operation failed: {error}',
    'common.refresh': 'Refresh',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
  };
  return translations[key] || key;
};

describe('WslDistroNetwork', () => {
  const defaultOnExec = jest.fn<Promise<WslExecResult>, [string, string, string?]>();
  const defaultGetIp = jest.fn<Promise<string>, [string?]>();
  const defaultListPortForwards = jest.fn<Promise<Array<{ listenAddress: string; listenPort: string; connectAddress: string; connectPort: string }>>, []>();
  const defaultAddPortForward = jest.fn<Promise<void>, [number, number, string]>();
  const defaultRemovePortForward = jest.fn<Promise<void>, [number]>();

  const defaultProps = {
    distroName: 'Ubuntu',
    isRunning: false,
    getIpAddress: defaultGetIp,
    onExec: defaultOnExec,
    listPortForwards: defaultListPortForwards,
    addPortForward: defaultAddPortForward,
    removePortForward: defaultRemovePortForward,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultGetIp.mockResolvedValue('172.20.0.5');
    defaultListPortForwards.mockResolvedValue([
      {
        listenAddress: '*',
        listenPort: '3000',
        connectAddress: '172.20.0.5',
        connectPort: '3000',
      },
    ]);
    defaultAddPortForward.mockResolvedValue(undefined);
    defaultRemovePortForward.mockResolvedValue(undefined);
    defaultOnExec.mockImplementation((_distro: string, cmd: string) => {
      if (cmd.includes('hostname')) {
        return Promise.resolve({ exitCode: 0, stdout: 'ubuntu-wsl\n', stderr: '' });
      }
      if (cmd.includes('nameserver')) {
        return Promise.resolve({ exitCode: 0, stdout: '8.8.8.8\n8.8.4.4\n', stderr: '' });
      }
      if (cmd.includes('ss ')) {
        return Promise.resolve({ exitCode: 0, stdout: "LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=42,fd=3))\n", stderr: '' });
      }
      if (cmd.includes('ip addr')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '1: lo: <LOOPBACK>\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST>\n    link/ether 00:15:5d:a0:b1:c2\n    inet 172.20.0.5/20\n    inet6 fe80::1/64\n',
          stderr: '',
        });
      }
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    });
  });

  it('renders title', () => {
    render(<WslDistroNetwork {...defaultProps} />);
    expect(screen.getByText('Network Info')).toBeInTheDocument();
  });

  it('shows not running message when isRunning is false', () => {
    render(<WslDistroNetwork {...defaultProps} />);
    expect(screen.getByText('Distro is not running')).toBeInTheDocument();
  });

  it('auto-loads network info and port-forward rules when running', async () => {
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);

    await waitFor(() => {
      expect(defaultGetIp).toHaveBeenCalledWith('Ubuntu');
      expect(defaultOnExec).toHaveBeenCalled();
      expect(defaultListPortForwards).toHaveBeenCalled();
    });
  });

  it('requires confirmation before adding a port-forward rule', async () => {
    const user = userEvent.setup();
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);

    const [listenInput, connectPortInput] = screen.getAllByRole('spinbutton');
    await user.type(listenInput, '5000');
    await user.type(screen.getByRole('textbox'), '172.20.0.5');
    await user.type(connectPortInput, '5000');

    await user.click(screen.getByLabelText('add-port-forward-rule'));

    expect(screen.getByText('Add Port Forward Rule')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(defaultAddPortForward).toHaveBeenCalledWith(5000, 5000, '172.20.0.5');
      expect(defaultListPortForwards).toHaveBeenCalledTimes(2);
    });
  });

  it('requires confirmation before removing a port-forward rule', async () => {
    const user = userEvent.setup();
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('remove-port-forward-3000')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('remove-port-forward-3000'));

    expect(screen.getByText('Remove Port Forward Rule')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(defaultRemovePortForward).toHaveBeenCalledWith(3000);
      expect(defaultListPortForwards).toHaveBeenCalledTimes(2);
    });
  });

  it('shows actionable error when mutation fails', async () => {
    const user = userEvent.setup();
    defaultAddPortForward.mockRejectedValueOnce(new Error('netsh failed'));
    render(<WslDistroNetwork {...defaultProps} isRunning={true} />);

    const [listenInput, connectPortInput] = screen.getAllByRole('spinbutton');
    await user.type(listenInput, '5001');
    await user.type(screen.getByRole('textbox'), '172.20.0.5');
    await user.type(connectPortInput, '5001');

    await user.click(screen.getByLabelText('add-port-forward-rule'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Port forward operation failed: Error: netsh failed');
    });
  });
});
