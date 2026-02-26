import { render, screen } from '@testing-library/react';
import { GitRepoInfoCard } from './git-repo-info-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitRepoInfoCard', () => {
  const cleanRepo = {
    rootPath: '/home/user/my-project',
    currentBranch: 'main',
    isDirty: false,
    fileCountStaged: 0,
    fileCountModified: 0,
    fileCountUntracked: 0,
  };

  const dirtyRepo = {
    rootPath: 'C:\\Users\\dev\\project',
    currentBranch: 'feature/test',
    isDirty: true,
    fileCountStaged: 2,
    fileCountModified: 3,
    fileCountUntracked: 1,
  };

  it('renders repo folder name from path', () => {
    render(<GitRepoInfoCard repoInfo={cleanRepo} />);
    expect(screen.getByText('my-project')).toBeInTheDocument();
  });

  it('renders repo folder name from Windows path', () => {
    render(<GitRepoInfoCard repoInfo={dirtyRepo} />);
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('renders current branch', () => {
    render(<GitRepoInfoCard repoInfo={cleanRepo} />);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('shows clean badge when not dirty', () => {
    render(<GitRepoInfoCard repoInfo={cleanRepo} />);
    expect(screen.getByText('git.repo.clean')).toBeInTheDocument();
    expect(screen.queryByText('git.repo.dirty')).not.toBeInTheDocument();
  });

  it('shows dirty badge when dirty', () => {
    render(<GitRepoInfoCard repoInfo={dirtyRepo} />);
    expect(screen.getByText('git.repo.dirty')).toBeInTheDocument();
    expect(screen.queryByText('git.repo.clean')).not.toBeInTheDocument();
  });

  it('shows staged count when > 0', () => {
    render(<GitRepoInfoCard repoInfo={dirtyRepo} />);
    expect(screen.getByText(/git\.repo\.staged.*2/)).toBeInTheDocument();
  });

  it('shows modified count when > 0', () => {
    render(<GitRepoInfoCard repoInfo={dirtyRepo} />);
    expect(screen.getByText(/git\.repo\.modified.*3/)).toBeInTheDocument();
  });

  it('shows untracked count when > 0', () => {
    render(<GitRepoInfoCard repoInfo={dirtyRepo} />);
    expect(screen.getByText(/git\.repo\.untracked.*1/)).toBeInTheDocument();
  });

  it('hides file counts when all are 0', () => {
    render(<GitRepoInfoCard repoInfo={cleanRepo} />);
    expect(screen.queryByText(/git\.repo\.staged/)).not.toBeInTheDocument();
    expect(screen.queryByText(/git\.repo\.modified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/git\.repo\.untracked/)).not.toBeInTheDocument();
  });
});
