import { act, renderHook } from '@testing-library/react';
import { useProviderStatus } from './use-provider-status';

describe('useProviderStatus', () => {
  it('checks status and stores normalized provider status', async () => {
    const onCheckStatus = jest.fn().mockResolvedValue({
      id: 'homebrew',
      display_name: 'Homebrew',
      installed: false,
      platforms: ['macos'],
      scope_state: 'timeout',
      reason: 'Timed out',
    });
    const { result } = renderHook(() =>
      useProviderStatus('homebrew', undefined, onCheckStatus),
    );

    await act(async () => {
      await result.current.handleCheckStatus();
    });

    expect(onCheckStatus).toHaveBeenCalledWith('homebrew');
    expect(result.current.availabilityStatus).toBe(false);
    expect(result.current.statusInfo?.scope_state).toBe('timeout');
    expect(result.current.isChecking).toBe(false);
  });

  it('resets checking state when check throws', async () => {
    const onCheckStatus = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useProviderStatus(
        'brew',
        {
          id: 'brew',
          display_name: 'brew',
          installed: false,
          platforms: ['macos'],
          scope_state: 'unsupported',
        },
        onCheckStatus,
      ),
    );

    await expect(
      act(async () => {
        await result.current.handleCheckStatus();
      }),
    ).rejects.toThrow('boom');

    expect(result.current.isChecking).toBe(false);
    expect(result.current.availabilityStatus).toBe(false);
    expect(result.current.statusInfo?.scope_state).toBe('unsupported');
  });
});
