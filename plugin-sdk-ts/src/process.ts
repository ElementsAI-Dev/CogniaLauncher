import { callHostJson } from './host';
import type {
  ProcessAvailabilityResult,
  ProcessExecOptions,
  ProcessLookupResult,
  ProcessOptions,
  ProcessResult,
} from './types';

type ProcessInputPayload = {
  command: string;
  args?: string[];
  cwd: string | null;
  env: Record<string, string>;
  timeoutMs?: number;
  captureOutput?: boolean;
};

function normalizeProcessOptions(
  options?: ProcessOptions | null,
): Omit<ProcessInputPayload, 'command' | 'args'> &
  Partial<Pick<ProcessInputPayload, 'timeoutMs' | 'captureOutput'>> {
  const normalized: Omit<ProcessInputPayload, 'command' | 'args'> &
    Partial<Pick<ProcessInputPayload, 'timeoutMs' | 'captureOutput'>> = {
    cwd: options?.cwd ?? null,
    env: options?.env ?? {},
  };

  if (typeof options?.timeoutMs === 'number') {
    normalized.timeoutMs = options.timeoutMs;
  }
  if (typeof options?.captureOutput === 'boolean') {
    normalized.captureOutput = options.captureOutput;
  }

  return normalized;
}

function buildLegacyExecInput(
  command: string,
  args?: string[] | null,
  cwd?: string | null,
): ProcessInputPayload {
  return {
    command,
    args: args ?? [],
    cwd: cwd ?? null,
    env: {},
  };
}

function buildStructuredExecInput(
  command: string,
  options?: ProcessExecOptions | null,
): ProcessInputPayload {
  return {
    command,
    args: options?.args ?? [],
    ...normalizeProcessOptions(options),
  };
}

function buildShellExecInput(
  command: string,
  options?: ProcessOptions | null,
): Omit<ProcessInputPayload, 'args'> {
  return {
    command,
    ...normalizeProcessOptions(options),
  };
}

/**
 * Execute a direct process command (requires `process_exec` permission).
 * Backward compatible with `exec(command, args?, cwd?)`.
 */
export function exec(
  command: string,
  args?: string[],
  cwd?: string | null,
): ProcessResult;
export function exec(
  command: string,
  options?: ProcessExecOptions | null,
): ProcessResult;
export function exec(
  command: string,
  argsOrOptions?: string[] | ProcessExecOptions | null,
  cwd?: string | null,
): ProcessResult {
  const input =
    Array.isArray(argsOrOptions) || typeof cwd !== 'undefined' || argsOrOptions == null
      ? buildLegacyExecInput(command, argsOrOptions as string[] | null | undefined, cwd)
      : buildStructuredExecInput(command, argsOrOptions as ProcessExecOptions);

  return callHostJson<ProcessResult>(
    'cognia_process_exec',
    JSON.stringify(input),
  );
}

/** Execute a command through the host shell. */
export function execShell(
  command: string,
  options?: ProcessOptions | null,
): ProcessResult {
  return callHostJson<ProcessResult>(
    'cognia_process_exec_shell',
    JSON.stringify(buildShellExecInput(command, options)),
  );
}

/** Resolve a program on the host PATH. */
export function which(command: string): ProcessLookupResult {
  return callHostJson<ProcessLookupResult>(
    'cognia_process_which',
    JSON.stringify({ command }),
  );
}

/** Check whether a program is available on the host PATH. */
export function isAvailable(command: string): ProcessAvailabilityResult {
  return callHostJson<ProcessAvailabilityResult>(
    'cognia_process_is_available',
    JSON.stringify({ command }),
  );
}
