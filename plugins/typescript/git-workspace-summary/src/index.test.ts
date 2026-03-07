jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    process: {
      exec: jest.fn(),
    },
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

const plugin = require('./index');
const testApi = plugin.__test;

describe('git-workspace-summary helpers', () => {
  it('parses raw path input', () => {
    expect(testApi.parseInput('D:/Project/CogniaLauncher')).toEqual({
      repoPath: 'D:/Project/CogniaLauncher',
    });
  });

  it('parses branch divergence line', () => {
    expect(testApi.parseBranchLine('## main...origin/main [ahead 2, behind 1]')).toEqual({
      branch: 'main',
      upstream: 'origin/main',
      ahead: 2,
      behind: 1,
      detachedHead: false,
    });
  });

  it('counts staged, unstaged, and untracked files', () => {
    const parsed = testApi.parseStatusOutput(`## main...origin/main [ahead 1]\nM  src/app.ts\n M README.md\n?? notes.txt\n`);
    expect(parsed.counts).toEqual({
      staged: 1,
      unstaged: 1,
      untracked: 1,
      conflicted: 0,
      deleted: 0,
      renamed: 0,
    });
  });

  it('tracks conflict, delete, rename, and stash health signals', () => {
    const parsed = testApi.parseStatusOutput(`## HEAD (no branch)\nUU src/conflict.ts\n D docs/old.md\nR  src/old.ts -> src/new.ts\n`);
    expect(parsed.detachedHead).toBe(true);
    expect(parsed.counts).toEqual({
      staged: 1,
      unstaged: 2,
      untracked: 0,
      conflicted: 1,
      deleted: 1,
      renamed: 1,
    });
  });

  it('summarizes repository health using read-only follow-up commands', () => {
    const exec = require('@cognia/plugin-sdk').cognia.process.exec as jest.Mock;
    exec
      .mockReturnValueOnce({ exitCode: 0, stdout: 'true\n', stderr: '' })
      .mockReturnValueOnce({ exitCode: 0, stdout: '## main...origin/main [ahead 2, behind 1]\n?? notes.txt\n', stderr: '' })
      .mockReturnValueOnce({ exitCode: 0, stdout: '3\n', stderr: '' })
      .mockReturnValueOnce({ exitCode: 0, stdout: 'abc123\nImprove plugin docs\n', stderr: '' });

    const result = testApi.summarizeRepo('D:/Project/CogniaLauncher');

    expect(result.ok).toBe(true);
    expect(result.stashCount).toBe(3);
    expect(result.lastCommit).toEqual({
      shortSha: 'abc123',
      summary: 'Improve plugin docs',
    });
    expect(result.recommendations).toContain('Repository has 3 stash entrie(s); review whether any unfinished work should be restored or dropped.');
  });
});
