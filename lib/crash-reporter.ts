import { isTauri } from '@/lib/platform';
import { diagnosticCaptureFrontendCrash } from '@/lib/tauri';
import type { CrashInfo, DiagnosticErrorContext } from '@/types/tauri';

const FRONTEND_CRASH_CAPTURE_SESSION_KEY = 'cognia.frontend-crash-captured';

let capturedInMemory = false;

export interface FrontendCrashCaptureOptions {
  source: string;
  error: unknown;
  includeConfig?: boolean;
  extra?: Record<string, unknown>;
}

export type FrontendCrashCaptureReason =
  | 'not-tauri'
  | 'session-deduped'
  | 'capture-failed';

export interface FrontendCrashCaptureResult {
  captured: boolean;
  reason?: FrontendCrashCaptureReason;
  crashInfo?: CrashInfo;
}

export function buildDiagnosticErrorContext(
  options: FrontendCrashCaptureOptions,
): DiagnosticErrorContext {
  const { message, stack, serializableError } = normalizeError(options.error);

  const metadata: Record<string, unknown> = {
    source: options.source,
    href: typeof window !== 'undefined' ? window.location.href : undefined,
    pathname:
      typeof window !== 'undefined' ? window.location.pathname : undefined,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    ...options.extra,
    rawError: serializableError,
  };

  const extra = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );

  return {
    message,
    stack,
    component: `frontend:${options.source}`,
    timestamp: new Date().toISOString(),
    extra,
  };
}

export async function captureFrontendCrash(
  options: FrontendCrashCaptureOptions,
): Promise<FrontendCrashCaptureResult> {
  if (typeof window === 'undefined' || !isTauri()) {
    return { captured: false, reason: 'not-tauri' };
  }

  if (wasCapturedThisSession()) {
    return { captured: false, reason: 'session-deduped' };
  }

  markCapturedThisSession();

  try {
    const crashInfo = await diagnosticCaptureFrontendCrash({
      includeConfig: options.includeConfig ?? true,
      errorContext: buildDiagnosticErrorContext(options),
    });
    return { captured: true, crashInfo };
  } catch (error) {
    console.error('Failed to auto-capture frontend crash diagnostics:', error);
    return { captured: false, reason: 'capture-failed' };
  }
}

export function _resetFrontendCrashCaptureForTests(): void {
  capturedInMemory = false;
  const storage = getSessionStorage();
  if (storage) {
    storage.removeItem(FRONTEND_CRASH_CAPTURE_SESSION_KEY);
  }
}

function normalizeError(error: unknown): {
  message: string;
  stack?: string;
  serializableError: unknown;
} {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown frontend error',
      stack: error.stack,
      serializableError: serializeUnknown(error),
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      serializableError: error,
    };
  }

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      stack?: unknown;
      reason?: unknown;
    };
    const message =
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : typeof candidate.reason === 'string' && candidate.reason.trim()
          ? candidate.reason
          : 'Unknown frontend error';

    return {
      message,
      stack:
        typeof candidate.stack === 'string' ? candidate.stack : undefined,
      serializableError: serializeUnknown(error),
    };
  }

  return {
    message: 'Unknown frontend error',
    serializableError: serializeUnknown(error),
  };
}

function serializeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const primitiveType = typeof value;
  if (
    primitiveType === 'string' ||
    primitiveType === 'number' ||
    primitiveType === 'boolean'
  ) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function wasCapturedThisSession(): boolean {
  if (capturedInMemory) {
    return true;
  }

  const storage = getSessionStorage();
  if (!storage) {
    return capturedInMemory;
  }

  return storage.getItem(FRONTEND_CRASH_CAPTURE_SESSION_KEY) === '1';
}

function markCapturedThisSession(): void {
  capturedInMemory = true;
  const storage = getSessionStorage();
  if (storage) {
    storage.setItem(FRONTEND_CRASH_CAPTURE_SESSION_KEY, '1');
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
