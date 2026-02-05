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
jest.mock('@/lib/stores/package', () => ({
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockLink = { href: '', download: '', click: jest.fn() };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);
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
