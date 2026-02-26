import { render, screen } from '@testing-library/react';
import { GitStashList } from './git-stash-list';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitStashList', () => {
  const stashes = [
    { id: 'stash@{0}', message: 'WIP on main: add feature', date: '2025-01-15T10:30:00+08:00' },
    { id: 'stash@{1}', message: 'temp save', date: '2025-01-14T09:00:00+08:00' },
  ];

  it('renders stash title', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('git.repo.stash')).toBeInTheDocument();
  });

  it('renders stash count badge', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders stash entries', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('stash@{0}')).toBeInTheDocument();
    expect(screen.getByText('WIP on main: add feature')).toBeInTheDocument();
    expect(screen.getByText('stash@{1}')).toBeInTheDocument();
    expect(screen.getByText('temp save')).toBeInTheDocument();
  });

  it('renders dates', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('2025-01-14')).toBeInTheDocument();
  });

  it('shows empty state when no stashes', () => {
    render(<GitStashList stashes={[]} />);
    expect(screen.getByText('git.repo.noStashes')).toBeInTheDocument();
  });

  it('shows zero count badge when empty', () => {
    render(<GitStashList stashes={[]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
