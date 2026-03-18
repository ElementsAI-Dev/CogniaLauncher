import {
  classifyGitActionError,
  executeGitOperation,
  evaluateGitGuardrail,
} from './operation-orchestrator';

describe('operation-orchestrator', () => {
  it('classifies tagged timeout errors consistently', () => {
    const result = classifyGitActionError('[git:timeout] git fetch timed out after 30s');
    expect(result).toMatchObject({
      category: 'timeout',
      recoverable: true,
      userMessage: 'git fetch timed out after 30s',
    });
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it('classifies untagged timeout errors consistently', () => {
    const result = classifyGitActionError('fatal: operation timed out while contacting remote');
    expect(result).toMatchObject({
      category: 'timeout',
      recoverable: true,
    });
  });

  it('returns cancelled status for cancelled operation errors', async () => {
    const result = await executeGitOperation({
      operation: 'clone',
      execute: async () => {
        throw new Error('[git:cancelled] clone cancelled by user');
      },
    });
    expect(result.result).toMatchObject({
      operation: 'clone',
      status: 'cancelled',
      error: { category: 'cancelled', recoverable: true },
    });
  });

  it('returns failed status for timeout operation errors', async () => {
    const result = await executeGitOperation({
      operation: 'fetch',
      execute: async () => {
        throw new Error('[git:timeout] git fetch timed out');
      },
    });
    expect(result.result).toMatchObject({
      operation: 'fetch',
      status: 'failed',
      error: { category: 'timeout', recoverable: true },
    });
  });

  it('classifies environment, precondition, conflict, and execution errors', () => {
    expect(classifyGitActionError('fatal: not a git repository')).toMatchObject({
      category: 'environment',
      recoverable: false,
    });
    expect(classifyGitActionError('fatal: no upstream configured')).toMatchObject({
      category: 'precondition',
      recoverable: true,
    });
    expect(classifyGitActionError('fatal: merge in progress, resolve conflicts first')).toMatchObject({
      category: 'conflict',
      recoverable: true,
    });
    expect(classifyGitActionError('fatal: hook failed')).toMatchObject({
      category: 'execution',
      recoverable: false,
    });
  });

  it('evaluates destructive git guardrails by operation type', () => {
    expect(evaluateGitGuardrail('push', { force: true })).toMatchObject({
      level: 'warn',
    });
    expect(evaluateGitGuardrail('reset', { mode: 'hard' })).toMatchObject({
      level: 'warn',
    });
    expect(evaluateGitGuardrail('clean')).toMatchObject({
      level: 'warn',
    });
    expect(evaluateGitGuardrail('rebase')).toMatchObject({
      level: 'warn',
    });
    expect(evaluateGitGuardrail('push')).toEqual({
      level: 'pass',
      reason: '',
      nextSteps: [],
    });
  });

  it('blocks execution immediately when precheck returns a blocking guardrail', async () => {
    const result = await executeGitOperation({
      operation: 'reset',
      execute: async () => 'never-runs',
      precheck: () => ({
        level: 'block',
        reason: 'Repository state is unsafe.',
        nextSteps: ['Resolve worktree issues first.'],
      }),
    });

    expect(result).toEqual({
      result: {
        operation: 'reset',
        status: 'blocked',
        message: 'Repository state is unsafe.',
        refreshScopes: [],
        guardrail: {
          level: 'block',
          reason: 'Repository state is unsafe.',
          nextSteps: ['Resolve worktree issues first.'],
        },
      },
    });
  });

  it('blocks warning guardrails until the caller explicitly allows them', async () => {
    const result = await executeGitOperation({
      operation: 'push',
      execute: async () => 'never-runs',
      precheck: () => evaluateGitGuardrail('push', { forceLease: true }),
    });

    expect(result.result).toMatchObject({
      operation: 'push',
      status: 'blocked',
      error: { category: 'precondition', recoverable: true },
      guardrail: { level: 'warn' },
    });
  });

  it('allows warned operations to proceed and refreshes requested scopes on success', async () => {
    const refreshByScopes = jest.fn().mockResolvedValue(undefined);

    const result = await executeGitOperation({
      operation: 'push',
      execute: async () => ({ pushed: true }),
      precheck: () => evaluateGitGuardrail('push', { force: true }),
      allowWarning: true,
      refreshScopes: ['status', 'history'],
      refreshByScopes,
      mapSuccessMessage: (payload) => `pushed=${payload.pushed}`,
    });

    expect(refreshByScopes).toHaveBeenCalledWith(['status', 'history']);
    expect(result).toEqual({
      payload: { pushed: true },
      result: {
        operation: 'push',
        status: 'success',
        message: 'pushed=true',
        refreshScopes: ['status', 'history'],
        guardrail: {
          level: 'warn',
          reason: 'Force push rewrites remote history.',
          nextSteps: ['Confirm force push explicitly before execution.'],
        },
      },
    });
  });
});
