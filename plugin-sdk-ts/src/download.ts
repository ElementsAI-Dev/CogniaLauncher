/**
 * Download management module.
 *
 * Provides access to the download manager for adding, tracking,
 * and controlling file downloads.
 *
 * Requires: `download_read` and/or `download_write` permissions.
 */
import { callHostJson } from './host';
import type {
  DownloadTask,
  DownloadStats,
  DownloadHistoryEntry,
  DownloadHistoryStats,
  DownloadVerifyResult,
} from './types';

/** List all active download tasks. Requires: download_read */
export function list(): DownloadTask[] {
  return callHostJson<DownloadTask[]>('cognia_download_list', '');
}

/** Get a specific download task by ID. Requires: download_read */
export function get(id: string): DownloadTask | null {
  return callHostJson<DownloadTask | null>(
    'cognia_download_get',
    JSON.stringify({ id }),
  );
}

/** Get download queue statistics. Requires: download_read */
export function stats(): DownloadStats {
  return callHostJson<DownloadStats>('cognia_download_stats', '');
}

/** List download history entries. Requires: download_read */
export function historyList(limit?: number, offset?: number): DownloadHistoryEntry[] {
  return callHostJson<DownloadHistoryEntry[]>(
    'cognia_download_history_list',
    JSON.stringify({ limit: limit ?? null, offset: offset ?? null }),
  );
}

/** Search download history. Requires: download_read */
export function historySearch(query: string): DownloadHistoryEntry[] {
  return callHostJson<DownloadHistoryEntry[]>(
    'cognia_download_history_search',
    JSON.stringify({ query }),
  );
}

/** Get download history statistics. Requires: download_read */
export function historyStats(): DownloadHistoryStats {
  return callHostJson<DownloadHistoryStats>('cognia_download_history_stats', '');
}

/** Add a new download task. Requires: download_write + http domain check */
export function add(url: string, filename?: string, directory?: string): string {
  return callHostJson<string>(
    'cognia_download_add',
    JSON.stringify({ url, filename: filename ?? null, directory: directory ?? null }),
  );
}

/** Pause a download task. Requires: download_write */
export function pause(id: string): void {
  callHostJson<{ ok: boolean }>('cognia_download_pause', JSON.stringify({ id }));
}

/** Resume a download task. Requires: download_write */
export function resume(id: string): void {
  callHostJson<{ ok: boolean }>('cognia_download_resume', JSON.stringify({ id }));
}

/** Cancel a download task. Requires: download_write */
export function cancel(id: string): void {
  callHostJson<{ ok: boolean }>('cognia_download_cancel', JSON.stringify({ id }));
}

/** Verify a downloaded file's checksum. Requires: download_read */
export function verifyFile(
  path: string,
  expectedHash: string,
  algorithm?: string,
): DownloadVerifyResult {
  return callHostJson<DownloadVerifyResult>(
    'cognia_download_verify',
    JSON.stringify({ path, expectedHash, algorithm: algorithm ?? 'sha256' }),
  );
}
