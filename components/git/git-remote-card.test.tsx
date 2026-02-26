import { render, screen } from '@testing-library/react';
import { GitRemoteCard } from './git-remote-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitRemoteCard', () => {
  const remotes = [
    { name: 'origin', fetchUrl: 'https://github.com/user/repo.git', pushUrl: 'https://github.com/user/repo.git' },
    { name: 'upstream', fetchUrl: 'https://github.com/upstream/repo.git', pushUrl: 'git@github.com:upstream/repo.git' },
  ];

  it('renders remote title', () => {
    render(<GitRemoteCard remotes={remotes} />);
    expect(screen.getByText('git.repo.remote')).toBeInTheDocument();
  });

  it('renders remote count badge', () => {
    render(<GitRemoteCard remotes={remotes} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders remote names', () => {
    render(<GitRemoteCard remotes={remotes} />);
    expect(screen.getByText('origin')).toBeInTheDocument();
    expect(screen.getByText('upstream')).toBeInTheDocument();
  });

  it('renders fetch URLs', () => {
    render(<GitRemoteCard remotes={remotes} />);
    expect(screen.getByText('https://github.com/user/repo.git')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/upstream/repo.git')).toBeInTheDocument();
  });

  it('shows push URL only when different from fetch URL', () => {
    render(<GitRemoteCard remotes={remotes} />);
    // upstream has different push URL
    expect(screen.getByText('git@github.com:upstream/repo.git')).toBeInTheDocument();
  });

  it('shows empty state when no remotes', () => {
    render(<GitRemoteCard remotes={[]} />);
    expect(screen.getByText('No remotes configured')).toBeInTheDocument();
  });
});
