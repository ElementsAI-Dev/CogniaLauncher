import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitCommitGraph } from './git-commit-graph';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/utils/git-date', () => ({
  formatRelativeDate: (d: string) => d,
}));

// ResizeObserver mock for virtualization
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

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

  it('calls onLoadGraph on mount with default params', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledWith(100, true, false, undefined);
    });
  });

  it('reloads graph data when refreshKey changes', async () => {
    const { rerender } = render(
      <GitCommitGraph onLoadGraph={mockOnLoadGraph} refreshKey={0} />,
    );
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledTimes(2);
    });

    rerender(<GitCommitGraph onLoadGraph={mockOnLoadGraph} refreshKey={1} />);
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledTimes(3);
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

  it('shows error state (not empty) and retries', async () => {
    mockOnLoadGraph
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(mockEntries);

    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);

    await waitFor(() => {
      expect(screen.getByText(/boom/)).toBeInTheDocument();
    });
    expect(screen.queryByText('git.graph.empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
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
      expect(mockOnLoadGraph).toHaveBeenCalledWith(200, true, false, undefined);
    });
  });

  it('resets pagination window when first-parent filter changes', async () => {
    const user = userEvent.setup();
    const manyEntries = Array.from({ length: 100 }, (_, i) => ({
      hash: `h${String(i).padStart(6, '0')}`,
      parents: i > 0 ? [`h${String(i - 1).padStart(6, '0')}`] : [],
      refs: [],
      authorName: 'Dev',
      date: new Date().toISOString(),
      message: `Commit ${i}`,
    }));

    mockOnLoadGraph.mockResolvedValue(manyEntries);
    const branches = [
      { name: 'main', shortHash: 'abc1234', upstream: null, isCurrent: true, isRemote: false },
    ];

    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} branches={branches} />);

    await waitFor(() => {
      expect(screen.getByText('git.graph.loadMore')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('git.graph.loadMore'));
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledWith(200, true, false, undefined);
    });

    await user.click(screen.getByText('git.graph.firstParent'));
    await waitFor(() => {
      expect(mockOnLoadGraph).toHaveBeenCalledWith(100, true, true, undefined);
    });
  });

  it('renders merge commit icon for multi-parent entries', async () => {
    const mergeEntries = [
      { hash: 'merge1', parents: ['abc', 'def'], refs: [], authorName: 'Dev', date: new Date().toISOString(), message: 'Merge branch' },
      { hash: 'abc', parents: [], refs: [], authorName: 'Dev', date: new Date().toISOString(), message: 'Parent 1' },
    ];
    mockOnLoadGraph.mockResolvedValueOnce(mergeEntries);
    const { container } = render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('Merge branch')).toBeInTheDocument();
    });
    // Merge commit should render a diamond (polygon) in SVG
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders first-parent toggle', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('git.graph.firstParent')).toBeInTheDocument();
    });
  });

  it('shows +N badge when refs exceed limit', async () => {
    const manyRefsEntries = [
      {
        hash: 'abc1234',
        parents: [],
        refs: ['HEAD -> main', 'origin/main', 'tag: v1.0', 'tag: v1.1', 'tag: v1.2'],
        authorName: 'Dev',
        date: new Date().toISOString(),
        message: 'Multi-ref commit',
      },
    ];
    mockOnLoadGraph.mockResolvedValueOnce(manyRefsEntries);
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  it('has accessible listbox role', async () => {
    render(<GitCommitGraph onLoadGraph={mockOnLoadGraph} />);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('invokes onResetTo from context menu', async () => {
    const user = userEvent.setup();
    const onResetTo = jest.fn();
    const { container } = render(
      <GitCommitGraph
        onLoadGraph={mockOnLoadGraph}
        onResetTo={onResetTo}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
    });

    const firstRow = container.querySelector('[data-hash="abc1234"]');
    const trigger = firstRow?.querySelector('button');
    expect(trigger).toBeTruthy();
    await user.click(trigger!);

    const resetItem = await screen.findByRole('menuitem', { name: 'git.resetAction.title' });
    await user.click(resetItem);
    expect(onResetTo).toHaveBeenCalledWith('abc1234');
  });
});
