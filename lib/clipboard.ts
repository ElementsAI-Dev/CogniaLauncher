import { isTauri } from '@/lib/platform';

/**
 * Write text to the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to navigator.clipboard in web.
 */
export async function writeClipboard(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Read text from the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to navigator.clipboard in web.
 */
export async function readClipboard(): Promise<string> {
  if (isTauri()) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    return await readText();
  }
  return await navigator.clipboard.readText();
}
