import { callHost, callHostJson } from './host';

/**
 * Read text from the system clipboard.
 * Requires: clipboard permission.
 */
export function read(): string {
  const result = callHostJson<{ text: string }>(
    'cognia_clipboard_read',
    '',
  );
  return result.text;
}

/**
 * Write text to the system clipboard.
 * Requires: clipboard permission.
 */
export function write(text: string): void {
  callHost('cognia_clipboard_write', JSON.stringify({ text }));
}
