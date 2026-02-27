import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitVisualFileHistory } from './git-visual-file-history';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

describe('GitVisualFileHistory', () => {
  const statsData = [
    { hash: 'abc1234567890', date: '2025-01-15T10:00:00Z', additions: 10, deletions: 3, authorName: 'John' },
    { hash: 'def5678901234', date: '2025-01-14T09:00:00Z', additions: 5, deletions: 8, authorName: 'Jane' },
  ];
  const mockOnGetFileStats = jest.fn().mockResolvedValue(statsData);

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnGetFileStats.mockResolvedValue(statsData);
  });

  it('renders visual history title', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByText('git.visualHistory.title')).toBeInTheDocument();
  });

  it('renders file input', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByPlaceholderText('git.history.selectFile')).toBeInTheDocument();
  });

  it('renders browse button', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByText('git.history.browseFile')).toBeInTheDocument();
  });

  it('shows select file message when no file selected', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getAllByText('git.history.selectFile').length).toBeGreaterThanOrEqual(1);
  });

  it('loads stats on Enter key', async () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'src/main.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockOnGetFileStats).toHaveBeenCalledWith('src/main.ts', 50);
    });
  });

  it('does not load for empty input', () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnGetFileStats).not.toHaveBeenCalled();
  });

  it('renders chart after loading data', async () => {
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'file.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });

  it('shows noFileHistory when file set but no results', async () => {
    mockOnGetFileStats.mockResolvedValueOnce([]);
    render(<GitVisualFileHistory repoPath="/repo" onGetFileStats={mockOnGetFileStats} />);
    const input = screen.getByPlaceholderText('git.history.selectFile');
    fireEvent.change(input, { target: { value: 'none.ts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('git.history.noFileHistory')).toBeInTheDocument();
    });
  });

  it('handles repoPath=null', () => {
    render(<GitVisualFileHistory repoPath={null} onGetFileStats={mockOnGetFileStats} />);
    expect(screen.getByText('git.visualHistory.title')).toBeInTheDocument();
  });
});
