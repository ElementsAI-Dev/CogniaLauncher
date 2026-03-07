import {
  categorizeUpdateError,
  deriveStatusFromUpdateInfo,
  mapProgressToUpdateStatus,
  normalizeSelfUpdateInfo,
} from './update-lifecycle';

describe('update-lifecycle', () => {
  it('normalizes current/latest versions with fallback', () => {
    const normalized = normalizeSelfUpdateInfo(
      {
        current_version: '',
        latest_version: null,
        update_available: false,
        release_notes: null,
      },
      '1.2.3',
    );

    expect(normalized.current_version).toBe('1.2.3');
    expect(normalized.latest_version).toBe('1.2.3');
  });

  it('derives update status from update info', () => {
    expect(
      deriveStatusFromUpdateInfo({
        current_version: '1.0.0',
        latest_version: '1.1.0',
        update_available: true,
        release_notes: null,
      }),
    ).toBe('update_available');

    expect(
      deriveStatusFromUpdateInfo({
        current_version: '1.0.0',
        latest_version: '1.0.0',
        update_available: false,
        release_notes: null,
      }),
    ).toBe('up_to_date');
  });

  it('maps progress event statuses deterministically', () => {
    expect(mapProgressToUpdateStatus('downloading')).toBe('downloading');
    expect(mapProgressToUpdateStatus('installing')).toBe('installing');
    expect(mapProgressToUpdateStatus('done')).toBe('done');
    expect(mapProgressToUpdateStatus('error')).toBe('error');
  });

  it('categorizes update errors', () => {
    expect(categorizeUpdateError(new Error('network unreachable'))).toBe(
      'network_error',
    );
    expect(categorizeUpdateError(new Error('request timed out'))).toBe(
      'timeout_error',
    );
    expect(categorizeUpdateError(new Error('permission denied'))).toBe(
      'permission_error',
    );
    expect(categorizeUpdateError(new Error('unexpected failure'))).toBe(
      'unknown_error',
    );
  });
});
