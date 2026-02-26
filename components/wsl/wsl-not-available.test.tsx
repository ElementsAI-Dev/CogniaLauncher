import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslNotAvailable } from './wsl-not-available';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.notAvailable': 'WSL is not available on this system',
    'wsl.notAvailableDesc': "Install WSL by running 'wsl --install' in an elevated PowerShell prompt.",
    'wsl.installWsl': 'Install WSL',
    'wsl.installWslSuccess': 'WSL installed successfully. A restart may be required.',
  };
  return translations[key] || key;
};

describe('WslNotAvailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders not available message and instructions', () => {
    render(<WslNotAvailable t={mockT} />);

    expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
    expect(
      screen.getByText("Install WSL by running 'wsl --install' in an elevated PowerShell prompt."),
    ).toBeInTheDocument();
  });

  it('triggers install callback when install button is clicked', async () => {
    const user = userEvent.setup();
    const onInstallWsl = jest.fn().mockResolvedValue('installed');
    render(<WslNotAvailable t={mockT} onInstallWsl={onInstallWsl} />);

    await user.click(screen.getByRole('button', { name: 'Install WSL' }));

    await waitFor(() => expect(onInstallWsl).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
