import { render, screen } from '@testing-library/react';
import { GitBlameView } from './git-blame-view';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

describe('GitBlameView', () => {
  const mockOnGetBlame = jest.fn().mockResolvedValue([]);

  it('renders blame title', () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    expect(screen.getByText('git.blame.title')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    expect(screen.getByText('git.blame.noBlame')).toBeInTheDocument();
  });

  it('renders file input', () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    expect(screen.getByText('git.repo.browse')).toBeInTheDocument();
  });
});
