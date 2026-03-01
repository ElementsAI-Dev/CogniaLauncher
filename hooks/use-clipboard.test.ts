import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '@/hooks/use-clipboard';

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
  readClipboard: jest.fn().mockResolvedValue('pasted text'),
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

  it('should expose copy and paste functions', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(typeof result.current.copy).toBe('function');
    expect(typeof result.current.paste).toBe('function');
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
});
