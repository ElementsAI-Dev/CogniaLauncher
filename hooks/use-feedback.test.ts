import { renderHook, act } from '@testing-library/react';
import { useFeedback } from './use-feedback';

const mockFeedbackSave = jest.fn();
const mockFeedbackList = jest.fn();
const mockFeedbackDelete = jest.fn();
const mockFeedbackExport = jest.fn();
const mockFeedbackCount = jest.fn();
const mockGetPlatformInfo = jest.fn();

jest.mock('@/lib/platform', () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => false),
  feedbackSave: (...args: unknown[]) => mockFeedbackSave(...args),
  feedbackList: (...args: unknown[]) => mockFeedbackList(...args),
  feedbackDelete: (...args: unknown[]) => mockFeedbackDelete(...args),
  feedbackExport: (...args: unknown[]) => mockFeedbackExport(...args),
  feedbackCount: (...args: unknown[]) => mockFeedbackCount(...args),
  getPlatformInfo: (...args: unknown[]) => mockGetPlatformInfo(...args),
}));

jest.mock('@/lib/app-version', () => ({
  APP_VERSION: '0.1.0-test',
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
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

  it('submitFeedback in web mode triggers JSON download', async () => {
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

    await act(async () => {
      await result.current.submitFeedback(
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

    jest.restoreAllMocks();
  });
});
