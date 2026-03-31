import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './fixtures/app-fixture';

type GitMockState = {
  repoPath: string;
  branches: Array<{
    name: string;
    shortHash: string;
    upstream: string | null;
    isCurrent: boolean;
    isRemote: boolean;
  }>;
};

const DEFAULT_GIT_MOCK_STATE: GitMockState = {
  repoPath: '/mock/repo',
  branches: [
    { name: 'main', shortHash: 'abc1234', upstream: 'origin/main', isCurrent: true, isRemote: false },
    { name: 'feature/demo', shortHash: 'def5678', upstream: null, isCurrent: false, isRemote: false },
  ],
};

async function installMockedDesktopRuntime(page: Page): Promise<void> {
  await page.addInitScript((seedState: GitMockState) => {
    const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const state = deepClone(seedState);
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    const nowIso = () => new Date().toISOString();

    const makeGraphEntries = (scope: string, limit: number) => {
      const count = Math.max(0, Math.min(limit, 250));
      return Array.from({ length: count }, (_, i) => {
        const hash = `h${String(i).padStart(6, '0')}`;
        return {
          hash,
          parents: i === 0 ? [] : [`h${String(i - 1).padStart(6, '0')}`],
          refs:
            i === 0
              ? [`HEAD -> ${scope === 'all' ? 'main' : scope}`, `tag: v1.${scope === 'all' ? '0' : '1'}`]
              : [],
          authorName: 'Mock Dev',
          date: nowIso(),
          message: `Commit ${i} (${scope})`,
        };
      });
    };

    const invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      calls.push({ cmd, args });

      switch (cmd) {
        // App shell essentials
        case 'app_check_init':
          return { initialized: true, version: '0.1.0' };
        case 'env_list':
        case 'env_list_providers':
        case 'provider_list':
        case 'provider_status_all':
        case 'package_list':
          return [];
        case 'config_get':
          return null;
        case 'config_list':
        case 'config_list_defaults':
          return [];

        // Git availability
        case 'git_is_available':
          return true;
        case 'git_get_version':
          return '2.42.0';
        case 'git_get_executable_path':
          return 'git';
        case 'git_get_config':
        case 'git_list_aliases':
          return [];
        case 'git_get_config_file_path':
          return '/home/mock/.gitconfig';
        case 'git_probe_editor_capability':
          return {
            available: false,
            reason: 'editor_not_found',
            preferredEditor: null,
            configPath: '/home/mock/.gitconfig',
            fallbackAvailable: true,
          };

        // Repo-scoped reads used by /git
        case 'git_get_repo_info':
          return {
            rootPath: String(args.path ?? state.repoPath),
            currentBranch: 'main',
            isDirty: false,
            fileCountStaged: 0,
            fileCountModified: 0,
            fileCountUntracked: 0,
          };
        case 'git_get_branches':
          return state.branches;
        case 'git_get_remotes':
        case 'git_get_tags':
        case 'git_get_stashes':
        case 'git_get_contributors':
        case 'git_get_status':
        case 'git_get_log':
        case 'git_get_reflog':
          return [];
        case 'git_get_ahead_behind':
          return { ahead: 0, behind: 0 };

        // Advanced state (queried on repoPath effect)
        case 'git_get_merge_rebase_state':
          return { state: 'none', onto: null, progress: null, total: null };
        case 'git_get_conflicted_files':
          return [];

        // LFS (queried on repoPath effect)
        case 'git_lfs_is_available':
          return false;
        case 'git_lfs_get_version':
          return null;
        case 'git_lfs_tracked_patterns':
          return [];
        case 'git_lfs_ls_files':
          return [];

        // Graph + detail
        case 'git_get_graph_log': {
          const limit = Number(args.limit ?? 100);
          const branch = args.branch ? String(args.branch) : null;
          const allBranches = Boolean(args.allBranches);
          const scope = branch ?? (allBranches ? 'all' : 'head');
          return makeGraphEntries(scope, limit);
        }
        case 'git_get_commit_detail': {
          const hash = String(args.hash ?? '');
          return {
            hash,
            parents: [],
            authorName: 'Mock Dev',
            authorEmail: 'mock@example.com',
            date: nowIso(),
            message: `Detail for ${hash}`,
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
            files: [],
          };
        }

        // Mutations used by Graph context menu flows
        case 'git_reset':
        case 'git_cherry_pick':
        case 'git_revert':
        case 'git_create_branch':
        case 'git_create_tag':
          return 'ok';

        default:
          return null;
      }
    };

    // Seed Git repo store so /git restores a repo on mount.
    window.localStorage.setItem(
      'cognia-git-repos',
      JSON.stringify({
        state: {
          recentRepos: [state.repoPath],
          pinnedRepos: [],
          lastRepoPath: state.repoPath,
          cloneHistory: [],
        },
        version: 2,
      }),
    );

    // Mark onboarding complete to avoid modal interactions.
    window.localStorage.setItem(
      'cognia-onboarding',
      JSON.stringify({
        state: {
          mode: 'quick',
          completed: true,
          skipped: false,
          currentStep: 6,
          visitedSteps: [
            'mode-selection',
            'language',
            'theme',
            'environment-detection',
            'mirrors',
            'shell-init',
            'complete',
          ],
          tourCompleted: false,
          dismissedHints: [],
          hintsEnabled: true,
          version: 4,
          sessionState: 'completed',
          lastActiveStepId: 'complete',
          lastActiveAt: 0,
          canResume: false,
          sessionSummary: {
            mode: 'quick',
            locale: 'en',
            theme: 'light',
            mirrorPreset: 'default',
            detectedCount: 0,
            primaryEnvironment: null,
            manageableEnvironments: [],
            shellType: null,
            shellConfigured: null,
          },
        },
        version: 4,
      }),
    );

    let callbackId = 1;
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke,
        transformCallback: () => callbackId++,
        unregisterCallback: () => undefined,
        convertFileSrc: (value: string) => value,
      },
    });
    Object.defineProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__', {
      configurable: true,
      value: {
        platform: 'windows',
        arch: 'x86_64',
        family: 'windows',
        exe_extension: 'exe',
        eol: '\r\n',
        os_type: 'windows',
        version: '10.0.22631',
      },
    });

    (window as typeof window & { __TAURI_MOCK_CALLS?: unknown }).__TAURI_MOCK_CALLS = calls;
  }, DEFAULT_GIT_MOCK_STATE);
}

async function openMockedGitPage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installMockedDesktopRuntime(page);
  await page.goto('/git', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/git(?:\?.*)?$/);
}

test.describe('Git Graph (Mocked Desktop Runtime)', () => {
  test('can switch scope, load more, and select commit', async ({ page }) => {
    await openMockedGitPage(page);
    const graphList = page.locator('[role="listbox"][aria-label="Commit Graph"]:visible').first();
    const firstCommit = graphList.locator('[data-hash="h000000"]').first();

    await page.getByRole('tab', { name: 'Graph' }).click();
    await expect(page.getByText('Commit Graph').first()).toBeVisible();

    // Ensure initial graph load happened.
    await expect(firstCommit).toBeVisible();

    // Switch to a specific branch scope.
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'feature/demo' }).click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const calls = (window as typeof window & {
          __TAURI_MOCK_CALLS?: Array<{ cmd: string; args: Record<string, unknown> }>;
        }).__TAURI_MOCK_CALLS ?? [];
        return calls.some((call) => call.cmd === 'git_get_graph_log' && call.args.branch === 'feature/demo');
      });
    }).toBe(true);

    // Load more commits (expands limit to 200).
    await page.getByRole('button', { name: 'Load More Commits' }).click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const calls = (window as typeof window & {
          __TAURI_MOCK_CALLS?: Array<{ cmd: string; args: Record<string, unknown> }>;
        }).__TAURI_MOCK_CALLS ?? [];
        return calls.some((call) => call.cmd === 'git_get_graph_log' && call.args.limit === 200);
      });
    }).toBe(true);

    // Select a commit and ensure detail panel populates.
    await firstCommit.click();
    await expect(page.getByText('Commit Detail').first()).toBeVisible();
    await expect(page.getByText(/Detail for h000000/).first()).toBeVisible();
  });
});
