import { act, renderHook } from '@testing-library/react';
import { useBackgroundImage } from './use-background-image';

const mockIsTauri = jest.fn(() => false);
const mockSetBackgroundEnabled = jest.fn();
const mockClearBackground = jest.fn();
const mockCompressImage = jest.fn();
const mockSetBackgroundImageData = jest.fn();
const mockNotifyBackgroundChange = jest.fn();
const mockGetBackgroundImage = jest.fn(() => null);
const mockToastError = jest.fn();

jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: () => ({
    backgroundEnabled: false,
    setBackgroundEnabled: (...args: unknown[]) => mockSetBackgroundEnabled(...args),
    clearBackground: (...args: unknown[]) => mockClearBackground(...args),
  }),
}));

jest.mock('@/lib/theme/background', () => ({
  compressImage: (...args: unknown[]) => mockCompressImage(...args),
  setBackgroundImageData: (...args: unknown[]) => mockSetBackgroundImageData(...args),
  getBackgroundImage: (...args: unknown[]) => mockGetBackgroundImage(...args),
  notifyBackgroundChange: (...args: unknown[]) => mockNotifyBackgroundChange(...args),
  BG_CHANGE_EVENT: 'bg-change',
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

describe('useBackgroundImage', () => {
  const t = (k: string) => k;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCompressImage.mockResolvedValue('data:image/png;base64,abc');
  });

  it('clicks file input in non-tauri mode', async () => {
    const { result } = renderHook(() => useBackgroundImage(t));
    const click = jest.fn();
    Object.defineProperty(result.current.fileInputRef, 'current', {
      value: { click, value: '' },
      writable: true,
    });

    await act(async () => {
      await result.current.handleSelectImage();
    });

    expect(click).toHaveBeenCalled();
  });

  it('handles file input change and reports quota errors', async () => {
    const { result } = renderHook(() => useBackgroundImage(t));
    const file = new File(['img'], 'a.png', { type: 'image/png' });
    const quota = new DOMException('quota', 'QuotaExceededError');
    mockCompressImage.mockRejectedValueOnce(quota);

    await act(async () => {
      result.current.handleFileInputChange({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      await Promise.resolve();
    });

    expect(mockToastError).toHaveBeenCalledWith('settings.backgroundTooLarge');
  });
});

