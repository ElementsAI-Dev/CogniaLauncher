'use client';

import { useCallback } from 'react';
import { writeClipboard, readClipboard } from '@/lib/clipboard';
import { usePackageStore } from '@/lib/stores/packages';
import { toast } from 'sonner';
import { getPackageKeyFromParts, normalizeBookmarkedPackages } from '@/lib/packages';

export interface ExportedPackageList {
  version: string;
  exportedAt: string;
  packages: {
    name: string;
    version?: string;
    provider?: string;
  }[];
  bookmarks: string[];
}

export interface ImportPreviewEntry {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  status: 'installable' | 'skipped' | 'invalid';
  reason?: string;
}

export interface ImportPreviewSummary {
  installable: ImportPreviewEntry[];
  skipped: ImportPreviewEntry[];
  invalid: ImportPreviewEntry[];
}

export function usePackageExport() {
  const { installedPackages, bookmarkedPackages } = usePackageStore();

  const getNormalizedBookmarks = useCallback((data: ExportedPackageList): string[] => (
    normalizeBookmarkedPackages(
      data.bookmarks,
      [...installedPackages, ...data.packages],
      { expandLegacyMatches: true },
    )
  ), [installedPackages]);

  const buildExportData = useCallback((): ExportedPackageList => ({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    packages: installedPackages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      provider: pkg.provider,
    })),
    bookmarks: normalizeBookmarkedPackages(
      bookmarkedPackages,
      installedPackages,
      { expandLegacyMatches: true },
    ),
  }), [installedPackages, bookmarkedPackages]);

  const exportPackages = useCallback(() => {
    const exportData = buildExportData();

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognia-packages-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Package list exported successfully');
    return exportData;
  }, [buildExportData]);

  const importPackages = useCallback(async (file: File): Promise<ExportedPackageList | null> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportedPackageList;

      // Validate the import data
      if (!data.version || !data.packages || !Array.isArray(data.packages)) {
        throw new Error('Invalid package list format');
      }

      toast.success(`Imported ${data.packages.length} packages`);
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${errorMsg}`);
      return null;
    }
  }, []);

  const exportToClipboard = useCallback(async () => {
    const exportData = buildExportData();
    const manifest = JSON.stringify(exportData, null, 2);
    
    try {
      await writeClipboard(manifest);
      toast.success('Package manifest copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [buildExportData]);

  const importFromClipboard = useCallback(async (): Promise<ExportedPackageList | null> => {
    try {
      const text = await readClipboard();
      if (!text?.trim()) return null;

      // Try JSON format first
      try {
        const data = JSON.parse(text) as ExportedPackageList;
        if (data.version && data.packages && Array.isArray(data.packages)) {
          return data;
        }
      } catch {
        // Not JSON — fall through to plain text parsing
      }

      // Plain text: one package name per line
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return null;

      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        packages: lines.map(name => ({ name })),
        bookmarks: [],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${errorMsg}`);
      return null;
    }
  }, []);

  const getImportPreview = useCallback((data: ExportedPackageList): ImportPreviewSummary => {
    const installedVersionKeys = new Set(
      installedPackages.map((pkg) => `${getPackageKeyFromParts(pkg.name, pkg.provider)}@${pkg.version}`),
    );
    const seen = new Set<string>();

    return data.packages.reduce<ImportPreviewSummary>((summary, pkg, index) => {
      const trimmedName = pkg.name.trim();
      const scopedKey = getPackageKeyFromParts(trimmedName, pkg.provider);
      const identityKey = `${scopedKey}@${pkg.version ?? ''}`;
      const entry: ImportPreviewEntry = {
        id: `${identityKey || 'invalid'}:${index}`,
        name: trimmedName,
        provider: pkg.provider,
        version: pkg.version,
        status: 'installable',
      };

      if (!trimmedName) {
        summary.invalid.push({
          ...entry,
          name: pkg.name,
          status: 'invalid',
          reason: 'missing-name',
        });
        return summary;
      }

      if (seen.has(identityKey)) {
        summary.skipped.push({
          ...entry,
          status: 'skipped',
          reason: 'duplicate-entry',
        });
        return summary;
      }
      seen.add(identityKey);

      if (pkg.version && installedVersionKeys.has(identityKey)) {
        summary.skipped.push({
          ...entry,
          status: 'skipped',
          reason: 'already-installed',
        });
        return summary;
      }

      summary.installable.push(entry);
      return summary;
    }, { installable: [], skipped: [], invalid: [] });
  }, [installedPackages]);

  return {
    exportPackages,
    importPackages,
    importFromClipboard,
    exportToClipboard,
    getImportPreview,
    getNormalizedBookmarks,
  };
}
