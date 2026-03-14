/**
 * Environment profiles module.
 *
 * Manage environment configuration snapshots for quick switching.
 *
 * Requires: `profiles_read` and/or `profiles_write` permissions.
 */
import { callHostJson } from './host';
import type { Profile, ProfileCreateInput } from './types';

/** List all profiles. Requires: profiles_read */
export function list(): Profile[] {
  return callHostJson<Profile[]>('cognia_profile_list', '');
}

/** Get a profile by ID. Requires: profiles_read */
export function get(id: string): Profile | null {
  return callHostJson<Profile | null>(
    'cognia_profile_get',
    JSON.stringify({ id }),
  );
}

/** Create a profile from the current environment state. Requires: profiles_write */
export function createFromCurrent(name: string, description?: string): string {
  return callHostJson<string>(
    'cognia_profile_create_from_current',
    JSON.stringify({ name, description: description ?? null }),
  );
}

/** Create a profile with explicit entries. Requires: profiles_write */
export function create(profile: ProfileCreateInput): string {
  return callHostJson<string>(
    'cognia_profile_create',
    JSON.stringify(profile),
  );
}

/** Apply (activate) a profile. Requires: profiles_write */
export function apply(id: string): void {
  callHostJson<{ ok: boolean }>(
    'cognia_profile_apply',
    JSON.stringify({ id }),
  );
}

/** Export a profile as JSON string. Requires: profiles_read */
export function exportProfile(id: string): string {
  return callHostJson<string>(
    'cognia_profile_export',
    JSON.stringify({ id }),
  );
}

/** Import a profile from JSON string. Requires: profiles_write */
export function importProfile(json: string): string {
  return callHostJson<string>(
    'cognia_profile_import',
    JSON.stringify({ json }),
  );
}
