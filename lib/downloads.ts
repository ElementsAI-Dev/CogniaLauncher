import { PRIORITY_OPTIONS } from "@/lib/constants/downloads";
import type { DownloadTask } from "@/types/tauri";

export type DownloadFailureClass =
  | "selection_error"
  | "network_error"
  | "integrity_error"
  | "cache_error"
  | "cancelled"
  | "timeout";

export interface DownloadFailureInput {
  state: DownloadTask["state"] | "extracting";
  error?: string | null;
  recoverable?: boolean | null;
}

export interface DownloadFailureInfo {
  failureClass: DownloadFailureClass;
  retryable: boolean;
}

export interface DownloadPreflightInput {
  destinationPath: string;
  expectedBytes?: number | null;
  checkDiskSpace: (path: string, required: number) => Promise<boolean>;
}

export interface DownloadPreflightResult {
  allowed: boolean;
  reason: "ok" | "unknown_size" | "insufficient_space" | "check_failed";
  requiredBytes?: number;
  error?: string;
}

export interface DownloadPreflightUiOptions {
  t: (key: string) => string;
  onInfo?: (message: string) => void;
  onError?: (message: string) => void;
  warnUnknownSize?: boolean;
  unknownSizeWarningRef?: { current: boolean };
}

/**
 * Validate whether a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Infer a filename from a URL
 */
export function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment || "download";
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || "download";
  }
}

/**
 * Join destination directory and filename with platform-friendly separators.
 */
export function joinDestinationPath(basePath: string, itemName: string): string {
  const trimmedBase = basePath.trim().replace(/[\\/]+$/g, "");
  const trimmedName = itemName.trim().replace(/^[\\/]+/g, "");

  if (!trimmedBase) return trimmedName;
  if (!trimmedName) return trimmedBase;

  const separator =
    trimmedBase.includes("\\") && !trimmedBase.includes("/") ? "\\" : "/";
  return `${trimmedBase}${separator}${trimmedName}`;
}

/**
 * Map a download task state to a Badge variant
 */
export function getStateBadgeVariant(
  state: DownloadTask["state"]
): "default" | "destructive" | "secondary" | "outline" {
  switch (state) {
    case "completed":
      return "default";
    case "failed":
    case "cancelled":
      return "destructive";
    case "paused":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Find the closest priority option value for a given numeric priority
 */
export function findClosestPriority(priority: number): string {
  const sorted = PRIORITY_OPTIONS.map((o) => ({
    ...o,
    diff: Math.abs(Number(o.value) - priority),
  })).sort((a, b) => a.diff - b.diff);
  return sorted[0].value;
}

export function normalizeDownloadFailure(
  input: DownloadFailureInput
): DownloadFailureInfo {
  if (input.state === "cancelled") {
    return { failureClass: "cancelled", retryable: true };
  }

  const raw = (input.error ?? "").toLowerCase();
  let failureClass: DownloadFailureClass = "network_error";

  if (
    raw.includes("invalid url") ||
    raw.includes("not found") ||
    raw.includes("unauthorized") ||
    raw.includes("forbidden")
  ) {
    failureClass = "selection_error";
  } else if (
    raw.includes("checksum mismatch") ||
    raw.includes("integrity") ||
    raw.includes("signature")
  ) {
    failureClass = "integrity_error";
  } else if (
    raw.includes("cache") ||
    raw.includes("corrupted cached") ||
    raw.includes("cache hit validation")
  ) {
    failureClass = "cache_error";
  } else if (raw.includes("timeout")) {
    failureClass = "timeout";
  } else if (
    raw.includes("network") ||
    raw.includes("connection") ||
    raw.includes("http error") ||
    raw.includes("rate limited")
  ) {
    failureClass = "network_error";
  }

  const retryableByClass: Record<DownloadFailureClass, boolean> = {
    selection_error: false,
    network_error: true,
    integrity_error: false,
    cache_error: true,
    cancelled: true,
    timeout: true,
  };

  return {
    failureClass,
    retryable:
      typeof input.recoverable === "boolean"
        ? input.recoverable
        : retryableByClass[failureClass],
  };
}

/**
 * Run pre-download disk-space checks.
 *
 * Policy:
 * - known size: strict check, block when insufficient or check fails
 * - unknown size: allow and mark as warning scenario
 */
export async function runDownloadPreflight(
  input: DownloadPreflightInput
): Promise<DownloadPreflightResult> {
  const { destinationPath, expectedBytes, checkDiskSpace } = input;

  if (
    expectedBytes == null ||
    !Number.isFinite(expectedBytes) ||
    expectedBytes <= 0
  ) {
    return {
      allowed: true,
      reason: "unknown_size",
    };
  }

  try {
    const ok = await checkDiskSpace(destinationPath, expectedBytes);
    if (!ok) {
      return {
        allowed: false,
        reason: "insufficient_space",
        requiredBytes: expectedBytes,
      };
    }

    return {
      allowed: true,
      reason: "ok",
      requiredBytes: expectedBytes,
    };
  } catch (err) {
    return {
      allowed: false,
      reason: "check_failed",
      requiredBytes: expectedBytes,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run preflight and map result to user-facing feedback.
 */
export async function runDownloadPreflightWithUi(
  input: DownloadPreflightInput,
  options: DownloadPreflightUiOptions
): Promise<boolean> {
  const {
    t,
    onInfo = () => {},
    onError = () => {},
    warnUnknownSize = true,
    unknownSizeWarningRef,
  } = options;

  const result = await runDownloadPreflight(input);

  if (result.reason === "unknown_size") {
    if (warnUnknownSize) {
      const alreadyWarned = unknownSizeWarningRef?.current ?? false;
      if (!alreadyWarned) {
        onInfo(t("downloads.preflight.unknownSizeWarning"));
        if (unknownSizeWarningRef) {
          unknownSizeWarningRef.current = true;
        }
      }
    }
    return true;
  }

  if (!result.allowed) {
    if (result.reason === "insufficient_space") {
      onError(t("downloads.errors.insufficientSpace"));
    } else {
      onError(result.error ?? t("downloads.disk.checkSpace"));
    }
    return false;
  }

  return true;
}
