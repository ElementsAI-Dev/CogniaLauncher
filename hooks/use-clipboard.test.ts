import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
  readClipboard: jest.fn().mockResolvedValue('pasted text'),
  writeClipboardImage: jest.fn().mockResolvedValue(undefined),
  readClipboardImage: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  clearClipboard: jest.fn().mockResolvedValue(undefined),
}));

const clipboard = jest.requireMock('@/lib/clipboard');

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have initial copied state as false', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('should expose copy, paste, copyImage, pasteImage, and clear functions', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(typeof result.current.copy).toBe('function');
    expect(typeof result.current.paste).toBe('function');
    expect(typeof result.current.copyImage).toBe('function');
    expect(typeof result.current.pasteImage).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
    expect(result.current.error).toBeNull();
  });

  it('should set copied to true after copy', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);
    expect(clipboard.writeClipboard).toHaveBeenCalledWith('hello');
  });

  it('should reset copied to false after timeout', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1000));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(false);
  });

  it('should use default timeout of 1500ms', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1499);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it('should call readClipboard on paste', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    let text = '';
    await act(async () => {
      text = await result.current.paste();
    });
    expect(text).toBe('pasted text');
    expect(clipboard.readClipboard).toHaveBeenCalled();
  });

  it('should reset timer on rapid successive copies', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1000));

    await act(async () => {
      await result.current.copy('first');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      await result.current.copy('second');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(800);
    });
    // Should still be true because second copy reset the timer
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.copied).toBe(false);
  });

  it('should call writeClipboard with the provided text', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('test string 123');
    });
    expect(clipboard.writeClipboard).toHaveBeenCalledTimes(1);
    expect(clipboard.writeClipboard).toHaveBeenCalledWith('test string 123');
  });

  it('should call writeClipboardImage and set copied on copyImage', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const imageData = new Uint8Array([1, 2, 3]);
    await act(async () => {
      await result.current.copyImage(imageData);
    });
    expect(clipboard.writeClipboardImage).toHaveBeenCalledWith(imageData);
    expect(result.current.copied).toBe(true);
  });

  it('should reset copied after timeout on copyImage', async () => {
    const { result } = renderHook(() => useCopyToClipboard(1000));
    await act(async () => {
      await result.current.copyImage(new Uint8Array([1]));
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(false);
  });

  it('should call readClipboardImage on pasteImage', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    let image: Uint8Array | null = null;
    await act(async () => {
      image = await result.current.pasteImage();
    });
    expect(clipboard.readClipboardImage).toHaveBeenCalled();
    expect(image).toBeInstanceOf(Uint8Array);
  });

  it('should call clearClipboard on clear', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.clear();
    });
    expect(clipboard.clearClipboard).toHaveBeenCalled();
  });

  it('captures clipboard write failures as recoverable hook error state', async () => {
    clipboard.writeClipboard.mockRejectedValueOnce(new Error('copy failed'));

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe('copy failed');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('captures clipboard read failures and returns a null fallback', async () => {
    clipboard.readClipboard.mockRejectedValueOnce(new Error('paste failed'));

    const { result } = renderHook(() => useCopyToClipboard());

    let text: string | null = 'initial';
    await act(async () => {
      text = await result.current.paste();
    });

    expect(text).toBeNull();
    expect(result.current.error).toBe('paste failed');
  });
});
