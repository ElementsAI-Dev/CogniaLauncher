'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { isTauri } from '@/lib/platform';
import { getChangelog } from '@/lib/constants/about';
import { compareSemver } from '@/lib/constants/changelog-utils';
import type { ChangelogEntry } from '@/lib/constants/about';
import type { GitHubReleaseInfo } from '@/types/github';

const GITHUB_REPO = 'ElementAstro/CogniaLauncher';
const GITHUB_API_BASE = 'https://api.github.com';

/** In-memory cache so re-opening the dialog doesn't re-fetch */
let cachedRemoteEntries: ChangelogEntry[] | null = null;

/**
 * Convert a GitHubReleaseInfo into a ChangelogEntry.
 * The markdown body is preserved as-is for rendering with MarkdownRenderer.
 */
function releaseToEntry(release: GitHubReleaseInfo): ChangelogEntry {
  const version = release.tagName.replace(/^v/, '');
  const date = release.publishedAt
    ? release.publishedAt.split('T')[0]
    : new Date().toISOString().split('T')[0];

  return {
    version,
    date,
    changes: [],
    markdownBody: release.body || undefined,
    prerelease: release.prerelease,
    url: `https://github.com/${GITHUB_REPO}/releases/tag/${release.tagName}`,
    source: 'remote',
  };
}

/**
 * Fetch releases from GitHub API directly (for web / non-Tauri mode).
 */
async function fetchReleasesFromWeb(): Promise<GitHubReleaseInfo[]> {
  const resp = await fetch(
    `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases?per_page=30`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
  }
  const data = await resp.json();
  // Map snake_case API response to camelCase GitHubReleaseInfo
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    tagName: r.tag_name as string,
    name: (r.name as string) || null,
    body: (r.body as string) || null,
    publishedAt: (r.published_at as string) || null,
    prerelease: r.prerelease as boolean,
    draft: r.draft as boolean,
    assets: [],
  }));
}

export interface UseChangelogReturn {
  /** All entries (merged: remote takes priority over local for same version) */
  entries: ChangelogEntry[];
  /** Whether remote data is currently loading */
  loading: boolean;
  /** Error message if remote fetch failed */
  error: string | null;
  /** Whether remote entries were successfully loaded */
  hasRemote: boolean;
  /** Re-fetch remote entries */
  refresh: () => Promise<void>;
}

export function useChangelog(locale: string): UseChangelogReturn {
  const [remoteEntries, setRemoteEntries] = useState<ChangelogEntry[]>(
    cachedRemoteEntries || [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState(cachedRemoteEntries !== null);
  const fetchedRef = useRef(false);

  const localEntries = getChangelog(locale);

  const fetchRemote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let releases: GitHubReleaseInfo[];

      if (isTauri()) {
        // Use Tauri command (may have GitHub token configured)
        const tauri = await import('@/lib/tauri');
        releases = await tauri.githubListReleases(GITHUB_REPO);
      } else {
        // Direct fetch for web mode (public repo, no auth needed)
        releases = await fetchReleasesFromWeb();
      }

      // Filter out drafts and convert
      const entries = releases
        .filter((r) => !r.draft)
        .map(releaseToEntry);

      cachedRemoteEntries = entries;
      setRemoteEntries(entries);
      setHasRemote(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      console.warn('Failed to fetch remote changelog:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current && cachedRemoteEntries === null) {
      fetchedRef.current = true;
      fetchRemote();
    }
  }, [fetchRemote]);

  // Merge: remote entries take priority over local for same version
  const merged = mergeEntries(localEntries, remoteEntries);

  return {
    entries: merged,
    loading,
    error,
    hasRemote,
    refresh: fetchRemote,
  };
}

/**
 * Merge local and remote entries. Remote entries take priority for matching
 * versions. Final list is sorted by version descending (newest first).
 */
function mergeEntries(
  local: ChangelogEntry[],
  remote: ChangelogEntry[],
): ChangelogEntry[] {
  const versionMap = new Map<string, ChangelogEntry>();

  // Add local entries first
  for (const entry of local) {
    versionMap.set(entry.version, { ...entry, source: 'local' });
  }

  // Remote entries override local for same version
  for (const entry of remote) {
    const existing = versionMap.get(entry.version);
    if (existing && existing.source === 'local') {
      // Merge: keep local structured changes, add remote markdown + metadata
      versionMap.set(entry.version, {
        ...existing,
        markdownBody: entry.markdownBody,
        prerelease: entry.prerelease,
        url: entry.url,
        source: 'remote',
      });
    } else {
      versionMap.set(entry.version, entry);
    }
  }

  // Sort by semantic version descending
  return Array.from(versionMap.values()).sort((a, b) =>
    compareSemver(b.version, a.version),
  );
}
