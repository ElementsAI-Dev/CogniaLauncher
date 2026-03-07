import type { ArchiveFormat } from "@/types/downloads";

/**
 * Default form values for the add-download dialog
 */
export const DEFAULT_DOWNLOAD_FORM = {
  url: "",
  destination: "",
  name: "",
  checksum: "",
  priority: "",
  provider: "",
  autoExtract: false,
  autoRename: false,
  deleteAfterExtract: false,
  extractDest: "",
  segments: "1",
  mirrorUrls: [] as string[],
  tags: "",
  postAction: "none",
};

/**
 * Priority options for download tasks
 */
export const PRIORITY_OPTIONS = [
  { value: "10", label: "critical" },
  { value: "8", label: "high" },
  { value: "5", label: "normal" },
  { value: "1", label: "low" },
] as const;

/**
 * Empty queue stats placeholder
 */
export const EMPTY_QUEUE_STATS = {
  totalTasks: 0,
  queued: 0,
  downloading: 0,
  paused: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  totalBytes: 0,
  downloadedBytes: 0,
  totalHuman: "0 B",
  downloadedHuman: "0 B",
  overallProgress: 0,
};

/**
 * Post-download action options
 */
export const POST_ACTION_OPTIONS = [
  { value: "none", label: "none" },
  { value: "open_file", label: "openFile" },
  { value: "reveal_in_folder", label: "revealInFolder" },
] as const;

/**
 * Segment count options for multi-segment parallel downloads
 */
export const SEGMENT_OPTIONS = [
  { value: "1", label: "1" },
  { value: "4", label: "4" },
  { value: "8", label: "8" },
  { value: "16", label: "16" },
] as const;

/**
 * GitHub supported archive formats
 */
export const GITHUB_ARCHIVE_FORMATS: ArchiveFormat[] = [
  { value: "zip", label: "ZIP" },
  { value: "tar.gz", label: "TAR.GZ" },
];

/**
 * GitLab supported archive formats
 */
export const GITLAB_ARCHIVE_FORMATS: ArchiveFormat[] = [
  { value: "zip", label: "ZIP" },
  { value: "tar.gz", label: "TAR.GZ" },
  { value: "tar.bz2", label: "TAR.BZ2" },
];
