import { act, renderHook } from '@testing-library/react';
import { useProviderStatus } from './use-provider-status';

describe('useProviderStatus', () => {
  it('checks status and updates availability', async () => {
    const onCheckStatus = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useProviderStatus('homebrew', undefined, onCheckStatus),
    );

    await act(async () => {
      await result.current.handleCheckStatus();
    });

    expect(onCheckStatus).toHaveBeenCalledWith('homebrew');
    expect(result.current.availabilityStatus).toBe(true);
    expect(result.current.isChecking).toBe(false);
  });

  it('resets checking state when check throws', async () => {
    const onCheckStatus = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useProviderStatus('brew', false, onCheckStatus),
    );

    await expect(
      act(async () => {
        await result.current.handleCheckStatus();
      }),
    ).rejects.toThrow('boom');

    expect(result.current.isChecking).toBe(false);
    expect(result.current.availabilityStatus).toBe(false);
  });
});

