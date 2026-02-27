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
