import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CachePage from './page';
import { LocaleProvider } from '@/components/providers/locale-provider';

// Mock the Tauri API
jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn().mockReturnValue(true),
  cacheCleanPreview: jest.fn().mockResolvedValue({
    total_count: 5,
    total_size: 1024000,
    total_size_human: '1 MB',
    files: [
      { path: '/cache/file1.tar.gz', size: 512000, size_human: '500 KB', entry_type: 'download', created_at: '2024-01-15T10:00:00Z' },
      { path: '/cache/file2.tar.gz', size: 512000, size_human: '500 KB', entry_type: 'download', created_at: '2024-01-15T10:00:00Z' },
    ],
  }),
  cacheCleanEnhanced: jest.fn().mockResolvedValue({
    freed_bytes: 1024000,
    freed_human: '1 MB',
    deleted_count: 5,
    use_trash: true,
    history_id: 'history-1',
  }),
  getCleanupHistory: jest.fn().mockResolvedValue([
    {
      id: '1',
      timestamp: '2024-01-15T10:00:00Z',
      clean_type: 'downloads',
      file_count: 10,
      freed_bytes: 5242880,
      freed_human: '5 MB',
      use_trash: true,
      files: [],
      files_truncated: false,
    },
    {
      id: '2',
      timestamp: '2024-01-14T09:00:00Z',
      clean_type: 'metadata',
      file_count: 20,
      freed_bytes: 1048576,
      freed_human: '1 MB',
      use_trash: false,
      files: [],
      files_truncated: false,
    },
  ]),
  getCleanupSummary: jest.fn().mockResolvedValue({
    total_cleanups: 2,
    total_freed_bytes: 6291456,
    total_freed_human: '6 MB',
    total_files_cleaned: 30,
    trash_cleanups: 1,
    permanent_cleanups: 1,
  }),
  clearCleanupHistory: jest.fn().mockResolvedValue(2),
}));

// Mock useSettings hook
jest.mock('@/hooks/use-settings', () => ({
  useSettings: jest.fn().mockReturnValue({
    cacheInfo: {
      download_cache: { entry_count: 10, size: 5242880, size_human: '5 MB', location: '/cache/downloads' },
      metadata_cache: { entry_count: 5, size: 1048576, size_human: '1 MB', location: '/cache/metadata' },
      total_size: 6291456,
      total_size_human: '6 MB',
    },
    cacheSettings: {
      max_size: 10737418240,
      max_age_days: 30,
      metadata_cache_ttl: 3600,
      auto_clean: true,
    },
    cacheVerification: null,
    loading: false,
    error: null,
    cogniaDir: '/home/user/.cognia',
    fetchCacheInfo: jest.fn(),
    fetchPlatformInfo: jest.fn(),
    fetchCacheSettings: jest.fn(),
    cleanCache: jest.fn().mockResolvedValue({ freed_bytes: 1024, freed_human: '1 KB' }),
    verifyCacheIntegrity: jest.fn().mockResolvedValue({ is_healthy: true }),
    repairCache: jest.fn().mockResolvedValue({ removed_entries: 0, recovered_entries: 0, freed_human: '0 B' }),
    updateCacheSettings: jest.fn(),
  }),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock messages with all required cache keys including new ones
const mockMessages = {
  en: {
    common: {
      loading: 'Loading...',
      cancel: 'Cancel',
      save: 'Save',
      refresh: 'Refresh',
    },
    cache: {
      title: 'Cache',
      description: 'Manage download and metadata caches',
      totalSize: 'Total Size',
      location: 'Cache Location',
      locationDesc: 'Cache files are stored here',
      downloadCache: 'Download Cache',
      downloadCacheDesc: 'Cached package downloads',
      metadataCache: 'Metadata Cache',
      metadataCacheDesc: 'Cached package metadata',
      entries: '{count} entries',
      clearAll: 'Clear All',
      clearCache: 'Clear',
      clearing: 'Clearing...',
      clearConfirmTitle: 'Clear Cache',
      clearAllConfirmDesc: 'This will delete all cached files. This action cannot be undone.',
      clearDownload: 'Clear Download Cache',
      clearDownloadConfirmDesc: 'This will delete all downloaded package files.',
      clearMetadata: 'Clear Metadata Cache',
      clearMetadataConfirmDesc: 'This will delete all cached metadata.',
      freed: 'Freed {size}',
      cacheHealth: 'Cache Health',
      cacheHealthDesc: 'Verify cache integrity and repair issues',
      healthy: 'Healthy',
      unhealthy: 'Issues Found',
      verify: 'Verify',
      verifying: 'Verifying...',
      verifySuccess: 'Cache is healthy',
      verifyIssues: '{count} issues found',
      repair: 'Repair',
      repairing: 'Repairing...',
      repairSuccess: 'Repaired {count} issues, freed {size}',
      repairFailed: 'Repair failed',
      validEntries: 'Valid Entries',
      missingFiles: 'Missing Files',
      corruptedFiles: 'Corrupted Files',
      sizeMismatches: 'Size Mismatches',
      issueDetails: 'Issue Details',
      noIssues: 'Run verification to check cache health',
      settings: 'Settings',
      settingsDesc: 'Configure cache behavior',
      maxSize: 'Maximum Size',
      maxSizeDesc: 'Maximum cache size in MB',
      maxAge: 'Maximum Age',
      maxAgeDesc: 'Maximum age of cache entries in days',
      metadataCacheTtl: 'Metadata Cache TTL',
      metadataCacheTtlDesc: 'Seconds before metadata cache expires',
      ttlSeconds: 'seconds',
      autoClean: 'Auto Clean',
      autoCleanDesc: 'Automatically clean old entries',
      settingsSaved: 'Cache settings saved',
      settingsFailed: 'Failed to save cache settings',
      refreshSuccess: 'Cache info refreshed',
      refreshFailed: 'Failed to refresh cache info',
      // New translation keys
      preview: 'Preview',
      previewTitle: 'Clean Preview',
      previewDesc: 'The following {type} files will be cleaned',
      previewFailed: 'Failed to get preview',
      filesToClean: 'Files to Clean',
      spaceToFree: 'Space to Free',
      andMore: 'and {count} more files',
      useTrash: 'Move to Trash',
      useTrashDesc: 'Files will be moved to system trash and can be recovered later',
      permanentDeleteDesc: 'Files will be permanently deleted and cannot be recovered',
      movedToTrash: 'moved to trash',
      permanentlyDeleted: 'permanently deleted',
      confirmClean: 'Confirm Clean',
      cleanupHistory: 'Cleanup History',
      cleanupHistoryDesc: 'View past cache cleanup operations',
      cleanups: 'cleanups',
      totalCleanups: 'Total Cleanups',
      totalFreed: 'Total Freed',
      trashCleanups: 'Trash Cleanups',
      permanentCleanups: 'Permanent Deletes',
      date: 'Date',
      type: 'Type',
      filesCount: 'Files',
      freedSize: 'Freed',
      method: 'Method',
      trash: 'Trash',
      permanent: 'Permanent',
      clearHistory: 'Clear History',
      noHistory: 'No cleanup history yet',
      historyCleared: 'Cleared {count} history records',
      historyClearFailed: 'Failed to clear history',
    },
  },
  zh: {
    common: {
      loading: '加载中...',
      cancel: '取消',
      save: '保存',
      refresh: '刷新',
    },
    cache: {
      title: '缓存',
      description: '管理下载和元数据缓存',
      preview: '预览',
      previewTitle: '清理预览',
      previewDesc: '以下 {type} 类型的文件将被清理',
      previewFailed: '获取预览失败',
      filesToClean: '将清理的文件',
      spaceToFree: '将释放的空间',
      andMore: '还有 {count} 个文件',
      useTrash: '移动到回收站',
      useTrashDesc: '文件将移动到系统回收站，可以稍后恢复',
      permanentDeleteDesc: '文件将被永久删除，无法恢复',
      movedToTrash: '已移动到回收站',
      permanentlyDeleted: '已永久删除',
      confirmClean: '确认清理',
      cleanupHistory: '清理历史',
      cleanupHistoryDesc: '查看过去的缓存清理操作记录',
      cleanups: '次清理',
      totalCleanups: '总清理次数',
      totalFreed: '总释放空间',
      trashCleanups: '回收站清理',
      permanentCleanups: '永久删除',
      date: '日期',
      type: '类型',
      filesCount: '文件数',
      freedSize: '释放大小',
      method: '方式',
      trash: '回收站',
      permanent: '永久删除',
      clearHistory: '清除历史',
      noHistory: '暂无清理历史记录',
      historyCleared: '已清除 {count} 条历史记录',
      historyClearFailed: '清除历史记录失败',
      metadataCacheTtl: '元数据缓存 TTL',
      metadataCacheTtlDesc: '元数据缓存过期时间（秒）',
      ttlSeconds: '秒',
    },
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>
      {children}
    </LocaleProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

describe('CachePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the cache page title', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /cache/i })).toBeInTheDocument();
      });
    });

    it('renders cache size information', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('6 MB')).toBeInTheDocument();
      });
    });

    it('renders download and metadata cache cards', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
        expect(screen.getByText('Metadata Cache')).toBeInTheDocument();
      });
    });
  });

  describe('Preview Feature', () => {
    it('renders preview buttons for download and metadata caches', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        const previewButtons = screen.getAllByRole('button', { name: /preview/i });
        expect(previewButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('opens preview dialog when preview button is clicked', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Clean Preview')).toBeInTheDocument();
      });
    });

    it('displays files to clean and space to free in preview', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Files to Clean')).toBeInTheDocument();
        expect(screen.getByText('Space to Free')).toBeInTheDocument();
      });
    });

    it('displays use trash toggle in preview dialog', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Move to Trash')).toBeInTheDocument();
      });
    });

    it('shows confirm clean button in preview dialog', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm clean/i })).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup History Feature', () => {
    it('renders cleanup history section', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cleanup History')).toBeInTheDocument();
      });
    });

    it('shows cleanup history description', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('View past cache cleanup operations')).toBeInTheDocument();
      });
    });

    it('expands cleanup history when clicked', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cleanup History')).toBeInTheDocument();
      });

      // Click to expand the cleanup history section
      fireEvent.click(screen.getByText('Cleanup History'));

      await waitFor(() => {
        // Should show table headers
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Files')).toBeInTheDocument();
        expect(screen.getByText('Freed')).toBeInTheDocument();
        expect(screen.getByText('Method')).toBeInTheDocument();
      });
    });

    it('shows summary statistics when history is loaded', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cleanup History')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cleanup History'));

      await waitFor(() => {
        expect(screen.getByText('Total Cleanups')).toBeInTheDocument();
        expect(screen.getByText('Total Freed')).toBeInTheDocument();
        expect(screen.getByText('Trash Cleanups')).toBeInTheDocument();
        expect(screen.getByText('Permanent Deletes')).toBeInTheDocument();
      });
    });

    it('shows clear history button', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cleanup History')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cleanup History'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
      });
    });
  });

  describe('Trash/Permanent Delete', () => {
    it('toggles trash description when switch is changed', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Download Cache')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByRole('button', { name: /preview/i });
      fireEvent.click(previewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Move to Trash')).toBeInTheDocument();
        // Default is useTrash = true
        expect(screen.getByText(/files will be moved to system trash/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cache Health', () => {
    it('renders cache health section', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Cache Health')).toBeInTheDocument();
      });
    });

    it('renders verify button', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
      });
    });
  });

  describe('Cache Settings', () => {
    it('renders settings section', async () => {
      renderWithProviders(<CachePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('renders metadata cache TTL setting', async () => {
      renderWithProviders(<CachePage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Settings'));

      await waitFor(() => {
        expect(screen.getByLabelText('Metadata Cache TTL')).toBeInTheDocument();
      });
    });
  });
});
