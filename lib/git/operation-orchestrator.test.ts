import {
  classifyGitActionError,
  executeGitOperation,
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
});

