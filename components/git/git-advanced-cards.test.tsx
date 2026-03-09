import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitSubmodulesCard } from './git-submodules-card';
import { GitWorktreesCard } from './git-worktrees-card';
import { GitGitignoreCard } from './git-gitignore-card';
import { GitHooksCard } from './git-hooks-card';
import { GitLfsCard } from './git-lfs-card';
import { GitLocalConfigCard } from './git-local-config-card';
import { GitRepoStatsCard } from './git-repo-stats-card';
import { GitSparseCheckoutCard } from './git-sparse-checkout-card';
import { GitRemotePruneCard } from './git-remote-prune-card';
import { GitSignatureVerifyCard } from './git-signature-verify-card';
import { GitRebaseSquashCard } from './git-rebase-squash-card';
import { GitInteractiveRebaseCard } from './git-interactive-rebase-card';
import { GitBisectCard } from './git-bisect-card';
import { GitArchiveCard } from './git-archive-card';
import { GitPatchCard } from './git-patch-card';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string, params?: Record<string, string>) => key.replace('{count}', params?.count ?? '') }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('Git New Cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders submodules empty state and supports add', async () => {
    const onAdd = jest.fn().mockResolvedValue('ok');
    render(
      <GitSubmodulesCard
        submodules={[]}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onAdd={onAdd}
        onUpdate={jest.fn().mockResolvedValue('ok')}
        onRemove={jest.fn().mockResolvedValue('ok')}
        onSync={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByText('git.submodules.noSubmodules')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('git.submodules.urlPlaceholder'), { target: { value: 'https://example.com/a.git' } });
    fireEvent.change(screen.getByPlaceholderText('git.submodules.pathPlaceholder'), { target: { value: 'vendor/a' } });
    fireEvent.click(screen.getByText('git.submodules.add'));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('https://example.com/a.git', 'vendor/a'));
  });

  it('renders worktrees and supports add/remove', async () => {
    const onRemove = jest.fn().mockResolvedValue('ok');
    render(
      <GitWorktreesCard
        worktrees={[{ path: '/tmp/wt', head: 'abc123', branch: 'main', isBare: false, isDetached: false }]}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onAdd={jest.fn().mockResolvedValue('ok')}
        onRemove={onRemove}
        onPrune={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByText('/tmp/wt')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('git.worktrees.remove'));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('/tmp/wt', false));
  });

  it('renders gitignore card and supports save/check', async () => {
    const onSetGitignore = jest.fn().mockResolvedValue(undefined);
    const onCheckIgnore = jest.fn().mockResolvedValue(['node_modules/a']);
    render(
      <GitGitignoreCard
        onGetGitignore={jest.fn().mockResolvedValue('node_modules/')}
        onSetGitignore={onSetGitignore}
        onCheckIgnore={onCheckIgnore}
        onAddToGitignore={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue('node_modules/')).toBeInTheDocument());
    fireEvent.click(screen.getByText('git.gitignore.save'));
    await waitFor(() => expect(onSetGitignore).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('git.gitignore.checkPlaceholder'), { target: { value: 'node_modules/a' } });
    fireEvent.click(screen.getByText('git.gitignore.checkFile'));
    await waitFor(() => expect(onCheckIgnore).toHaveBeenCalled());
  });

  it('renders hooks card and supports toggle/save', async () => {
    const onToggle = jest.fn().mockResolvedValue(undefined);
    const onSetContent = jest.fn().mockResolvedValue(undefined);
    render(
      <GitHooksCard
        hooks={[{ name: 'pre-commit', enabled: true, hasContent: true, fileName: 'pre-commit' }]}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onGetContent={jest.fn().mockResolvedValue('#!/bin/sh')}
        onSetContent={onSetContent}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByText('pre-commit'));
    await waitFor(() => expect(screen.getByDisplayValue('#!/bin/sh')).toBeInTheDocument());
    fireEvent.click(screen.getByText('git.hooks.save'));
    await waitFor(() => expect(onSetContent).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(onToggle).toHaveBeenCalled());
  });

  it('renders lfs card and supports track', async () => {
    const user = userEvent.setup();
    const onTrack = jest.fn().mockResolvedValue('ok');
    render(
      <GitLfsCard
        lfsAvailable={true}
        lfsVersion="3.4.0"
        trackedPatterns={[]}
        lfsFiles={[]}
        onCheckAvailability={jest.fn().mockResolvedValue(undefined)}
        onRefreshTrackedPatterns={jest.fn().mockResolvedValue(undefined)}
        onRefreshLfsFiles={jest.fn().mockResolvedValue(undefined)}
        onTrack={onTrack}
        onUntrack={jest.fn().mockResolvedValue('ok')}
        onInstall={jest.fn().mockResolvedValue('ok')}
      />,
    );

    const patternInput = screen.getByPlaceholderText('git.lfs.trackPlaceholder');
    await waitFor(() => {
      expect(patternInput).not.toBeDisabled();
    });
    fireEvent.change(patternInput, { target: { value: '*.psd' } });
    await user.click(screen.getByRole('button', { name: 'git.lfs.track' }));
    await waitFor(() => expect(onTrack).toHaveBeenCalledWith('*.psd'));
  });

  it('renders local config card and supports set/remove', async () => {
    const onSet = jest.fn().mockResolvedValue(undefined);
    const onRemove = jest.fn().mockResolvedValue(undefined);
    render(
      <GitLocalConfigCard
        config={[{ key: 'core.editor', value: 'vim' }]}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSet={onSet}
        onRemove={onRemove}
        onGetValue={jest.fn().mockResolvedValue(null)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.config.keyPlaceholder'), { target: { value: 'user.name' } });
    fireEvent.change(screen.getByPlaceholderText('git.config.valuePlaceholder'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByText('git.config.add'));
    await waitFor(() => expect(onSet).toHaveBeenCalledWith('user.name', 'Alice'));
    fireEvent.click(screen.getByTitle('git.config.remove'));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('core.editor'));
  });

  it('renders repo stats card and supports fsck', async () => {
    const onFsck = jest.fn().mockResolvedValue([]);
    render(
      <GitRepoStatsCard
        repoStats={{ sizeOnDisk: '1MB', objectCount: 1, packCount: 1, looseObjects: 0, commitCount: 10, isShallow: false }}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onFsck={onFsck}
        onDescribe={jest.fn().mockResolvedValue('v1.0.0')}
        onIsShallow={jest.fn().mockResolvedValue(false)}
        onDeepen={jest.fn().mockResolvedValue('ok')}
        onUnshallow={jest.fn().mockResolvedValue('ok')}
      />,
    );

    fireEvent.click(screen.getByText('git.repoStats.fsck'));
    await waitFor(() => expect(onFsck).toHaveBeenCalled());
  });

  it('renders sparse checkout card and supports add', async () => {
    const onAdd = jest.fn().mockResolvedValue('ok');
    render(
      <GitSparseCheckoutCard
        isSparseCheckout={false}
        sparsePatterns={[]}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onInit={jest.fn().mockResolvedValue('ok')}
        onSet={jest.fn().mockResolvedValue('ok')}
        onAdd={onAdd}
        onDisable={jest.fn().mockResolvedValue('ok')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.sparseCheckout.patternPlaceholder'), { target: { value: 'src/' } });
    fireEvent.click(screen.getByText('git.sparseCheckout.addPattern'));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(['src/']));
  });

  it('renders remote prune card and supports prune', async () => {
    const user = userEvent.setup();
    const onPrune = jest.fn().mockResolvedValue('ok');
    render(
      <GitRemotePruneCard
        remotes={[{ name: 'origin', fetchUrl: 'a', pushUrl: 'a' }]}
        onPrune={onPrune}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'git.remotePrune.title' }));
    await waitFor(() => expect(onPrune).toHaveBeenCalledWith('origin'));
  });

  it('syncs remote prune input when remotes change', async () => {
    const { rerender } = render(
      <GitRemotePruneCard
        remotes={[{ name: 'origin', fetchUrl: 'a', pushUrl: 'a' }]}
        onPrune={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByPlaceholderText('origin')).toHaveValue('origin');

    rerender(
      <GitRemotePruneCard
        remotes={[{ name: 'upstream', fetchUrl: 'b', pushUrl: 'b' }]}
        onPrune={jest.fn().mockResolvedValue('ok')}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('origin')).toHaveValue('upstream');
    });
  });

  it('renders signature verify card and supports verify', async () => {
    const onVerifyCommit = jest.fn().mockResolvedValue('good signature');
    render(
      <GitSignatureVerifyCard
        onVerifyCommit={onVerifyCommit}
        onVerifyTag={jest.fn().mockResolvedValue('good tag')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('commit hash'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByText('git.signature.verifyCommit'));
    await waitFor(() => expect(onVerifyCommit).toHaveBeenCalledWith('abc123'));
  });

  it('renders quick rebase/squash card and supports actions', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const onRebase = jest.fn().mockResolvedValue('ok');
    const onSquash = jest.fn().mockResolvedValue('ok');
    render(
      <GitRebaseSquashCard
        onRebase={onRebase}
        onSquash={onSquash}
      />,
    );

    try {
      fireEvent.change(screen.getByPlaceholderText('git.interactiveRebase.basePlaceholder'), { target: { value: 'main' } });
      await user.click(screen.getByRole('button', { name: 'git.quickOps.rebase' }));
      await waitFor(() => expect(onRebase).toHaveBeenCalledWith('main', true));

      fireEvent.change(screen.getByPlaceholderText('git.quickOps.countPlaceholder'), { target: { value: '3' } });
      fireEvent.change(screen.getByPlaceholderText('git.commit.messagePlaceholder'), { target: { value: 'combine commits' } });
      await user.click(screen.getByRole('button', { name: 'git.quickOps.squash' }));
      await waitFor(() => expect(onSquash).toHaveBeenCalledWith(3, 'combine commits', true));

      expect(confirmSpy).toHaveBeenCalledTimes(2);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('renders interactive rebase card and supports preview', async () => {
    const onPreview = jest.fn().mockResolvedValue([{ action: 'pick', hash: 'abc12345', message: 'feat: test' }]);
    render(
      <GitInteractiveRebaseCard
        onPreview={onPreview}
        onStart={jest.fn().mockResolvedValue('ok')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.interactiveRebase.basePlaceholder'), { target: { value: 'HEAD~2' } });
    fireEvent.click(screen.getByText('git.interactiveRebase.preview'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith('HEAD~2'));
  });

  it('renders bisect card and supports start', async () => {
    const onStart = jest.fn().mockResolvedValue('started');
    render(
      <GitBisectCard
        bisectState={{ active: false, currentHash: null, stepsTaken: 0, remainingEstimate: null }}
        onRefreshState={jest.fn().mockResolvedValue(undefined)}
        onStart={onStart}
        onGood={jest.fn().mockResolvedValue('ok')}
        onBad={jest.fn().mockResolvedValue('ok')}
        onSkip={jest.fn().mockResolvedValue('ok')}
        onReset={jest.fn().mockResolvedValue('ok')}
        onLog={jest.fn().mockResolvedValue('ok')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.bisect.goodRefPlaceholder'), { target: { value: 'v1.0.0' } });
    fireEvent.click(screen.getByText('git.bisect.start'));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith('HEAD', 'v1.0.0'));
  });

  it('renders archive card and supports create', async () => {
    const onArchive = jest.fn().mockResolvedValue('ok');
    render(<GitArchiveCard onArchive={onArchive} />);

    fireEvent.change(screen.getByPlaceholderText('git.archive.outputPath'), { target: { value: '/tmp/repo.zip' } });
    fireEvent.click(screen.getByText('git.archive.create'));
    await waitFor(() => expect(onArchive).toHaveBeenCalled());
  });

  it('renders patch card and supports create/apply', async () => {
    const user = userEvent.setup();
    const onFormatPatch = jest.fn().mockResolvedValue(['/tmp/0001.patch']);
    const onApplyPatch = jest.fn().mockResolvedValue('ok');
    render(
      <GitPatchCard
        onFormatPatch={onFormatPatch}
        onApplyPatch={onApplyPatch}
        onApplyMailbox={jest.fn().mockResolvedValue('ok')}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.patch.outputDir'), { target: { value: '/tmp' } });
    await user.click(screen.getByRole('button', { name: 'git.patch.create' }));
    await waitFor(() => expect(onFormatPatch).toHaveBeenCalled());

    await user.click(screen.getByRole('tab', { name: 'git.patch.applyTab' }));
    const patchFileInput = await screen.findByPlaceholderText('git.patch.patchFile');
    fireEvent.change(patchFileInput, { target: { value: '/tmp/0001.patch' } });
    await user.click(screen.getByRole('button', { name: 'git.patch.apply' }));
    await waitFor(() => expect(onApplyPatch).toHaveBeenCalledWith('/tmp/0001.patch', false));
  });

  it('disables controls when loading flag is true', () => {
    render(
      <GitArchiveCard
        loading={true}
        onArchive={jest.fn().mockResolvedValue('ok')}
      />,
    );

    expect(screen.getByText('git.archive.create').closest('button')).toBeDisabled();
  });

  it('shows toast error on action failure', async () => {
    const { toast } = jest.requireMock('sonner');
    render(
      <GitArchiveCard
        onArchive={jest.fn().mockRejectedValue(new Error('boom'))}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('git.archive.outputPath'), { target: { value: '/tmp/repo.zip' } });
    fireEvent.click(screen.getByText('git.archive.create'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
