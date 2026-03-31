import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslNetworkModeCard } from './wsl-network-mode-card';

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    'wsl.detail.networkMode.title': 'Network Mode',
    'wsl.detail.networkMode.desc': 'Switch the WSL global networking mode and restart WSL when needed.',
    'wsl.detail.networkMode.current': 'Current mode',
    'wsl.detail.networkMode.apply': 'Apply Network Mode',
    'wsl.detail.networkMode.confirmTitle': 'Apply network mode change',
    'wsl.detail.networkMode.confirmDesc': `This will restart ${params?.count ?? 0} running distros.`,
    'wsl.detail.networkMode.restartHint': 'Saving this change will run wsl --shutdown.',
    'wsl.netMode.nat': 'NAT',
    'wsl.netMode.natDesc': 'Default mode.',
    'wsl.netMode.mirrored': 'Mirrored',
    'wsl.netMode.mirroredDesc': 'Shared stack.',
    'wsl.netMode.virtioproxy': 'VirtioProxy',
    'wsl.netMode.virtioproxyDesc': 'Proxy fallback.',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
  };

  return translations[key] || key;
};

describe('WslNetworkModeCard', () => {
  const onApply = jest.fn<Promise<void>, [string]>();

  beforeEach(() => {
    jest.clearAllMocks();
    onApply.mockResolvedValue(undefined);
  });

  it('renders current mode details', () => {
    render(
      <WslNetworkModeCard
        currentMode="NAT"
        runningCount={2}
        onApply={onApply}
        t={mockT}
      />,
    );

    expect(screen.getByText('Network Mode')).toBeInTheDocument();
    expect(screen.getByText('Current mode')).toBeInTheDocument();
    expect(screen.getAllByText('NAT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Default mode.').length).toBeGreaterThan(0);
  });

  it('confirms before applying a changed mode and shows running count', async () => {
    const user = userEvent.setup();
    render(
      <WslNetworkModeCard
        currentMode="NAT"
        runningCount={3}
        onApply={onApply}
        t={mockT}
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Mirrored'));
    await user.click(screen.getByRole('button', { name: 'Apply Network Mode' }));

    expect(screen.getByRole('heading', { name: 'Apply network mode change' })).toBeInTheDocument();
    expect(screen.getByText('This will restart 3 running distros.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith('mirrored');
    });
  });
});
