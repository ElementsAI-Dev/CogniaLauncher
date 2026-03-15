import { renderHook, act } from '@testing-library/react';
import { usePackageExport } from './use-package-export';

// Mock @/lib/clipboard
jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
  readClipboard: jest.fn().mockResolvedValue(''),
}));

const clipboardMock = jest.requireMock('@/lib/clipboard');

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock URL and document
const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
const mockRevokeObjectURL = jest.fn();
Object.assign(URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

let mockInstalledPackages = [
  { name: 'react', version: '18.0.0', provider: 'npm' },
  { name: 'typescript', version: '5.0.0', provider: 'npm' },
];
let mockBookmarkedPackages = ['lodash', 'axios'];

// Mock package store
jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: jest.fn(() => ({
    installedPackages: mockInstalledPackages,
    bookmarkedPackages: mockBookmarkedPackages,
  })),
}));

describe('usePackageExport', () => {
  let mockLink: { href: string; download: string; click: jest.Mock };

  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.clearAllMocks();
    mockInstalledPackages = [
      { name: 'react', version: '18.0.0', provider: 'npm' },
      { name: 'typescript', version: '5.0.0', provider: 'npm' },
    ];
    mockBookmarkedPackages = ['lodash', 'axios'];
    mockLink = { href: '', download: '', click: jest.fn() };
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'a') return mockLink as unknown as HTMLElement;
      return originalCreateElement(tagName, options);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node === (mockLink as unknown)) return mockLink as unknown as Node;
      return Node.prototype.appendChild.call(document.body, node);
    });
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => {
      if (node === (mockLink as unknown)) return mockLink as unknown as Node;
      return Node.prototype.removeChild.call(document.body, node);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return export and import methods', () => {
    const { result } = renderHook(() => usePackageExport());

    expect(result.current).toHaveProperty('exportPackages');
    expect(result.current).toHaveProperty('importPackages');
    expect(result.current).toHaveProperty('importFromClipboard');
    expect(result.current).toHaveProperty('exportToClipboard');
    expect(result.current).toHaveProperty('getImportPreview');
    expect(result.current).toHaveProperty('getNormalizedBookmarks');
  });

  it('should export packages as JSON', async () => {
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportPackages();
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('should copy manifest JSON to clipboard', async () => {
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    expect(clipboardMock.writeClipboard).toHaveBeenCalled();
    const clipboardPayload = clipboardMock.writeClipboard.mock.calls[0][0] as string;
    const parsed = JSON.parse(clipboardPayload) as {
      packages: Array<{ name: string; provider?: string; version?: string }>;
      bookmarks: string[];
    };
    expect(parsed.packages[0]).toEqual({
      name: 'react',
      provider: 'npm',
      version: '18.0.0',
    });
    expect(parsed.bookmarks).toEqual(['lodash', 'axios']);
  });

  it('should export canonical provider-aware bookmark keys when bookmark context is available', async () => {
    mockInstalledPackages = [
      { name: 'react', version: '18.0.0', provider: 'npm' },
      { name: 'react', version: '1.0.0', provider: 'pip' },
    ];
    mockBookmarkedPackages = ['react'];

    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    const clipboardPayload = clipboardMock.writeClipboard.mock.calls[0][0] as string;
    const parsed = JSON.parse(clipboardPayload) as { bookmarks: string[] };
    expect(parsed.bookmarks).toEqual(['npm:react', 'pip:react']);
  });

  it('should handle copy error', async () => {
    clipboardMock.writeClipboard.mockRejectedValueOnce(new Error('Copy failed'));
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    // Should handle error gracefully (toast.error called)
  });

  describe('importFromClipboard', () => {
    it('should return null for empty clipboard', async () => {
      clipboardMock.readClipboard.mockResolvedValueOnce('');
      const { result } = renderHook(() => usePackageExport());

      let data: unknown = 'not-null';
      await act(async () => {
        data = await result.current.importFromClipboard();
      });

      expect(data).toBeNull();
    });

    it('should parse valid JSON ExportedPackageList from clipboard', async () => {
      const jsonData = JSON.stringify({
        version: '1.0',
        exportedAt: '2025-01-01',
        packages: [{ name: 'react', version: '18.0.0' }],
        bookmarks: [],
      });
      clipboardMock.readClipboard.mockResolvedValueOnce(jsonData);
      const { result } = renderHook(() => usePackageExport());

      let data: unknown = null;
      await act(async () => {
        data = await result.current.importFromClipboard();
      });

      expect(data).not.toBeNull();
      expect((data as { packages: unknown[] }).packages).toHaveLength(1);
      expect((data as { packages: { name: string }[] }).packages[0].name).toBe('react');
    });

    it('should fall back to plain text parsing (one package per line)', async () => {
      clipboardMock.readClipboard.mockResolvedValueOnce('react\ntypescript\nlodash');
      const { result } = renderHook(() => usePackageExport());

      let data: unknown = null;
      await act(async () => {
        data = await result.current.importFromClipboard();
      });

      expect(data).not.toBeNull();
      expect((data as { packages: unknown[] }).packages).toHaveLength(3);
      expect((data as { packages: { name: string }[] }).packages[0].name).toBe('react');
      expect((data as { packages: { name: string }[] }).packages[2].name).toBe('lodash');
    });

    it('should skip empty lines in plain text mode', async () => {
      clipboardMock.readClipboard.mockResolvedValueOnce('react\n\n  \ntypescript\n');
      const { result } = renderHook(() => usePackageExport());

      let data: unknown = null;
      await act(async () => {
        data = await result.current.importFromClipboard();
      });

      expect(data).not.toBeNull();
      expect((data as { packages: unknown[] }).packages).toHaveLength(2);
    });

    it('should return null for whitespace-only clipboard', async () => {
      clipboardMock.readClipboard.mockResolvedValueOnce('   \n  \n  ');
      const { result } = renderHook(() => usePackageExport());

      let data: unknown = null;
      await act(async () => {
        data = await result.current.importFromClipboard();
      });

      expect(data).toBeNull();
    });
  });

  describe('getImportPreview', () => {
    it('classifies installable, skipped, and invalid entries', () => {
      const { result } = renderHook(() => usePackageExport());

      const preview = result.current.getImportPreview({
        version: '1.0',
        exportedAt: '2025-01-01',
        packages: [
          { name: 'react', provider: 'npm', version: '18.0.0' },
          { name: 'react', provider: 'npm', version: '18.0.0' },
          { name: 'requests', provider: 'pip', version: '2.31.0' },
          { name: '   ' },
        ],
        bookmarks: ['lodash'],
      });

      expect(preview.installable).toHaveLength(1);
      expect(preview.installable[0].name).toBe('requests');
      expect(preview.skipped).toHaveLength(2);
      expect(preview.invalid).toHaveLength(1);
    });
  });

  describe('getNormalizedBookmarks', () => {
    it('normalizes imported legacy bookmarks using package provider context', () => {
      const { result } = renderHook(() => usePackageExport());

      expect(
        result.current.getNormalizedBookmarks({
          version: '1.0',
          exportedAt: '2025-01-01',
          packages: [{ name: 'requests', provider: 'pip', version: '2.31.0' }],
          bookmarks: ['requests', 'pip:requests'],
        }),
      ).toEqual(['pip:requests']);
    });
  });
});
