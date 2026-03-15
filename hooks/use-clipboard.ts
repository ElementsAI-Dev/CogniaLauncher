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
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markCopied = useCallback(() => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  const copy = useCallback(async (text: string) => {
    try {
      await writeClipboard(text);
      setError(null);
      markCopied();
    } catch (err) {
      setError(getClipboardErrorMessage(err));
    }
  }, [markCopied]);

  const paste = useCallback(async () => {
    try {
      const text = await readClipboard();
      setError(null);
      return text;
    } catch (err) {
      setError(getClipboardErrorMessage(err));
      return null;
    }
  }, []);

  const copyImage = useCallback(async (image: string | number[] | ArrayBuffer | Uint8Array) => {
    try {
      await writeClipboardImage(image);
      setError(null);
      markCopied();
    } catch (err) {
      setError(getClipboardErrorMessage(err));
    }
  }, [markCopied]);

  const pasteImage = useCallback(async () => {
    try {
      const image = await readClipboardImage();
      setError(null);
      return image;
    } catch (err) {
      setError(getClipboardErrorMessage(err));
      return null;
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await clearClipboard();
      setError(null);
    } catch (err) {
      setError(getClipboardErrorMessage(err));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { copied, error, copy, paste, copyImage, pasteImage, clear, clearError };
}

function getClipboardErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Clipboard operation failed';
}
