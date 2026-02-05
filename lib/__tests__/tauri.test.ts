import type { 
  BatchProgress, 
  BatchResult, 
  BatchItemResult, 
  BatchItemError, 
  BatchItemSkipped,
  PackageSummary,
  PackageInfo,
  VersionInfo,
  InstalledPackage,
  ProviderInfo,
  UpdateInfo,
  InstallHistoryEntry,
  DependencyNode,
  CleanPreview,
  CleanPreviewItem,
  EnhancedCleanResult,
  CleanupRecord,
  CleanupHistorySummary,
} from '../tauri';

import { isTauri, getAppVersion, openExternal } from '../tauri';

describe('Tauri Utility Functions', () => {
  describe('isTauri', () => {
    const originalWindow = global.window;

    afterEach(() => {
      // Restore window after each test
      if (originalWindow) {
        global.window = originalWindow;
      }
    });

    it('returns false when window is undefined', () => {
      const windowBackup = global.window;
      // @ts-expect-error - intentionally testing undefined case
      delete global.window;
      
      expect(isTauri()).toBe(false);
      
      global.window = windowBackup;
    });

    it('returns false when __TAURI__ is not in window', () => {
      // Window exists but without __TAURI__
      expect(isTauri()).toBe(false);
    });

    it('returns true when __TAURI__ is in window', () => {
      // Add __TAURI__ to window
      // @ts-expect-error - adding __TAURI__ for testing
      global.window.__TAURI__ = {};
      
      expect(isTauri()).toBe(true);
      
      // Clean up
      // @ts-expect-error - removing __TAURI__ after testing
      delete global.window.__TAURI__;
    });
  });

  describe('getAppVersion', () => {
    it('returns null when window is undefined', async () => {
      const windowBackup = global.window;
      // @ts-expect-error - intentionally testing undefined case
      delete global.window;
      
      const version = await getAppVersion();
      expect(version).toBeNull();
      
      global.window = windowBackup;
    });

    it('returns null when not in Tauri environment', async () => {
      // Window exists but no __TAURI__
      const version = await getAppVersion();
      expect(version).toBeNull();
    });
  });

  describe('openExternal', () => {
    it('does nothing when window is undefined', async () => {
      const windowBackup = global.window;
      // @ts-expect-error - intentionally testing undefined case
      delete global.window;
      
      // Should not throw
      await expect(openExternal('https://example.com')).resolves.toBeUndefined();
      
      global.window = windowBackup;
    });

    it('opens URL in new tab when not in Tauri environment', async () => {
      const mockOpen = jest.fn();
      const originalOpen = global.window.open;
      global.window.open = mockOpen;
      
      await openExternal('https://example.com');
      
      expect(mockOpen).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );
      
      // Restore original
      global.window.open = originalOpen;
    });
  });
});

describe('Tauri Types', () => {
  describe('BatchProgress', () => {
    it('should have correct starting type structure', () => {
      const progress: BatchProgress = { type: 'starting', total: 5 };
      expect(progress.type).toBe('starting');
      expect(progress.total).toBe(5);
    });

    it('should have correct resolving type structure', () => {
      const progress: BatchProgress = { 
        type: 'resolving', 
        package: 'lodash', 
        current: 1, 
        total: 5 
      };
      expect(progress.type).toBe('resolving');
      expect(progress.package).toBe('lodash');
    });

    it('should have correct downloading type structure', () => {
      const progress: BatchProgress = { 
        type: 'downloading', 
        package: 'lodash', 
        progress: 0.5, 
        current: 1, 
        total: 5 
      };
      expect(progress.type).toBe('downloading');
      expect(progress.progress).toBe(0.5);
    });

    it('should have correct installing type structure', () => {
      const progress: BatchProgress = { 
        type: 'installing', 
        package: 'lodash', 
        current: 1, 
        total: 5 
      };
      expect(progress.type).toBe('installing');
    });

    it('should have correct item_completed type structure', () => {
      const progress: BatchProgress = { 
        type: 'item_completed', 
        package: 'lodash', 
        success: true, 
        current: 1, 
        total: 5 
      };
      expect(progress.type).toBe('item_completed');
      expect(progress.success).toBe(true);
    });
  });

  describe('BatchResult', () => {
    it('should have correct structure', () => {
      const result: BatchResult = {
        successful: [],
        failed: [],
        skipped: [],
        total_time_ms: 1000,
      };
      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.total_time_ms).toBe(1000);
    });

    it('should accept successful items', () => {
      const item: BatchItemResult = {
        name: 'lodash',
        version: '4.17.21',
        provider: 'npm',
        action: 'install',
      };
      const result: BatchResult = {
        successful: [item],
        failed: [],
        skipped: [],
        total_time_ms: 500,
      };
      expect(result.successful.length).toBe(1);
      expect(result.successful[0].name).toBe('lodash');
    });

    it('should accept failed items', () => {
      const error: BatchItemError = {
        name: 'broken-pkg',
        error: 'Installation failed',
        recoverable: true,
        suggestion: 'Try again later',
      };
      const result: BatchResult = {
        successful: [],
        failed: [error],
        skipped: [],
        total_time_ms: 500,
      };
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].recoverable).toBe(true);
    });

    it('should accept skipped items', () => {
      const skipped: BatchItemSkipped = {
        name: 'lodash',
        reason: 'Already installed',
      };
      const result: BatchResult = {
        successful: [],
        failed: [],
        skipped: [skipped],
        total_time_ms: 100,
      };
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].reason).toBe('Already installed');
    });
  });

  describe('PackageSummary', () => {
    it('should have correct structure', () => {
      const summary: PackageSummary = {
        name: 'lodash',
        description: 'A modern JavaScript utility library',
        latest_version: '4.17.21',
        provider: 'npm',
      };
      expect(summary.name).toBe('lodash');
      expect(summary.description).toBe('A modern JavaScript utility library');
      expect(summary.latest_version).toBe('4.17.21');
      expect(summary.provider).toBe('npm');
    });

    it('should allow null description and version', () => {
      const summary: PackageSummary = {
        name: 'unknown-pkg',
        description: null,
        latest_version: null,
        provider: 'npm',
      };
      expect(summary.description).toBeNull();
      expect(summary.latest_version).toBeNull();
    });
  });

  describe('PackageInfo', () => {
    it('should have correct structure', () => {
      const info: PackageInfo = {
        name: 'lodash',
        display_name: 'Lodash',
        description: 'A modern JavaScript utility library',
        homepage: 'https://lodash.com',
        license: 'MIT',
        repository: 'https://github.com/lodash/lodash',
        versions: [],
        provider: 'npm',
      };
      expect(info.name).toBe('lodash');
      expect(info.display_name).toBe('Lodash');
      expect(info.versions).toEqual([]);
    });

    it('should accept version info array', () => {
      const version: VersionInfo = {
        version: '4.17.21',
        release_date: '2021-02-20',
        deprecated: false,
        yanked: false,
      };
      const info: PackageInfo = {
        name: 'lodash',
        display_name: null,
        description: null,
        homepage: null,
        license: null,
        repository: null,
        versions: [version],
        provider: 'npm',
      };
      expect(info.versions.length).toBe(1);
      expect(info.versions[0].version).toBe('4.17.21');
    });
  });

  describe('InstalledPackage', () => {
    it('should have correct structure', () => {
      const pkg: InstalledPackage = {
        name: 'lodash',
        version: '4.17.21',
        provider: 'npm',
        install_path: '/usr/local/lib/node_modules/lodash',
        installed_at: '2024-01-01T00:00:00Z',
        is_global: true,
      };
      expect(pkg.name).toBe('lodash');
      expect(pkg.is_global).toBe(true);
    });
  });

  describe('ProviderInfo', () => {
    it('should have correct structure', () => {
      const provider: ProviderInfo = {
        id: 'npm',
        display_name: 'npm',
        capabilities: ['install', 'uninstall', 'search'],
        platforms: ['windows', 'macos', 'linux'],
        priority: 100,
        is_environment_provider: false,
        enabled: true,
      };
      expect(provider.id).toBe('npm');
      expect(provider.capabilities).toContain('install');
      expect(provider.is_environment_provider).toBe(false);
    });
  });

  describe('UpdateInfo', () => {
    it('should have correct structure', () => {
      const update: UpdateInfo = {
        name: 'lodash',
        current_version: '4.17.20',
        latest_version: '4.17.21',
        provider: 'npm',
        update_type: 'patch',
      };
      expect(update.name).toBe('lodash');
      expect(update.update_type).toBe('patch');
    });
  });

  describe('InstallHistoryEntry', () => {
    it('should have correct structure', () => {
      const entry: InstallHistoryEntry = {
        id: '123',
        name: 'lodash',
        version: '4.17.21',
        action: 'install',
        timestamp: '2024-01-01T00:00:00Z',
        provider: 'npm',
        success: true,
        error_message: null,
      };
      expect(entry.id).toBe('123');
      expect(entry.success).toBe(true);
      expect(entry.error_message).toBeNull();
    });

    it('should accept error message for failed entries', () => {
      const entry: InstallHistoryEntry = {
        id: '124',
        name: 'broken-pkg',
        version: '1.0.0',
        action: 'install',
        timestamp: '2024-01-01T00:00:00Z',
        provider: 'npm',
        success: false,
        error_message: 'Installation failed: network error',
      };
      expect(entry.success).toBe(false);
      expect(entry.error_message).toBe('Installation failed: network error');
    });
  });

  describe('DependencyNode', () => {
    it('should have correct structure', () => {
      const node: DependencyNode = {
        name: 'lodash',
        version: '4.17.21',
        constraint: '^4.0.0',
        provider: 'npm',
        dependencies: [],
        is_direct: true,
        is_installed: false,
        is_conflict: false,
        conflict_reason: null,
        depth: 0,
      };
      expect(node.name).toBe('lodash');
      expect(node.is_direct).toBe(true);
      expect(node.dependencies).toEqual([]);
    });

    it('should handle nested dependencies', () => {
      const childNode: DependencyNode = {
        name: 'lodash',
        version: '4.17.21',
        constraint: '^4.0.0',
        provider: 'npm',
        dependencies: [],
        is_direct: false,
        is_installed: true,
        is_conflict: false,
        conflict_reason: null,
        depth: 1,
      };
      const parentNode: DependencyNode = {
        name: 'express',
        version: '4.18.0',
        constraint: '^4.0.0',
        provider: 'npm',
        dependencies: [childNode],
        is_direct: true,
        is_installed: false,
        is_conflict: false,
        conflict_reason: null,
        depth: 0,
      };
      expect(parentNode.dependencies.length).toBe(1);
      expect(parentNode.dependencies[0].name).toBe('lodash');
    });

    it('should handle conflict information', () => {
      const node: DependencyNode = {
        name: 'lodash',
        version: '',
        constraint: '^4.0.0',
        provider: 'npm',
        dependencies: [],
        is_direct: true,
        is_installed: false,
        is_conflict: true,
        conflict_reason: 'Version conflict: requires ^4.0.0 but ^3.0.0 is also required',
        depth: 0,
      };
      expect(node.is_conflict).toBe(true);
      expect(node.conflict_reason).toContain('Version conflict');
    });
  });

  describe('CleanPreviewItem', () => {
    it('should have correct structure', () => {
      const item: CleanPreviewItem = {
        path: '/cache/downloads/package-1.0.0.tar.gz',
        size: 1048576,
        size_human: '1.00 MB',
        entry_type: 'download',
        created_at: '2024-01-15T10:30:00Z',
      };
      expect(item.path).toBe('/cache/downloads/package-1.0.0.tar.gz');
      expect(item.size).toBe(1048576);
      expect(item.size_human).toBe('1.00 MB');
      expect(item.entry_type).toBe('download');
      expect(item.created_at).toBe('2024-01-15T10:30:00Z');
    });
  });

  describe('CleanPreview', () => {
    it('should have correct structure', () => {
      const preview: CleanPreview = {
        files: [],
        total_count: 0,
        total_size: 0,
        total_size_human: '0 B',
      };
      expect(preview.files).toEqual([]);
      expect(preview.total_count).toBe(0);
      expect(preview.total_size).toBe(0);
      expect(preview.total_size_human).toBe('0 B');
    });

    it('should accept file items', () => {
      const item: CleanPreviewItem = {
        path: '/cache/downloads/pkg.tar.gz',
        size: 2048,
        size_human: '2.00 KB',
        entry_type: 'download',
        created_at: '2024-01-15T10:30:00Z',
      };
      const preview: CleanPreview = {
        files: [item],
        total_count: 1,
        total_size: 2048,
        total_size_human: '2.00 KB',
      };
      expect(preview.files.length).toBe(1);
      expect(preview.files[0].path).toBe('/cache/downloads/pkg.tar.gz');
    });
  });

  describe('EnhancedCleanResult', () => {
    it('should have correct structure for permanent delete', () => {
      const result: EnhancedCleanResult = {
        freed_bytes: 5242880,
        freed_human: '5.00 MB',
        deleted_count: 10,
        use_trash: false,
        history_id: 'abc123',
      };
      expect(result.freed_bytes).toBe(5242880);
      expect(result.freed_human).toBe('5.00 MB');
      expect(result.deleted_count).toBe(10);
      expect(result.use_trash).toBe(false);
      expect(result.history_id).toBe('abc123');
    });

    it('should have correct structure for trash', () => {
      const result: EnhancedCleanResult = {
        freed_bytes: 1024,
        freed_human: '1.00 KB',
        deleted_count: 1,
        use_trash: true,
        history_id: 'def456',
      };
      expect(result.use_trash).toBe(true);
    });
  });

  describe('CleanupRecord', () => {
    it('should have correct structure', () => {
      const record: CleanupRecord = {
        id: 'record-123',
        timestamp: '2024-01-15T10:30:00Z',
        clean_type: 'downloads',
        use_trash: true,
        freed_bytes: 10485760,
        freed_human: '10.00 MB',
        file_count: 25,
        files: [
          { path: '/cache/pkg1.tar.gz', size: 1024, size_human: '1.00 KB', entry_type: 'download' },
        ],
        files_truncated: true,
      };
      expect(record.id).toBe('record-123');
      expect(record.timestamp).toBe('2024-01-15T10:30:00Z');
      expect(record.clean_type).toBe('downloads');
      expect(record.use_trash).toBe(true);
      expect(record.freed_bytes).toBe(10485760);
      expect(record.freed_human).toBe('10.00 MB');
      expect(record.file_count).toBe(25);
      expect(record.files.length).toBe(1);
      expect(record.files_truncated).toBe(true);
    });

    it('should accept different clean types', () => {
      const metadataRecord: CleanupRecord = {
        id: 'record-456',
        timestamp: '2024-01-15T11:00:00Z',
        clean_type: 'metadata',
        use_trash: false,
        freed_bytes: 512,
        freed_human: '512 B',
        file_count: 3,
        files: [],
        files_truncated: false,
      };
      expect(metadataRecord.clean_type).toBe('metadata');
      expect(metadataRecord.use_trash).toBe(false);
      expect(metadataRecord.files).toEqual([]);
      expect(metadataRecord.files_truncated).toBe(false);
    });
  });

  describe('CleanupHistorySummary', () => {
    it('should have correct structure', () => {
      const summary: CleanupHistorySummary = {
        total_cleanups: 50,
        total_freed_bytes: 1073741824,
        total_freed_human: '1.00 GB',
        total_files_cleaned: 500,
        trash_cleanups: 30,
        permanent_cleanups: 20,
      };
      expect(summary.total_cleanups).toBe(50);
      expect(summary.total_freed_bytes).toBe(1073741824);
      expect(summary.total_freed_human).toBe('1.00 GB');
      expect(summary.total_files_cleaned).toBe(500);
      expect(summary.trash_cleanups).toBe(30);
      expect(summary.permanent_cleanups).toBe(20);
    });

    it('should handle zero values', () => {
      const summary: CleanupHistorySummary = {
        total_cleanups: 0,
        total_freed_bytes: 0,
        total_freed_human: '0 B',
        total_files_cleaned: 0,
        trash_cleanups: 0,
        permanent_cleanups: 0,
      };
      expect(summary.total_cleanups).toBe(0);
      expect(summary.total_files_cleaned).toBe(0);
    });
  });
});
