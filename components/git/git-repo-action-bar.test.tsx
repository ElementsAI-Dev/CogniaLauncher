import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitRepoActionBar } from './git-repo-action-bar';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitRepoActionBar', () => {
  const baseProps = {
    repoPath: '/test/repo',
    currentBranch: 'main',
    loading: false,
    remotes: [
      { name: 'origin', fetchUrl: 'https://example.com/repo.git', pushUrl: 'https://example.com/repo.git' },
    ],
  };

  it('renders core action buttons', () => {
    render(
      <GitRepoActionBar
        {...baseProps}
        onPush={jest.fn().mockResolvedValue('ok')}
        onPull={jest.fn().mockResolvedValue('ok')}
        onFetch={jest.fn().mockResolvedValue('ok')}
        onClean={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByText('git.actions.push')).toBeInTheDocument();
    expect(screen.getByText('git.actions.pull')).toBeInTheDocument();
    expect(screen.getByText('git.actions.fetch')).toBeInTheDocument();
    expect(screen.getByText('git.actions.clean')).toBeInTheDocument();
  });

  it('disables actions when repoPath is null', () => {
    render(<GitRepoActionBar repoPath={null} onPush={jest.fn().mockResolvedValue('ok')} />);
    expect(screen.getByText('git.actions.push').closest('button')).toBeDisabled();
  });

  it('passes push options through', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onPush = jest.fn().mockResolvedValue('pushed');
    render(<GitRepoActionBar {...baseProps} onPush={onPush} />);

    fireEvent.change(screen.getByPlaceholderText('remote'), { target: { value: 'upstream' } });
    fireEvent.change(screen.getByPlaceholderText('branch'), { target: { value: 'release/1.0' } });
    fireEvent.click(screen.getByLabelText('push --force'));
    fireEvent.click(screen.getByLabelText('git.pushAction.forceLease'));
    fireEvent.click(screen.getByLabelText('push --set-upstream'));
    fireEvent.click(screen.getByText('git.actions.push'));

    await waitFor(() => {
      expect(onPush).toHaveBeenCalledWith(
        'upstream',
        'release/1.0',
        true,
        true,
        true,
        true,
      );
    });
    confirmSpy.mockRestore();
  });

  it('passes pull options through', async () => {
    const onPull = jest.fn().mockResolvedValue('pulled');
    render(<GitRepoActionBar {...baseProps} onPull={onPull} />);

    fireEvent.change(screen.getByPlaceholderText('remote'), { target: { value: 'origin' } });
    fireEvent.change(screen.getByPlaceholderText('branch'), { target: { value: 'main' } });
    fireEvent.click(screen.getByLabelText('git.pullAction.rebase'));
    fireEvent.click(screen.getByLabelText('pull --autostash'));
    fireEvent.click(screen.getByText('git.actions.pull'));

    await waitFor(() => {
      expect(onPull).toHaveBeenCalledWith('origin', 'main', true, true);
    });
  });

  it('passes fetch options through', async () => {
    const onFetch = jest.fn().mockResolvedValue('fetched');
    render(<GitRepoActionBar {...baseProps} onFetch={onFetch} />);

    fireEvent.click(screen.getByLabelText('fetch --prune'));
    fireEvent.click(screen.getByLabelText('fetch --all'));
    fireEvent.click(screen.getByText('git.actions.fetch'));

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith(undefined, true, true);
    });
  });

  it('passes clean directories flag through', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onClean = jest.fn().mockResolvedValue('cleaned');
    const onCleanPreview = jest.fn().mockResolvedValue(['tmp/file.tmp']);
    render(
      <GitRepoActionBar
        {...baseProps}
        onClean={onClean}
        onCleanPreview={onCleanPreview}
      />,
    );

    fireEvent.click(screen.getByLabelText('clean -d'));
    fireEvent.click(screen.getByText('git.actions.clean'));

    await waitFor(() => {
      expect(onCleanPreview).toHaveBeenCalledWith(true);
      expect(onClean).toHaveBeenCalledWith(true, true);
    });
    confirmSpy.mockRestore();
  });

  it('syncs remote and branch inputs when repository context changes', async () => {
    const { rerender } = render(<GitRepoActionBar {...baseProps} onPush={jest.fn().mockResolvedValue('ok')} />);

    const remoteInput = screen.getByPlaceholderText('remote') as HTMLInputElement;
    const branchInput = screen.getByPlaceholderText('branch') as HTMLInputElement;

    expect(remoteInput.value).toBe('origin');
    expect(branchInput.value).toBe('main');

    rerender(
      <GitRepoActionBar
        repoPath="/another/repo"
        currentBranch="develop"
        loading={false}
        remotes={[{ name: 'upstream', fetchUrl: 'https://example.com/upstream.git', pushUrl: 'https://example.com/upstream.git' }]}
        onPush={jest.fn().mockResolvedValue('ok')}
      />,
    );

    await waitFor(() => {
      expect((screen.getByPlaceholderText('remote') as HTMLInputElement).value).toBe('upstream');
      expect((screen.getByPlaceholderText('branch') as HTMLInputElement).value).toBe('develop');
    });
  });

  it('shows toast error when action fails', async () => {
    const { toast } = jest.requireMock('sonner');
    const onPush = jest.fn().mockRejectedValue(new Error('push failed'));
    render(<GitRepoActionBar {...baseProps} onPush={onPush} />);

    fireEvent.click(screen.getByText('git.actions.push'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
