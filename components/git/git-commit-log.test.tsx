import { render, screen, fireEvent } from '@testing-library/react';
import { GitCommitLog } from './git-commit-log';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/utils/git-date', () => ({
  formatRelativeDate: (d: string) => d,
}));

describe('GitCommitLog', () => {
  const commits = [
    {
      hash: 'abc1234567890def',
      parents: [],
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      date: new Date().toISOString(),
      message: 'Initial commit',
    },
    {
      hash: 'def5678901234abc',
      parents: ['abc1234567890def'],
      authorName: 'Jane Smith',
      authorEmail: 'jane@example.com',
      date: new Date(Date.now() - 86400000).toISOString(),
      message: 'Add feature',
    },
    {
      hash: 'ghi9012345678bcd',
      parents: ['def5678901234abc'],
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      date: new Date(Date.now() - 172800000).toISOString(),
      message: 'Fix bug in parser',
    },
  ];

  it('renders commit entries', () => {
    render(<GitCommitLog commits={commits} />);
    expect(screen.getByText('Initial commit')).toBeInTheDocument();
    expect(screen.getByText('Add feature')).toBeInTheDocument();
    expect(screen.getByText('Fix bug in parser')).toBeInTheDocument();
  });

  it('renders short hashes', () => {
    render(<GitCommitLog commits={commits} />);
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('def5678')).toBeInTheDocument();
  });

  it('shows empty state when no commits', () => {
    render(<GitCommitLog commits={[]} />);
    expect(screen.getByText('git.history.noCommits')).toBeInTheDocument();
  });

  it('filters by search term', () => {
    render(<GitCommitLog commits={commits} />);
    const searchInput = screen.getByPlaceholderText('git.history.search');
    fireEvent.change(searchInput, { target: { value: 'bug' } });
    expect(screen.getByText('Fix bug in parser')).toBeInTheDocument();
    expect(screen.queryByText('Initial commit')).not.toBeInTheDocument();
  });

  it('shows commit count badge', () => {
    render(<GitCommitLog commits={commits} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('filters by hash prefix', () => {
    render(<GitCommitLog commits={commits} />);
    const searchInput = screen.getByPlaceholderText('git.history.search');
    fireEvent.change(searchInput, { target: { value: 'ghi' } });
    expect(screen.getByText('Fix bug in parser')).toBeInTheDocument();
    expect(screen.queryByText('Initial commit')).not.toBeInTheDocument();
  });

  it('filters by author name', () => {
    render(<GitCommitLog commits={commits} />);
    const searchInput = screen.getByPlaceholderText('git.history.search');
    fireEvent.change(searchInput, { target: { value: 'jane' } });
    expect(screen.getByText('Add feature')).toBeInTheDocument();
    expect(screen.queryByText('Initial commit')).not.toBeInTheDocument();
  });

  it('calls onSelectCommit when a commit is clicked', () => {
    const mockOnSelect = jest.fn();
    render(<GitCommitLog commits={commits} onSelectCommit={mockOnSelect} />);
    fireEvent.click(screen.getByText('Initial commit'));
    expect(mockOnSelect).toHaveBeenCalledWith('abc1234567890def');
  });

  it('highlights selected commit', () => {
    const { container } = render(
      <GitCommitLog commits={commits} selectedHash="abc1234567890def" />,
    );
    const selectedRow = container.querySelector('.bg-muted');
    expect(selectedRow).toBeInTheDocument();
  });

  it('shows load more button when ≥50 commits and onLoadMore provided', () => {
    const manyCommits = Array.from({ length: 50 }, (_, i) => ({
      hash: `hash${i}`.padEnd(16, '0'),
      parents: [],
      authorName: 'Dev',
      authorEmail: 'd@e.com',
      date: new Date().toISOString(),
      message: `Commit ${i}`,
    }));
    const mockLoadMore = jest.fn();
    render(<GitCommitLog commits={manyCommits} onLoadMore={mockLoadMore} />);
    expect(screen.getByText('git.history.loadMore')).toBeInTheDocument();
  });

  it('calls onLoadMore with correct limit', () => {
    const manyCommits = Array.from({ length: 50 }, (_, i) => ({
      hash: `hash${i}`.padEnd(16, '0'),
      parents: [],
      authorName: 'Dev',
      authorEmail: 'd@e.com',
      date: new Date().toISOString(),
      message: `Commit ${i}`,
    }));
    const mockLoadMore = jest.fn();
    render(<GitCommitLog commits={manyCommits} onLoadMore={mockLoadMore} />);
    fireEvent.click(screen.getByText('git.history.loadMore'));
    expect(mockLoadMore).toHaveBeenCalledWith({ limit: 100 });
  });

  it('updates badge count when search filters results', () => {
    render(<GitCommitLog commits={commits} />);
    const searchInput = screen.getByPlaceholderText('git.history.search');
    fireEvent.change(searchInput, { target: { value: 'bug' } });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders history title', () => {
    render(<GitCommitLog commits={commits} />);
    expect(screen.getByText('git.history.title')).toBeInTheDocument();
  });
});
