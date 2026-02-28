import { callHost } from './host';

function logWithLevel(level: string, message: string): void {
  callHost('cognia_log', JSON.stringify({ level, message }));
}

/** Log an info message. */
export function info(message: string): void {
  logWithLevel('info', message);
}

/** Log a warning message. */
export function warn(message: string): void {
  logWithLevel('warn', message);
}

/** Log an error message. */
export function error(message: string): void {
  logWithLevel('error', message);
}

/** Log a debug message. */
export function debug(message: string): void {
  logWithLevel('debug', message);
}
