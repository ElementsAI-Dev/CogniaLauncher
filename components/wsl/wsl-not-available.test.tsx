import { render, screen } from '@testing-library/react';
import { WslNotAvailable } from './wsl-not-available';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.notAvailable': 'WSL is not available on this system',
    'wsl.notAvailableDesc': "Install WSL by running 'wsl --install' in an elevated PowerShell prompt.",
  };
  return translations[key] || key;
};

describe('WslNotAvailable', () => {
  it('renders not available message and instructions', () => {
    render(<WslNotAvailable t={mockT} />);

    expect(screen.getByText('WSL is not available on this system')).toBeInTheDocument();
    expect(
      screen.getByText("Install WSL by running 'wsl --install' in an elevated PowerShell prompt."),
    ).toBeInTheDocument();
  });
});
