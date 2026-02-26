import { render, screen, waitFor } from '@testing-library/react';
import { GitCommitGraph } from './git-commit-graph';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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
});
