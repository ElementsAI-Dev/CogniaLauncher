import type {
  GitActionError,
  GitActionErrorCategory,
  GitActionResult,
  GitGuardrailDecision,
  GitRefreshScope,
} from '@/types/git';

const TAGGED_ERROR_RE =
  /^\[git:(environment|precondition|conflict|execution|cancelled)\]\s*/i;

function stripTaggedPrefix(message: string): string {
  return message.replace(TAGGED_ERROR_RE, '').trim();
}

function detectTaggedCategory(message: string): GitActionErrorCategory | null {
  const match = message.match(TAGGED_ERROR_RE);
  if (!match) return null;
  return match[1].toLowerCase() as GitActionErrorCategory;
}

function defaultNextSteps(category: GitActionErrorCategory): string[] {
  switch (category) {
    case 'precondition':
      return ['Complete prerequisite steps and retry.'];
    case 'conflict':
      return ['Resolve repository conflicts, then continue or retry.'];
    case 'cancelled':
      return ['Operation was cancelled. Retry when ready.'];
    case 'environment':
      return ['Verify Git/runtime environment and repository path.'];
    case 'execution':
      return ['Review command output and retry after fixing the issue.'];
    default:
      return [];
  }
}

export function classifyGitActionError(raw: string): GitActionError {
  const taggedCategory = detectTaggedCategory(raw);
  const normalized = stripTaggedPrefix(raw);
  const lower = normalized.toLowerCase();

  let category: GitActionErrorCategory = taggedCategory ?? 'unknown';
  if (!taggedCategory) {
    if (
      lower.includes('cancelled') ||
      lower.includes('canceled') ||
      lower.includes('terminated by signal')
    ) {
      category = 'cancelled';
    } else if (
      lower.includes('not in tauri environment') ||
      lower.includes('not a git repository') ||
      lower.includes('git is not recognized')
    ) {
      category = 'environment';
    } else if (
      lower.includes('no repo') ||
      lower.includes('no clone operation in progress') ||
      lower.includes('no upstream') ||
      lower.includes('set-upstream') ||
      lower.includes('could not read from remote repository')
    ) {
      category = 'precondition';
    } else if (
      lower.includes('conflict') ||
      lower.includes('merge in progress') ||
      lower.includes('rebase in progress') ||
      lower.includes('resolve conflicts')
    ) {
      category = 'conflict';
    } else if (lower.length > 0) {
      category = 'execution';
    }
  }

  const recoverable =
    category === 'precondition' ||
    category === 'conflict' ||
    category === 'cancelled';

  return {
    category,
    recoverable,
    rawMessage: raw,
    userMessage: normalized || raw,
    nextSteps: defaultNextSteps(category),
  };
}

export function evaluateGitGuardrail(
  operation: 'push' | 'reset' | 'clean' | 'rebase' | 'squash',
  options: { force?: boolean; forceLease?: boolean; mode?: string } = {},
): GitGuardrailDecision {
  if (operation === 'push' && (options.force || options.forceLease)) {
    return {
      level: 'warn',
      reason: 'Force push rewrites remote history.',
      nextSteps: ['Confirm force push explicitly before execution.'],
    };
  }

  if (operation === 'reset') {
    const mode = (options.mode ?? 'mixed').toLowerCase();
    if (mode === 'hard' || mode === 'mixed') {
      return {
        level: 'warn',
        reason: `git reset --${mode} rewrites local history/state.`,
        nextSteps: ['Confirm destructive reset explicitly before execution.'],
      };
    }
  }

  if (operation === 'clean') {
    return {
      level: 'warn',
      reason: 'git clean permanently removes untracked files.',
      nextSteps: ['Confirm cleanup explicitly before execution.'],
    };
  }

  if (operation === 'rebase' || operation === 'squash') {
    return {
      level: 'warn',
      reason: 'Rebase/Squash rewrites commit history.',
      nextSteps: ['Confirm history rewrite explicitly before execution.'],
    };
  }

  return { level: 'pass', reason: '', nextSteps: [] };
}

export interface ExecuteGitOperationOptions<T> {
  operation: string;
  execute: () => Promise<T>;
  refreshScopes?: GitRefreshScope[];
  refreshByScopes?: (scopes: GitRefreshScope[]) => Promise<void>;
  precheck?: () => GitGuardrailDecision;
  allowWarning?: boolean;
  mapSuccessMessage?: (payload: T) => string;
}

export interface ExecuteGitOperationOutput<T> {
  result: GitActionResult;
  payload?: T;
}

export async function executeGitOperation<T>(
  options: ExecuteGitOperationOptions<T>,
): Promise<ExecuteGitOperationOutput<T>> {
  const refreshScopes = options.refreshScopes ?? [];
  const decision = options.precheck?.();

  if (decision && decision.level === 'block') {
    return {
      result: {
        operation: options.operation,
        status: 'blocked',
        message: decision.reason,
        refreshScopes,
        guardrail: decision,
      },
    };
  }

  if (decision && decision.level === 'warn' && !options.allowWarning) {
    return {
      result: {
        operation: options.operation,
        status: 'blocked',
        message: decision.reason,
        refreshScopes,
        guardrail: decision,
        error: {
          category: 'precondition',
          recoverable: true,
          rawMessage: decision.reason,
          userMessage: decision.reason,
          nextSteps: decision.nextSteps,
        },
      },
    };
  }

  try {
    const payload = await options.execute();
    if (options.refreshByScopes && refreshScopes.length > 0) {
      await options.refreshByScopes(refreshScopes);
    }
    return {
      payload,
      result: {
        operation: options.operation,
        status: 'success',
        message: options.mapSuccessMessage?.(payload) ?? String(payload ?? ''),
        refreshScopes,
        guardrail: decision?.level === 'warn' ? decision : undefined,
      },
    };
  } catch (error) {
    const actionError = classifyGitActionError(String(error));
    return {
      result: {
        operation: options.operation,
        status: actionError.category === 'cancelled' ? 'cancelled' : 'failed',
        message: actionError.userMessage,
        refreshScopes,
        error: actionError,
        guardrail: decision?.level === 'warn' ? decision : undefined,
      },
    };
  }
}
