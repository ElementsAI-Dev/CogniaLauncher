import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitCommitGraph } from './git-commit-graph';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/utils/git-date', () => ({
  formatRelativeDate: (d: string) => d,
}));

describe('GitCommitGraph', () => {
  const mockEntries = [
    { hash: 'abc1234', parents: [], refs: ['HEAD -> main'], authorName: 'John', date: new Date().toISOString(), message: 'Initial commit' },
    { hash: 'def5678', parents: ['abc1234'], refs: ['tag: v1.0'], authorName: 'Jane', date: new Date(Date.now() - 86400000).toISOString(), message: 'Add feature' },
  ];
  const mockOnLoadGraph = jest.fn().mockResolvedValue(mockEntries);
  const mockOnSelectCommit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnLoadGraph.mockResolvedValue(mockEntries);
  });

  it('renders graph title', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('git.graph.title')).toBeInTheDocument();
    });
  });

  it('calls onLoadGraph on mount', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledWith(100, true);
    });
  });

  it('renders commit messages after loading', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} onSelectCommit={mockOnSelectCommit} />);
    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
      expect(screen.getByText('Add feature')).toBeInTheDocument();
    });
  });

  it('renders short hashes', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('def5678')).toBeInTheDocument();
    });
  });

  it('renders ref badges', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('v1.0')).toBeInTheDocument();
    });
  });

  it('renders entry count badge', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries', async () => {
    mockOnLoadGraph.mockResolvedValueOnce([]);
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('git.graph.empty')).toBeInTheDocument();
    });
  });

  it('calls onSelectCommit when commit row is clicked', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} onSelectCommit={mockOnSelectCommit} />);
    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Initial commit'));
    expect(mockOnSelectCommit).toHaveBeenCalledWith('abc1234');
  });

  it('highlights selected commit row', async () => {
    const { container } = render(
      <GitCommitGraph onLoadGraph={mockOnLoadGraph} selectedHash="abc1234" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
    });
    const selectedRow = container.querySelector('.bg-muted');
    expect(selectedRow).toBeInTheDocument();
  });

  it('renders author names', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });
  });

  it('shows load more button when entries >= limit', async () => {
    const manyEntries = Array.from({ length: 100 }, (_, i) => ({
      hash: `h${String(i).padStart(6, '0')}`,
      parents: i > 0 ? [`h${String(i - 1).padStart(6, '0')}`] : [],
      refs: [],
      authorName: 'Dev',
      date: new Date().toISOString(),
      message: `Commit ${i}`,
    }));
    mockOnLoadGraph.mockResolvedValueOnce(manyEntries);
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('git.graph.loadMore')).toBeInTheDocument();
    });
  });

  it('calls onLoadGraph with increased limit when load more clicked', async () => {
    const manyEntries = Array.from({ length: 100 }, (_, i) => ({
      hash: `h${String(i).padStart(6, '0')}`,
      parents: i > 0 ? [`h${String(i - 1).padStart(6, '0')}`] : [],
      refs: [],
      authorName: 'Dev',
      date: new Date().toISOString(),
      message: `Commit ${i}`,
    }));
    mockOnLoadGraph.mockResolvedValue(manyEntries);
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('git.graph.loadMore')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('git.graph.loadMore'));
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledWith(200, true);
    });
  });
});
