import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitBlameView } from './git-blame-view';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('@/lib/utils/git-date', () => ({
  formatRelativeTimestamp: (ts: number) => `${ts}`,
}));

describe('GitBlameView', () => {
  const blameEntries = [
    { commitHash: 'abc1234567890', author: 'John Doe', timestamp: 1700000000, lineNumber: 1, content: 'line one' },
    { commitHash: 'abc1234567890', author: 'John Doe', timestamp: 1700000000, lineNumber: 2, content: 'line two' },
    { commitHash: 'def5678901234', author: 'Jane Smith', timestamp: 1700086400, lineNumber: 3, content: 'line three' },
  ];
  const mockOnGetBlame = jest.fn().mockResolvedValue(blameEntries);

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnGetBlame.mockResolvedValue(blameEntries);
  });

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

  it('loads blame on Enter key', async () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'src/main.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockOnGetBlame).toHaveBeenCalledWith('src/main.ts');
    });
  });

  it('does not load blame for empty input on Enter', () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnGetBlame).not.toHaveBeenCalled();
  });

  it('renders blame entries after loading', async () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'src/main.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('line one')).toBeInTheDocument();
      expect(screen.getByText('line three')).toBeInTheDocument();
    });
  });

  it('renders author names for first occurrence of each commit', async () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('renders short commit hashes', async () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('def5678')).toBeInTheDocument();
    });
  });

  it('renders line numbers', async () => {
    render(<GitBlameView repoPath="/test" onGetBlame={mockOnGetBlame} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('handles repoPath=null', () => {
    render(<GitBlameView repoPath={null} onGetBlame={mockOnGetBlame} />);
    expect(screen.getByText('git.blame.title')).toBeInTheDocument();
  });
});
