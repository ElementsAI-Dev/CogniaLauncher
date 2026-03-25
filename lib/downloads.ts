import { PRIORITY_OPTIONS } from "@/lib/constants/downloads";
import type {
  DownloadHistoryRecord,
  DownloadArtifactArch,
  DownloadArtifactKind,
  DownloadArtifactPlatform,
  DownloadArtifactProfile,
  DownloadInstallIntent,
  DownloadRequest,
  DownloadSourceDescriptor,
  DownloadSourceKind,
  DownloadSuggestedFollowUp,
  DownloadTask,
} from "@/types/tauri";

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
  reasonCode?: string | null;
}

export interface DownloadFailureInfo {
  failureClass: DownloadFailureClass;
  retryable: boolean;
}

export interface ArtifactProfilePreviewInput {
  fileName?: string | null;
  url?: string | null;
  sourceKind: DownloadSourceKind;
}

export interface DownloadFollowUpAction {
  kind: DownloadSuggestedFollowUp;
  enabled: boolean;
}

export interface DownloadFollowUpContext {
  status: DownloadTask["state"] | DownloadHistoryRecord["status"];
  destinationAvailable: boolean;
  artifactProfile?: DownloadArtifactProfile | null;
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

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringList(values?: string[] | null): string[] | undefined {
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSourceDescriptor(
  descriptor?: DownloadSourceDescriptor | null
): DownloadSourceDescriptor | undefined {
  if (!descriptor) return undefined;

  const normalized: DownloadSourceDescriptor = {
    kind: descriptor.kind,
  };

  const stringKeys: Array<keyof DownloadSourceDescriptor> = [
    "provider",
    "label",
    "repo",
    "releaseTag",
    "refName",
    "workflowRunId",
    "artifactId",
    "pipelineId",
    "jobId",
    "packageId",
    "packageFileId",
  ];

  for (const key of stringKeys) {
    const value = descriptor[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        normalized[key] = trimmed;
      }
    }
  }

  return normalized;
}

function normalizeArtifactProfile(
  profile?: DownloadArtifactProfile | null
): DownloadArtifactProfile | undefined {
  if (!profile) return undefined;
  return {
    artifactKind: profile.artifactKind,
    sourceKind: profile.sourceKind,
    platform: profile.platform,
    arch: profile.arch,
    installIntent: profile.installIntent,
    suggestedFollowUps: [...profile.suggestedFollowUps],
  };
}

function compactRequest<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function detectArtifactPlatform(fileName: string): DownloadArtifactPlatform {
  if (/(?:^|[-_.])(windows|win)(?:[-_.]|$)/i.test(fileName)) return "windows";
  if (/(?:^|[-_.])(macos|darwin|osx|apple)(?:[-_.]|$)/i.test(fileName)) return "macos";
  if (/(?:^|[-_.])linux(?:[-_.]|$)/i.test(fileName)) return "linux";
  return "unknown";
}

function detectArtifactArch(fileName: string): DownloadArtifactArch {
  if (/(?:^|[-_.])(aarch64|arm64)(?:[-_.]|$)/i.test(fileName)) return "arm64";
  if (/(?:^|[-_.])(x86_64|x64|amd64)(?:[-_.]|$)/i.test(fileName)) return "x64";
  if (/(?:^|[-_.])(x86|i386|i686|386)(?:[-_.]|$)/i.test(fileName)) return "x86";
  return "unknown";
}

function inferArtifactKind(
  fileName: string,
  sourceKind: DownloadSourceKind
): DownloadArtifactKind {
  const lower = fileName.toLowerCase();
  if (sourceKind === "github_workflow_artifact" || sourceKind === "gitlab_pipeline_artifact") {
    return "ci_artifact";
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".zip")
    || lower.endsWith(".tar.xz") || lower.endsWith(".txz") || lower.endsWith(".tar.bz2")
    || lower.endsWith(".tbz2") || lower.endsWith(".tar.zst") || lower.endsWith(".tzst")
    || lower.endsWith(".7z")) {
    return sourceKind === "github_source_archive" || sourceKind === "gitlab_source_archive"
      ? "source_archive"
      : "archive";
  }
  if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.endsWith(".pkg") || lower.endsWith(".dmg")) {
    return "installer";
  }
  if (lower.endsWith(".deb") || lower.endsWith(".rpm") || lower.endsWith(".appimage")) {
    return "package_file";
  }
  if (lower.endsWith(".bin")) {
    return "portable_binary";
  }
  return "unknown";
}

function inferInstallIntent(kind: DownloadArtifactKind): DownloadInstallIntent {
  switch (kind) {
    case "installer":
      return "open_installer";
    case "archive":
    case "ci_artifact":
    case "source_archive":
      return "extract_then_continue";
    default:
      return "none";
  }
}

function inferSuggestedFollowUps(
  kind: DownloadArtifactKind,
  intent: DownloadInstallIntent
): DownloadSuggestedFollowUp[] {
  if (intent === "open_installer") {
    return ["install", "open", "reveal"];
  }
  if (intent === "extract_then_continue") {
    return ["extract", "open", "reveal"];
  }
  return ["open", "reveal"];
}

export function createArtifactProfilePreview(
  input: ArtifactProfilePreviewInput
): DownloadArtifactProfile {
  const fileName = (input.fileName ?? input.url ?? "").trim();
  const artifactKind = inferArtifactKind(fileName, input.sourceKind);
  const installIntent = inferInstallIntent(artifactKind);

  return {
    artifactKind,
    sourceKind: input.sourceKind,
    platform: detectArtifactPlatform(fileName),
    arch: detectArtifactArch(fileName),
    installIntent,
    suggestedFollowUps: inferSuggestedFollowUps(artifactKind, installIntent),
  };
}

function resolveArtifactProfile(
  request: Partial<DownloadRequest> & Pick<DownloadRequest, "url" | "destination">
): DownloadArtifactProfile | undefined {
  const normalized = normalizeArtifactProfile(request.artifactProfile);
  if (normalized) return normalized;

  const sourceKind = request.sourceDescriptor?.kind;
  if (!sourceKind) return undefined;

  return createArtifactProfilePreview({
    fileName: request.name ?? inferNameFromUrl(request.url),
    url: request.url,
    sourceKind,
  });
}

export function createDownloadRequestDraft(
  request: Pick<DownloadRequest, "url" | "destination"> &
    Partial<DownloadRequest> & { name?: string }
): DownloadRequest {
  const sourceDescriptor = normalizeSourceDescriptor(request.sourceDescriptor);
  const effectiveSourceDescriptor =
    sourceDescriptor ??
    ({
      kind: "direct_url",
    } satisfies DownloadSourceDescriptor);
  const artifactProfile = resolveArtifactProfile({
    ...request,
    sourceDescriptor: effectiveSourceDescriptor,
  });
  const installIntent = request.installIntent ?? artifactProfile?.installIntent;

  return compactRequest({
    url: request.url.trim(),
    destination: request.destination.trim(),
    name: normalizeOptionalString(request.name) ?? inferNameFromUrl(request.url),
    checksum: normalizeOptionalString(request.checksum),
    priority: request.priority,
    provider: normalizeOptionalString(request.provider),
    headers:
      request.headers && Object.keys(request.headers).length > 0
        ? request.headers
        : undefined,
    autoExtract: request.autoExtract || undefined,
    extractDest: normalizeOptionalString(request.extractDest),
    segments:
      typeof request.segments === "number" && request.segments > 1
        ? request.segments
        : undefined,
    mirrorUrls: normalizeStringList(request.mirrorUrls),
    postAction:
      request.postAction && request.postAction !== "none"
        ? request.postAction
        : undefined,
    deleteAfterExtract: request.deleteAfterExtract || undefined,
    autoRename: request.autoRename || undefined,
    tags: normalizeStringList(request.tags),
    installIntent,
    sourceDescriptor: effectiveSourceDescriptor,
    artifactProfile,
  });
}

export function createHistoryDownloadDraft(
  record: DownloadHistoryRecord
): DownloadRequest {
  return createDownloadRequestDraft({
    url: record.url,
    destination: record.destination,
    name: record.filename,
    provider: record.provider ?? undefined,
    sourceDescriptor: record.sourceDescriptor ?? undefined,
    artifactProfile: record.artifactProfile ?? undefined,
    installIntent: record.installIntent ?? undefined,
  });
}

export function getDownloadFollowUpActions(
  context: DownloadFollowUpContext
): DownloadFollowUpAction[] {
  if (context.status !== "completed" || !context.destinationAvailable) {
    return [{ kind: "reuse", enabled: true }];
  }

  const profile = context.artifactProfile;
  if (!profile) {
    return [
      { kind: "open", enabled: true },
      { kind: "reveal", enabled: true },
    ];
  }

  const actions = profile.suggestedFollowUps.map<DownloadFollowUpAction>((kind) => ({
    kind,
    enabled: true,
  }));

  if (!actions.some((action) => action.kind === "open")) {
    actions.push({ kind: "open", enabled: true });
  }
  if (!actions.some((action) => action.kind === "reveal")) {
    actions.push({ kind: "reveal", enabled: true });
  }

  return actions;
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

  const reason = (input.reasonCode ?? "").toLowerCase();
  const raw = (input.error ?? "").toLowerCase();
  let failureClass: DownloadFailureClass = "network_error";

  if (
    reason === "invalid_url" ||
    reason === "not_found" ||
    reason === "unauthorized" ||
    reason === "forbidden" ||
    reason === "task_not_found" ||
    reason === "invalid_operation"
  ) {
    failureClass = "selection_error";
  } else if (reason === "checksum_mismatch") {
    failureClass = "integrity_error";
  } else if (reason === "timeout") {
    failureClass = "timeout";
  } else if (
    reason === "cache_error" ||
    reason === "cache_validation_failed"
  ) {
    failureClass = "cache_error";
  } else if (
    reason === "network_error" ||
    reason === "http_error" ||
    reason === "http_server_error" ||
    reason === "rate_limited" ||
    reason === "interrupted" ||
    reason === "filesystem_error" ||
    reason === "insufficient_space"
  ) {
    failureClass = "network_error";
  } else if (
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
