import { renderHook, act } from '@testing-library/react';
import { usePackageStore } from '../../stores/packages';

// Polyfill File.prototype.text for JSDOM
if (!File.prototype.text) {
  File.prototype.text = function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  };
}

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

import { usePackageExport, type ExportedPackageList } from '../use-package-export';
import { toast } from 'sonner';

describe('usePackageExport', () => {
  const mockInstalledPackages = [
    { name: 'package-a', version: '1.0.0', provider: 'npm' },
    { name: 'package-b', version: '2.0.0', provider: 'pip' },
  ];
  const mockBookmarkedPackages = ['package-c', 'package-d'];

  let mockCreateObjectURL: jest.Mock;
  let mockRevokeObjectURL: jest.Mock;
  let mockClick: jest.Mock;
  let realAnchorElement: HTMLAnchorElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store state
    usePackageStore.setState({
      installedPackages: mockInstalledPackages as never[],
      bookmarkedPackages: mockBookmarkedPackages,
    });

    // Mock URL APIs
    mockCreateObjectURL = jest.fn().mockReturnValue('blob:test-url');
    mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Create a real anchor element and spy on click
    realAnchorElement = document.createElement('a');
    mockClick = jest.fn();
    realAnchorElement.click = mockClick;

    // Spy on createElement to track anchor creation
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return realAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to create a mock File with text() method
  function createMockFile(content: string, name: string): File {
    const blob = new Blob([content], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    return file;
  }

  it('exports packages to JSON file', () => {
    const { result } = renderHook(() => usePackageExport());

    let exportData: ExportedPackageList | undefined;
    act(() => {
      exportData = result.current.exportPackages();
    });

    expect(exportData).toBeDefined();
    expect(exportData!.version).toBe('1.0');
    expect(exportData!.packages).toHaveLength(2);
    expect(exportData!.packages[0].name).toBe('package-a');
    expect(exportData!.bookmarks).toEqual(mockBookmarkedPackages);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Package list exported successfully');
  });

  it('exports with correct filename format', () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const { result } = renderHook(() => usePackageExport());

    act(() => {
      result.current.exportPackages();
    });

    expect(realAnchorElement.download).toBe('cognia-packages-2024-01-15.json');

    (global.Date as unknown as jest.SpyInstance).mockRestore();
  });

  it('imports valid package list file', async () => {
    const validExportData: ExportedPackageList = {
      version: '1.0',
      exportedAt: '2024-01-15T10:00:00Z',
      packages: [{ name: 'imported-pkg', version: '1.0.0', provider: 'npm' }],
      bookmarks: ['bookmark-1'],
    };

    const mockFile = createMockFile(JSON.stringify(validExportData), 'packages.json');

    const { result } = renderHook(() => usePackageExport());

    let importedData: ExportedPackageList | null = null;
    await act(async () => {
      importedData = await result.current.importPackages(mockFile);
    });

    expect(importedData).toEqual(validExportData);
    expect(toast.success).toHaveBeenCalledWith('Imported 1 packages');
  });

  it('rejects invalid package list format - missing version', async () => {
    const invalidData = {
      packages: [{ name: 'pkg' }],
      bookmarks: [],
    };

    const mockFile = createMockFile(JSON.stringify(invalidData), 'packages.json');

    const { result } = renderHook(() => usePackageExport());

    let importedData: ExportedPackageList | null = null;
    await act(async () => {
      importedData = await result.current.importPackages(mockFile);
    });

    expect(importedData).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Import failed: Invalid package list format');
  });

  it('rejects invalid package list format - missing packages array', async () => {
    const invalidData = {
      version: '1.0',
      bookmarks: [],
    };

    const mockFile = createMockFile(JSON.stringify(invalidData), 'packages.json');

    const { result } = renderHook(() => usePackageExport());

    let importedData: ExportedPackageList | null = null;
    await act(async () => {
      importedData = await result.current.importPackages(mockFile);
    });

    expect(importedData).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Import failed: Invalid package list format');
  });

  it('rejects invalid package list format - packages not array', async () => {
    const invalidData = {
      version: '1.0',
      packages: 'not an array',
      bookmarks: [],
    };

    const mockFile = createMockFile(JSON.stringify(invalidData), 'packages.json');

    const { result } = renderHook(() => usePackageExport());

    let importedData: ExportedPackageList | null = null;
    await act(async () => {
      importedData = await result.current.importPackages(mockFile);
    });

    expect(importedData).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Import failed: Invalid package list format');
  });

  it('handles invalid JSON in import file', async () => {
    const mockFile = createMockFile('not valid json', 'packages.json');

    const { result } = renderHook(() => usePackageExport());

    let importedData: ExportedPackageList | null = null;
    await act(async () => {
      importedData = await result.current.importPackages(mockFile);
    });

    expect(importedData).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('exports package names to clipboard', async () => {
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('package-a\npackage-b');
    expect(toast.success).toHaveBeenCalledWith('Package names copied to clipboard');
  });

  it('handles clipboard write failure', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Clipboard error'));

    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard');
  });

  it('exports empty packages list', () => {
    usePackageStore.setState({
      installedPackages: [],
      bookmarkedPackages: [],
    });

    const { result } = renderHook(() => usePackageExport());

    let exportData: ExportedPackageList | undefined;
    act(() => {
      exportData = result.current.exportPackages();
    });

    expect(exportData!.packages).toHaveLength(0);
    expect(exportData!.bookmarks).toHaveLength(0);
  });

  it('returns functions with stable references', () => {
    const { result, rerender } = renderHook(() => usePackageExport());

    const { exportPackages, importPackages, exportToClipboard } = result.current;

    rerender();

    expect(result.current.exportPackages).toBe(exportPackages);
    expect(result.current.importPackages).toBe(importPackages);
    expect(result.current.exportToClipboard).toBe(exportToClipboard);
  });
});
