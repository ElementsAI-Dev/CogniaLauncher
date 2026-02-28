import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitRemoteCard } from './git-remote-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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
    expect(screen.getByText('git@github.com:upstream/repo.git')).toBeInTheDocument();
  });

  it('shows empty state when no remotes', () => {
    render(<GitRemoteCard remotes={[]} />);
    expect(screen.getByText('No remotes configured')).toBeInTheDocument();
  });

  it('hides push URL when push URL matches fetch URL', () => {
    const sameUrlRemotes = [
      { name: 'origin', fetchUrl: 'https://github.com/user/repo.git', pushUrl: 'https://github.com/user/repo.git' },
    ];
    render(<GitRemoteCard remotes={sameUrlRemotes} />);
    expect(screen.queryByText(/git\.repo\.pushUrl/)).not.toBeInTheDocument();
  });

  it('renders fetch URL labels for each remote', () => {
    render(<GitRemoteCard remotes={remotes} />);
    const fetchLabels = screen.getAllByText(/git\.repo\.fetchUrl/);
    expect(fetchLabels.length).toBe(2);
  });

  it('renders add remote inputs when onAdd provided', () => {
    const onAdd = jest.fn().mockResolvedValue('added');
    render(<GitRemoteCard remotes={remotes} onAdd={onAdd} />);
    expect(screen.getByPlaceholderText('git.remoteAction.namePlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('git.remoteAction.urlPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('git.remoteAction.add')).toBeInTheDocument();
  });

  it('does not render add inputs when onAdd not provided', () => {
    render(<GitRemoteCard remotes={remotes} />);
    expect(screen.queryByPlaceholderText('git.remoteAction.namePlaceholder')).not.toBeInTheDocument();
  });

  it('disables add button when inputs are empty', () => {
    const onAdd = jest.fn().mockResolvedValue('added');
    render(<GitRemoteCard remotes={remotes} onAdd={onAdd} />);
    expect(screen.getByText('git.remoteAction.add').closest('button')).toBeDisabled();
  });

  it('calls onAdd with name and url', async () => {
    const onAdd = jest.fn().mockResolvedValue('added');
    render(<GitRemoteCard remotes={remotes} onAdd={onAdd} />);
    fireEvent.change(screen.getByPlaceholderText('git.remoteAction.namePlaceholder'), { target: { value: 'fork' } });
    fireEvent.change(screen.getByPlaceholderText('git.remoteAction.urlPlaceholder'), { target: { value: 'https://example.com/repo.git' } });
    fireEvent.click(screen.getByText('git.remoteAction.add'));
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('fork', 'https://example.com/repo.git');
    });
  });

  it('clears inputs after successful add', async () => {
    const onAdd = jest.fn().mockResolvedValue('added');
    render(<GitRemoteCard remotes={remotes} onAdd={onAdd} />);
    const nameInput = screen.getByPlaceholderText('git.remoteAction.namePlaceholder');
    const urlInput = screen.getByPlaceholderText('git.remoteAction.urlPlaceholder');
    fireEvent.change(nameInput, { target: { value: 'fork' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com/repo.git' } });
    fireEvent.click(screen.getByText('git.remoteAction.add'));
    await waitFor(() => {
      expect(nameInput).toHaveValue('');
      expect(urlInput).toHaveValue('');
    });
  });
});
