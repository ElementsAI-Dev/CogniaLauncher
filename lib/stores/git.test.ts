import { useGitRepoStore } from './git';
import { act } from '@testing-library/react';

// Reset store between tests
beforeEach(() => {
  const { setState } = useGitRepoStore;
  act(() => {
    setState({
      recentRepos: [],
      pinnedRepos: [],
      lastRepoPath: null,
      cloneHistory: [],
    });
  });
});

describe('useGitRepoStore', () => {
  it('starts with empty state', () => {
    const state = useGitRepoStore.getState();
    expect(state.recentRepos).toEqual([]);
    expect(state.pinnedRepos).toEqual([]);
    expect(state.lastRepoPath).toBeNull();
  });

  it('addRecentRepo adds path and sets lastRepoPath', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
    });
    const state = useGitRepoStore.getState();
    expect(state.recentRepos).toEqual(['/repo/a']);
    expect(state.lastRepoPath).toBe('/repo/a');
  });

  it('addRecentRepo deduplicates and moves to front', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
      useGitRepoStore.getState().addRecentRepo('/repo/b');
      useGitRepoStore.getState().addRecentRepo('/repo/a');
    });
    expect(useGitRepoStore.getState().recentRepos).toEqual(['/repo/a', '/repo/b']);
  });

  it('addRecentRepo caps at 10 entries', () => {
    act(() => {
      for (let i = 0; i < 15; i++) {
        useGitRepoStore.getState().addRecentRepo(`/repo/${i}`);
      }
    });
    expect(useGitRepoStore.getState().recentRepos).toHaveLength(10);
    expect(useGitRepoStore.getState().recentRepos[0]).toBe('/repo/14');
  });

  it('removeRecentRepo removes a path', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
      useGitRepoStore.getState().addRecentRepo('/repo/b');
      useGitRepoStore.getState().removeRecentRepo('/repo/a');
    });
    expect(useGitRepoStore.getState().recentRepos).toEqual(['/repo/b']);
  });

  it('pinRepo adds to pinnedRepos', () => {
    act(() => {
      useGitRepoStore.getState().pinRepo('/repo/x');
    });
    expect(useGitRepoStore.getState().pinnedRepos).toEqual(['/repo/x']);
  });

  it('pinRepo does not duplicate', () => {
    act(() => {
      useGitRepoStore.getState().pinRepo('/repo/x');
      useGitRepoStore.getState().pinRepo('/repo/x');
    });
    expect(useGitRepoStore.getState().pinnedRepos).toEqual(['/repo/x']);
  });

  it('unpinRepo removes from pinnedRepos', () => {
    act(() => {
      useGitRepoStore.getState().pinRepo('/repo/x');
      useGitRepoStore.getState().pinRepo('/repo/y');
      useGitRepoStore.getState().unpinRepo('/repo/x');
    });
    expect(useGitRepoStore.getState().pinnedRepos).toEqual(['/repo/y']);
  });

  it('setLastRepo updates lastRepoPath', () => {
    act(() => {
      useGitRepoStore.getState().setLastRepo('/repo/z');
    });
    expect(useGitRepoStore.getState().lastRepoPath).toBe('/repo/z');
  });

  it('setLastRepo accepts null', () => {
    act(() => {
      useGitRepoStore.getState().setLastRepo('/repo/z');
      useGitRepoStore.getState().setLastRepo(null);
    });
    expect(useGitRepoStore.getState().lastRepoPath).toBeNull();
  });

  it('clearRecent empties recentRepos', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
      useGitRepoStore.getState().addRecentRepo('/repo/b');
      useGitRepoStore.getState().clearRecent();
    });
    expect(useGitRepoStore.getState().recentRepos).toEqual([]);
  });

  it('clearRecent does not affect pinnedRepos or lastRepoPath', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
      useGitRepoStore.getState().pinRepo('/repo/a');
      useGitRepoStore.getState().clearRecent();
    });
    expect(useGitRepoStore.getState().pinnedRepos).toEqual(['/repo/a']);
    expect(useGitRepoStore.getState().lastRepoPath).toBe('/repo/a');
  });

  // ===== Clone History =====

  it('starts with empty cloneHistory', () => {
    expect(useGitRepoStore.getState().cloneHistory).toEqual([]);
  });

  it('addCloneHistory adds an entry', () => {
    act(() => {
      useGitRepoStore.getState().addCloneHistory({
        url: 'https://github.com/user/repo.git',
        destPath: '/repos/repo',
        timestamp: 1000,
        status: 'success',
      });
    });
    const history = useGitRepoStore.getState().cloneHistory;
    expect(history).toHaveLength(1);
    expect(history[0].url).toBe('https://github.com/user/repo.git');
    expect(history[0].status).toBe('success');
  });

  it('addCloneHistory prepends new entries', () => {
    act(() => {
      useGitRepoStore.getState().addCloneHistory({
        url: 'https://github.com/a/first.git',
        destPath: '/repos/first',
        timestamp: 1000,
        status: 'success',
      });
      useGitRepoStore.getState().addCloneHistory({
        url: 'https://github.com/b/second.git',
        destPath: '/repos/second',
        timestamp: 2000,
        status: 'failed',
        errorMessage: 'Network error',
      });
    });
    const history = useGitRepoStore.getState().cloneHistory;
    expect(history).toHaveLength(2);
    expect(history[0].url).toBe('https://github.com/b/second.git');
    expect(history[0].status).toBe('failed');
    expect(history[0].errorMessage).toBe('Network error');
    expect(history[1].url).toBe('https://github.com/a/first.git');
  });

  it('addCloneHistory caps at 20 entries', () => {
    act(() => {
      for (let i = 0; i < 25; i++) {
        useGitRepoStore.getState().addCloneHistory({
          url: `https://github.com/user/repo-${i}.git`,
          destPath: `/repos/repo-${i}`,
          timestamp: i * 1000,
          status: 'success',
        });
      }
    });
    expect(useGitRepoStore.getState().cloneHistory).toHaveLength(20);
    expect(useGitRepoStore.getState().cloneHistory[0].url).toBe('https://github.com/user/repo-24.git');
  });

  it('clearCloneHistory empties the list', () => {
    act(() => {
      useGitRepoStore.getState().addCloneHistory({
        url: 'https://github.com/user/repo.git',
        destPath: '/repos/repo',
        timestamp: 1000,
        status: 'success',
      });
      useGitRepoStore.getState().clearCloneHistory();
    });
    expect(useGitRepoStore.getState().cloneHistory).toEqual([]);
  });

  it('clearCloneHistory does not affect recentRepos', () => {
    act(() => {
      useGitRepoStore.getState().addRecentRepo('/repo/a');
      useGitRepoStore.getState().addCloneHistory({
        url: 'https://github.com/user/repo.git',
        destPath: '/repos/repo',
        timestamp: 1000,
        status: 'success',
      });
      useGitRepoStore.getState().clearCloneHistory();
    });
    expect(useGitRepoStore.getState().recentRepos).toEqual(['/repo/a']);
    expect(useGitRepoStore.getState().cloneHistory).toEqual([]);
  });
});
