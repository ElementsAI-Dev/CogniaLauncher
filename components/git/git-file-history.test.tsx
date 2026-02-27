import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitFileHistory } from './git-file-history';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('@/lib/utils/git-date', () => ({
  formatRelativeDate: (d: string) => d,
}));

describe('GitFileHistory', () => {
  const commits = [
    { hash: 'abc1234567890', parents: [], authorName: 'John', authorEmail: 'j@e.com', date: '2025-01-15', message: 'fix bug' },
    { hash: 'def5678901234', parents: [], authorName: 'Jane', authorEmail: 'ja@e.com', date: '2025-01-14', message: 'add feature' },
  ];
  const mockOnGetHistory = jest.fn().mockResolvedValue(commits);

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnGetHistory.mockResolvedValue(commits);
  });

  it('renders file history title', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByText('git.history.fileHistory')).toBeInTheDocument();
  });

  it('renders file input', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByPlaceholderText('git.history.selectFile')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getByText('git.history.browseFile')).toBeInTheDocument();
  });

  it('shows select file message when no file selected', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    expect(screen.getAllByText('git.history.selectFile').length).toBeGreaterThanOrEqual(1);
  });

  it('loads history on Enter key', async () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'src/main.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockOnGetHistory).toHaveBeenCalledWith('src/main.ts', 50);
    });
  });

  it('does not load for empty input', () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnGetHistory).not.toHaveBeenCalled();
  });

  it('renders commits after loading', async () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('fix bug')).toBeInTheDocument();
      expect(screen.getByText('add feature')).toBeInTheDocument();
    });
  });

  it('renders short hashes after loading', async () => {
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('def5678')).toBeInTheDocument();
    });
  });

  it('shows noFileHistory when file set but no results', async () => {
    mockOnGetHistory.mockResolvedValueOnce([]);
    render(<GitFileHistory repoPath="/repo" onGetHistory={mockOnGetHistory} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'nonexistent.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('git.history.noFileHistory')).toBeInTheDocument();
    });
  });

  it('handles repoPath=null', () => {
    render(<GitFileHistory repoPath={null} onGetHistory={mockOnGetHistory} />);
    expect(screen.getByText('git.history.fileHistory')).toBeInTheDocument();
  });
});
