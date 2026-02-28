import { callHostJson } from './host';
import type { ProcessResult } from './types';

/**
 * Execute a shell command (requires process_exec permission — dangerous).
 * Timeout: 60 seconds.
 */
export function exec(
  command: string,
  args?: string[],
  cwd?: string | null,
): ProcessResult {
  return callHostJson<ProcessResult>(
    'cognia_process_exec',
    JSON.stringify({
      command,
      args: args ?? [],
      cwd: cwd ?? null,
    }),
  );
}
