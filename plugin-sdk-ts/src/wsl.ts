/**
 * WSL (Windows Subsystem for Linux) module.
 *
 * Provides read-only access to WSL distribution information.
 * Only functional on Windows; returns empty/false on other platforms.
 *
 * Requires: `wsl_read` permission.
 */
import { callHostJson } from './host';
import type {
  ProcessResult,
  WslStatus,
  WslVersionInfo,
  WslDistro,
  WslOnlineDistro,
  WslDiskUsage,
} from './types';

/** Check if WSL is available. Requires: wsl_read */
export function isAvailable(): boolean {
  return callHostJson<boolean>('cognia_wsl_is_available', '');
}

/** Get WSL status. Requires: wsl_read */
export function status(): WslStatus {
  return callHostJson<WslStatus>('cognia_wsl_status', '');
}

/** Get WSL version information. Requires: wsl_read */
export function getVersionInfo(): WslVersionInfo {
  return callHostJson<WslVersionInfo>('cognia_wsl_get_version_info', '');
}

/** List installed WSL distributions. Requires: wsl_read */
export function listDistros(): WslDistro[] {
  return callHostJson<WslDistro[]>('cognia_wsl_list_distros', '');
}

/** List running WSL distributions. Requires: wsl_read */
export function listRunning(): WslDistro[] {
  return callHostJson<WslDistro[]>('cognia_wsl_list_running', '');
}

/** List available online distributions. Requires: wsl_read */
export function listOnline(): WslOnlineDistro[] {
  return callHostJson<WslOnlineDistro[]>('cognia_wsl_list_online', '');
}

/** Get IP address for a distribution. Requires: wsl_read */
export function getIp(distro: string): string | null {
  return callHostJson<string | null>(
    'cognia_wsl_get_ip',
    JSON.stringify({ distro }),
  );
}

/** Get disk usage for a distribution. Requires: wsl_read */
export function diskUsage(distro: string): WslDiskUsage {
  return callHostJson<WslDiskUsage>(
    'cognia_wsl_disk_usage',
    JSON.stringify({ distro }),
  );
}

/** Execute a command in a WSL distribution. Requires: wsl_read + process_exec */
export function exec(distro: string, command: string): ProcessResult {
  return callHostJson<ProcessResult>(
    'cognia_wsl_exec',
    JSON.stringify({ distro, command }),
  );
}
