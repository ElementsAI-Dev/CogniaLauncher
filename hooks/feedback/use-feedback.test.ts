import { renderHook, act } from '@testing-library/react';
import { useFeedback } from './use-feedback';

const mockFeedbackSave = jest.fn();
const mockFeedbackList = jest.fn();
const mockFeedbackDelete = jest.fn();
const mockFeedbackExport = jest.fn();
const mockFeedbackCount = jest.fn();
const mockIsTauri = jest.fn(() => false);
const mockGetOsLabel = jest.fn(() => 'Windows');
const mockGetOsVersion = jest.fn(() => '11');
const mockGetArch = jest.fn(() => 'x86_64');
const mockToastSuccess = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri(),
  getOsLabel: () => mockGetOsLabel(),
  getOsVersion: () => mockGetOsVersion(),
  getArch: () => mockGetArch(),
}));

jest.mock('@/lib/tauri', () => ({
  feedbackSave: (...args: unknown[]) => mockFeedbackSave(...args),
  feedbackList: (...args: unknown[]) => mockFeedbackList(...args),
  feedbackDelete: (...args: unknown[]) => mockFeedbackDelete(...args),
  feedbackExport: (...args: unknown[]) => mockFeedbackExport(...args),
  feedbackCount: (...args: unknown[]) => mockFeedbackCount(...args),
}));

jest.mock('@/lib/app-version', () => ({
  APP_VERSION: '0.1.0-test',
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockOpenDialog = jest.fn();
const mockCloseDialog = jest.fn();
jest.mock('@/lib/stores/feedback', () => ({
  useFeedbackStore: () => ({
    openDialog: mockOpenDialog,
    closeDialog: mockCloseDialog,
  }),
}));

const mockT = (key: string) => key;

describe('useFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it('returns expected interface', () => {
    const { result } = renderHook(() => useFeedback());
    expect(result.current.submitting).toBe(false);
    expect(typeof result.current.submitFeedback).toBe('function');
    expect(typeof result.current.openFeedbackDialog).toBe('function');
    expect(typeof result.current.closeFeedbackDialog).toBe('function');
    expect(typeof result.current.listFeedbacks).toBe('function');
    expect(typeof result.current.deleteFeedback).toBe('function');
    expect(typeof result.current.exportFeedbackJson).toBe('function');
    expect(typeof result.current.feedbackCount).toBe('function');
  });

  it('openFeedbackDialog calls store openDialog', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.openFeedbackDialog({ category: 'bug' });
    });
    expect(mockOpenDialog).toHaveBeenCalledWith({ category: 'bug' });
  });

  it('openFeedbackDialog forwards releaseContext to the store', () => {
    const { result } = renderHook(() => useFeedback());
    const releaseContext = {
      version: '1.2.3',
      date: '2026-03-16',
      source: 'remote' as const,
      trigger: 'whats_new' as const,
      url: 'https://github.com/test/releases/tag/v1.2.3',
    };

    act(() => {
      result.current.openFeedbackDialog({
        category: 'bug',
        releaseContext,
      });
    });

    expect(mockOpenDialog).toHaveBeenCalledWith({
      category: 'bug',
      releaseContext,
    });
  });

  it('closeFeedbackDialog calls store closeDialog', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.closeFeedbackDialog();
    });
    expect(mockCloseDialog).toHaveBeenCalled();
  });

  it('listFeedbacks returns empty array in web mode', async () => {
    const { result } = renderHook(() => useFeedback());
    const items = await result.current.listFeedbacks();
    expect(items).toEqual([]);
  });

  it('feedbackCount returns 0 in web mode', async () => {
    const { result } = renderHook(() => useFeedback());
    const count = await result.current.feedbackCount();
    expect(count).toBe(0);
  });

  it('submitFeedback in web mode returns a success outcome', async () => {
    const mockClick = jest.fn();
    const mockAnchor = { href: '', download: '', click: mockClick };

    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tag);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const createObjectURL = jest.fn(() => 'blob:test');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const { result } = renderHook(() => useFeedback());

    let outcome;

    await act(async () => {
      outcome = await result.current.submitFeedback(
        {
          category: 'bug',
          title: 'Test bug',
          description: 'Test desc',
          includeDiagnostics: false,
        },
        mockT,
      );
    });

    expect(mockClick).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    expect(outcome).toEqual({ success: true, mode: 'web' });
    expect(mockToastSuccess).toHaveBeenCalledWith('feedback.submitSuccessWeb');

    jest.restoreAllMocks();
  });

  it('submitFeedback in tauri mode returns a tauri success outcome', async () => {
    mockIsTauri.mockReturnValue(true);
    mockFeedbackSave.mockResolvedValueOnce({ id: 'fb-1', path: '/tmp/fb-1.json' });

    const { result } = renderHook(() => useFeedback());

    let outcome;

    await act(async () => {
      outcome = await result.current.submitFeedback(
        {
          category: 'bug',
          title: 'Test bug',
          description: 'Test desc',
          includeDiagnostics: false,
          releaseContext: {
            version: '1.2.3',
            date: '2026-03-16',
            source: 'remote',
            trigger: 'changelog',
            url: 'https://github.com/test/releases/tag/v1.2.3',
          },
        },
        mockT,
      );
    });

    expect(mockFeedbackSave).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'bug',
        title: 'Test bug',
        os: 'Windows 11',
        arch: 'x86_64',
        releaseContext: {
          version: '1.2.3',
          date: '2026-03-16',
          source: 'remote',
          trigger: 'changelog',
          url: 'https://github.com/test/releases/tag/v1.2.3',
        },
      }),
    );
    expect(outcome).toEqual({
      success: true,
      mode: 'tauri',
      result: { id: 'fb-1', path: '/tmp/fb-1.json' },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('feedback.submitSuccess', {
      description: 'feedback.submitSuccessDesc',
    });
  });

  it('submitFeedback returns a failure outcome when submission throws', async () => {
    const createObjectURL = jest.fn(() => {
      throw new Error('blob failed');
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.URL.createObjectURL = createObjectURL;

    const { result } = renderHook(() => useFeedback());

    let outcome;

    await act(async () => {
      outcome = await result.current.submitFeedback(
        {
          category: 'bug',
          title: 'Test bug',
          description: 'Test desc',
          includeDiagnostics: false,
        },
        mockT,
      );
    });

    expect(outcome).toEqual({ success: false });
    expect(mockToastError).toHaveBeenCalledWith('feedback.submitFailed');

    consoleErrorSpy.mockRestore();
  });
});
