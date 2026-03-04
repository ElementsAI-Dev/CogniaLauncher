'use client';

import { useCallback } from 'react';
import { writeClipboard, readClipboard } from '@/lib/clipboard';
import { usePackageStore } from '@/lib/stores/packages';
import { toast } from 'sonner';

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

export function usePackageExport() {
  const { installedPackages, bookmarkedPackages } = usePackageStore();

  const exportPackages = useCallback(() => {
    const exportData: ExportedPackageList = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      packages: installedPackages.map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        provider: pkg.provider,
      })),
      bookmarks: bookmarkedPackages,
    };

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
  }, [installedPackages, bookmarkedPackages]);

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
    const packageNames = installedPackages.map(pkg => pkg.name).join('\n');
    
    try {
      await writeClipboard(packageNames);
      toast.success('Package names copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [installedPackages]);

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

  return {
    exportPackages,
    importPackages,
    importFromClipboard,
    exportToClipboard,
  };
}
