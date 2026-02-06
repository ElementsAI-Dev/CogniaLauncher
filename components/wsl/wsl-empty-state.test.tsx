import { render, screen } from '@testing-library/react';
import { WslEmptyState } from './wsl-empty-state';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.noDistros': 'No WSL distributions installed',
    'wsl.noDistrosDesc': 'Install a Linux distribution to get started with WSL.',
  };
  return translations[key] || key;
};

describe('WslEmptyState', () => {
  it('renders empty state message', () => {
    render(<WslEmptyState t={mockT} />);

    expect(screen.getByText('No WSL distributions installed')).toBeInTheDocument();
    expect(
      screen.getByText('Install a Linux distribution to get started with WSL.'),
    ).toBeInTheDocument();
  });
});
