/**
 * Health check module.
 *
 * Provides access to system and environment health diagnostics.
 *
 * Requires: `health_read` permission.
 */
import { callHostJson } from './host';
import type { HealthReport } from './types';

/** Run a full system health check. Requires: health_read */
export function checkAll(): HealthReport {
  return callHostJson<HealthReport>('cognia_health_check_all', '');
}

/** Check a specific environment type. Requires: health_read */
export function checkEnvironment(envType: string): HealthReport {
  return callHostJson<HealthReport>(
    'cognia_health_check_environment',
    JSON.stringify({ envType }),
  );
}

/** Check all package managers. Requires: health_read */
export function checkPackageManagers(): HealthReport {
  return callHostJson<HealthReport>('cognia_health_check_package_managers', '');
}

/** Check a specific package manager. Requires: health_read */
export function checkPackageManager(provider: string): HealthReport {
  return callHostJson<HealthReport>(
    'cognia_health_check_package_manager',
    JSON.stringify({ provider }),
  );
}
