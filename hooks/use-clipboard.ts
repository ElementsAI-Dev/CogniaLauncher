import { useState, useCallback, useRef } from 'react';
import { writeClipboard, readClipboard } from '@/lib/clipboard';

/**
 * Unified clipboard hook that uses Tauri native clipboard when available,
 * falling back to navigator.clipboard in web mode.
 * Includes auto-resetting "copied" state for UI feedback.
 */
export function useCopyToClipboard(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string) => {
    await writeClipboard(text);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  const paste = useCallback(async () => readClipboard(), []);

  return { copied, copy, paste };
}
