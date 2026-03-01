import { useState, useCallback } from 'react';
import * as tauri from '@/lib/tauri';
import type { GitLfsFile } from '@/types/tauri';

export interface UseGitLfsReturn {
  lfsAvailable: boolean | null;
  lfsVersion: string | null;
  trackedPatterns: string[];
  lfsFiles: GitLfsFile[];

  checkAvailability: () => Promise<void>;
  refreshTrackedPatterns: () => Promise<void>;
  refreshLfsFiles: () => Promise<void>;
  track: (pattern: string) => Promise<string>;
  untrack: (pattern: string) => Promise<string>;
  install: () => Promise<string>;
}

export function useGitLfs(repoPath: string | null): UseGitLfsReturn {
  const [lfsAvailable, setLfsAvailable] = useState<boolean | null>(null);
  const [lfsVersion, setLfsVersion] = useState<string | null>(null);
  const [trackedPatterns, setTrackedPatterns] = useState<string[]>([]);
  const [lfsFiles, setLfsFiles] = useState<GitLfsFile[]>([]);

  const checkAvailability = useCallback(async () => {
    if (!tauri.isTauri()) return;
    try {
      const available = await tauri.gitLfsIsAvailable();
      setLfsAvailable(available);
      if (available) {
        const ver = await tauri.gitLfsGetVersion();
        setLfsVersion(ver);
      }
    } catch {
      setLfsAvailable(false);
    }
  }, []);

  const refreshTrackedPatterns = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setTrackedPatterns(await tauri.gitLfsTrackedPatterns(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const refreshLfsFiles = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) return;
    try {
      setLfsFiles(await tauri.gitLfsLsFiles(repoPath));
    } catch { /* ignore */ }
  }, [repoPath]);

  const track = useCallback(async (pattern: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitLfsTrack(repoPath, pattern);
    await refreshTrackedPatterns();
    return msg;
  }, [repoPath, refreshTrackedPatterns]);

  const untrack = useCallback(async (pattern: string) => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    const msg = await tauri.gitLfsUntrack(repoPath, pattern);
    await refreshTrackedPatterns();
    return msg;
  }, [repoPath, refreshTrackedPatterns]);

  const install = useCallback(async () => {
    if (!tauri.isTauri() || !repoPath) throw new Error('No repo');
    return await tauri.gitLfsInstall(repoPath);
  }, [repoPath]);

  return {
    lfsAvailable,
    lfsVersion,
    trackedPatterns,
    lfsFiles,
    checkAvailability,
    refreshTrackedPatterns,
    refreshLfsFiles,
    track,
    untrack,
    install,
  };
}
