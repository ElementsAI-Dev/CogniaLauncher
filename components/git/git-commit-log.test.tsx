import { render, screen, fireEvent } from '@testing-library/react';
import { GitCommitLog } from './git-commit-log';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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
});
