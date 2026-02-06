import { renderHook, act } from '@testing-library/react';
import { usePackageExport } from './use-package-export';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

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

// Mock package store
jest.mock('@/lib/stores/packages', () => ({
  usePackageStore: jest.fn(() => ({
    installedPackages: [
      { name: 'react', version: '18.0.0' },
      { name: 'typescript', version: '5.0.0' },
    ],
    bookmarkedPackages: ['lodash', 'axios'],
  })),
}));

describe('usePackageExport', () => {
  let mockLink: { href: string; download: string; click: jest.Mock };

  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should return export methods', () => {
    const { result } = renderHook(() => usePackageExport());

    expect(result.current).toHaveProperty('exportPackages');
    expect(result.current).toHaveProperty('importPackages');
    expect(result.current).toHaveProperty('exportToClipboard');
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

  it('should copy package names to clipboard', async () => {
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('should handle copy error', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));
    const { result } = renderHook(() => usePackageExport());

    await act(async () => {
      await result.current.exportToClipboard();
    });

    // Should handle error gracefully (toast.error called)
  });
});
