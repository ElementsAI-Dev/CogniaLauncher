import { useState, useCallback, useRef } from 'react';
import {
  writeClipboard,
  readClipboard,
  writeClipboardImage,
  readClipboardImage,
  clearClipboard,
} from '@/lib/clipboard';

/**
 * Unified clipboard hook that uses Tauri native clipboard when available,
 * falling back to navigator.clipboard in web mode.
 * Includes auto-resetting "copied" state for UI feedback.
 */
export function useCopyToClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markCopied = useCallback(() => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  const copy = useCallback(async (text: string) => {
    await writeClipboard(text);
    markCopied();
  }, [markCopied]);

  const paste = useCallback(async () => readClipboard(), []);

  const copyImage = useCallback(async (image: string | number[] | ArrayBuffer | Uint8Array) => {
    await writeClipboardImage(image);
    markCopied();
  }, [markCopied]);

  const pasteImage = useCallback(async () => readClipboardImage(), []);

  const clear = useCallback(async () => clearClipboard(), []);

  return { copied, copy, paste, copyImage, pasteImage, clear };
}
