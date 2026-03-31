import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslPortForwardCard } from './wsl-port-forward-card';

const toastSuccess = jest.fn();
const toastError = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.detail.portForward.title': 'Port Forwarding',
    'wsl.detail.portForward.desc': 'Manage port forwarding.',
    'wsl.detail.portForward.riskHint': 'Port-forward mutation needs admin permissions.',
    'wsl.detail.portForward.listenPort': 'Listen Port',
    'wsl.detail.portForward.listenAddress': 'Listen Address',
    'wsl.detail.portForward.connectAddr': 'Connect Address',
    'wsl.detail.portForward.connectPort': 'Connect Port',
    'wsl.detail.portForward.added': 'Port forwarding rule added',
    'wsl.detail.portForward.removed': 'Port forwarding rule removed',
    'wsl.detail.portForward.confirmAddTitle': 'Add Port Forward Rule',
    'wsl.detail.portForward.confirmAddDesc': 'Add listen:{listenPort} -> {connectAddress}:{connectPort}?',
    'wsl.detail.portForward.confirmRemoveTitle': 'Remove Port Forward Rule',
    'wsl.detail.portForward.confirmRemoveDesc': 'Remove listen port {listenPort}?',
    'wsl.detail.portForward.actionFailed': 'Port forward operation failed: {error}',
    'wsl.detail.portForward.elevationWarning': 'Administrator privileges are required for netsh portproxy changes.',
    'common.refresh': 'Refresh',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
  };

  return translations[key] || key;
};

describe('WslPortForwardCard', () => {
  const onRefresh = jest.fn<Promise<void>, []>();
  const onAdd = jest.fn<Promise<void>, [number, number, string, string]>();
  const onRemove = jest.fn<Promise<void>, [number, string]>();

  beforeEach(() => {
    jest.clearAllMocks();
    onRefresh.mockResolvedValue(undefined);
    onAdd.mockResolvedValue(undefined);
    onRemove.mockResolvedValue(undefined);
  });

  it('renders current rules and elevation warning', () => {
    render(
      <WslPortForwardCard
        rules={[
          {
            listenAddress: '0.0.0.0',
            listenPort: '3000',
            connectAddress: '172.24.240.1',
            connectPort: '3000',
          },
        ]}
        defaultConnectAddress="172.24.240.1"
        onRefresh={onRefresh}
        onAdd={onAdd}
        onRemove={onRemove}
        t={mockT}
      />,
    );

    expect(screen.getByText('Port Forwarding')).toBeInTheDocument();
    expect(screen.getByText('Administrator privileges are required for netsh portproxy changes.')).toBeInTheDocument();
    expect(screen.getByText('0.0.0.0')).toBeInTheDocument();
    expect(screen.getAllByText('3000').length).toBeGreaterThan(0);
  });

  it('requires confirmation before adding a rule', async () => {
    const user = userEvent.setup();
    render(
      <WslPortForwardCard
        rules={[]}
        defaultConnectAddress="172.24.240.1"
        onRefresh={onRefresh}
        onAdd={onAdd}
        onRemove={onRemove}
        t={mockT}
      />,
    );

    const [listenPort, connectPort] = screen.getAllByRole('spinbutton');
    await user.type(listenPort, '5000');
    const connectAddress = screen.getByLabelText('Connect Address');
    await user.clear(connectAddress);
    await user.type(connectAddress, '172.24.240.99');
    await user.type(connectPort, '5001');

    await user.click(screen.getByLabelText('add-port-forward-rule'));
    expect(screen.getByRole('heading', { name: 'Add Port Forward Rule' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('0.0.0.0', 5000, 5001, '172.24.240.99');
      expect(toastSuccess).toHaveBeenCalledWith('Port forwarding rule added');
    });
  });

  it('requires confirmation before removing a rule', async () => {
    const user = userEvent.setup();
    render(
      <WslPortForwardCard
        rules={[
          {
            listenAddress: '0.0.0.0',
            listenPort: '3000',
            connectAddress: '172.24.240.1',
            connectPort: '3000',
          },
        ]}
        defaultConnectAddress="172.24.240.1"
        onRefresh={onRefresh}
        onAdd={onAdd}
        onRemove={onRemove}
        t={mockT}
      />,
    );

    await user.click(screen.getByLabelText('remove-port-forward-3000-0.0.0.0'));
    expect(screen.getByText('Remove Port Forward Rule')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith('0.0.0.0', 3000);
      expect(toastSuccess).toHaveBeenCalledWith('Port forwarding rule removed');
    });
  });
});
