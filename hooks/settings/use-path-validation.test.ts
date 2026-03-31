import { act, renderHook } from '@testing-library/react';
import { usePathValidation } from './use-path-validation';

const mockIsTauri = jest.fn(() => true);
const mockValidatePath = jest.fn();
const mockPreValidatePath = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  validatePath: (...args: unknown[]) => mockValidatePath(...args),
}));

jest.mock('@/lib/validation/path', () => ({
  preValidatePath: (...args: unknown[]) => mockPreValidatePath(...args),
}));

describe('usePathValidation', () => {
  const t = (k: string) => k;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPreValidatePath.mockReturnValue({ ok: true });
    mockValidatePath.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs backend validation and sets valid status', async () => {
    const { result } = renderHook(() => usePathValidation({ value: '/tmp', t }));

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockValidatePath).toHaveBeenCalledWith('/tmp', true);
    expect(result.current.status).toBe('valid');
  });

  it('stops at client pre-validation errors', async () => {
    mockPreValidatePath.mockReturnValue({ ok: false, error: 'bad-path' });
    const { result } = renderHook(() => usePathValidation({ value: 'xx', t }));

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(mockValidatePath).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.clientError).toBe('bad-path');
  });
});

