import { callHost, callHostJson } from './host';
import type { DirEntry, FileExistsResult } from './types';

/**
 * Read a file from the plugin's data directory.
 * Requires: fs_read permission.
 */
export function read(path: string): string {
  return callHost('cognia_fs_read', JSON.stringify({ path }));
}

/**
 * Write content to a file in the plugin's data directory.
 * Requires: fs_write permission.
 */
export function write(path: string, content: string): void {
  callHost('cognia_fs_write', JSON.stringify({ path, content }));
}

/**
 * List files in a directory within the plugin's data directory.
 * Requires: fs_read permission.
 */
export function listDir(path: string): DirEntry[] {
  return callHostJson<DirEntry[]>(
    'cognia_fs_list_dir',
    JSON.stringify({ path }),
  );
}

/**
 * Check if a file or directory exists in the plugin's data directory.
 * Requires: fs_read permission.
 */
export function exists(path: string): FileExistsResult {
  return callHostJson<FileExistsResult>(
    'cognia_fs_exists',
    JSON.stringify({ path }),
  );
}

/**
 * Delete a file or directory in the plugin's data directory.
 * Requires: fs_write permission.
 */
export function remove(path: string): void {
  callHost('cognia_fs_delete', JSON.stringify({ path }));
}

/**
 * Create a directory in the plugin's data directory.
 * Requires: fs_write permission.
 */
export function mkdir(path: string): void {
  callHost('cognia_fs_mkdir', JSON.stringify({ path }));
}
