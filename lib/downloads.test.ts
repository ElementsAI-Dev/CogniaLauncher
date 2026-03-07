import {
  isValidUrl,
  inferNameFromUrl,
  joinDestinationPath,
  getStateBadgeVariant,
  findClosestPriority,
  normalizeDownloadFailure,
  runDownloadPreflight,
  runDownloadPreflightWithUi,
} from './downloads';

describe('isValidUrl', () => {
  it('returns true for valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('returns true for valid https URL', () => {
    expect(isValidUrl('https://example.com/file.zip')).toBe(true);
  });

  it('returns true for URL with query params', () => {
    expect(isValidUrl('https://example.com/path?q=1&v=2')).toBe(true);
  });

  it('returns true for URL with port', () => {
    expect(isValidUrl('http://localhost:3000/api')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('returns false for partial URL without scheme', () => {
    expect(isValidUrl('example.com/file.zip')).toBe(false);
  });

  it('returns true for ftp URL', () => {
    expect(isValidUrl('ftp://files.example.com/archive.tar.gz')).toBe(true);
  });
});

describe('inferNameFromUrl', () => {
  it('extracts filename from simple URL', () => {
    expect(inferNameFromUrl('https://example.com/file.zip')).toBe('file.zip');
  });

  it('extracts filename from nested path', () => {
    expect(inferNameFromUrl('https://cdn.example.com/releases/v1.0/app-linux-x64.tar.gz')).toBe('app-linux-x64.tar.gz');
  });

  it('returns "download" for URL with no path segments', () => {
    expect(inferNameFromUrl('https://example.com')).toBe('download');
  });

  it('returns "download" for URL with only slash', () => {
    expect(inferNameFromUrl('https://example.com/')).toBe('download');
  });

  it('handles URL with query parameters (extracts last path segment)', () => {
    expect(inferNameFromUrl('https://example.com/file.zip?token=abc')).toBe('file.zip');
  });

  it('falls back to splitting for invalid URL', () => {
    expect(inferNameFromUrl('not-a-url/but/has/segments/file.bin')).toBe('file.bin');
  });

  it('returns "download" for completely empty invalid URL', () => {
    expect(inferNameFromUrl('')).toBe('download');
  });

  it('handles GitHub release URLs', () => {
    expect(
      inferNameFromUrl('https://github.com/owner/repo/releases/download/v1.0.0/app-windows-x64.exe')
    ).toBe('app-windows-x64.exe');
  });
});

describe('joinDestinationPath', () => {
  it('joins POSIX paths without duplicating separators', () => {
    expect(joinDestinationPath('/downloads/', 'file.zip')).toBe('/downloads/file.zip');
  });

  it('joins Windows paths with backslashes', () => {
    expect(joinDestinationPath('C:\\Downloads\\', 'file.zip')).toBe('C:\\Downloads\\file.zip');
  });

  it('normalizes leading separators from filename', () => {
    expect(joinDestinationPath('/downloads', '/nested/file.zip')).toBe('/downloads/nested/file.zip');
  });
});

describe('getStateBadgeVariant', () => {
  it('returns "default" for completed state', () => {
    expect(getStateBadgeVariant('completed')).toBe('default');
  });

  it('returns "destructive" for failed state', () => {
    expect(getStateBadgeVariant('failed')).toBe('destructive');
  });

  it('returns "destructive" for cancelled state', () => {
    expect(getStateBadgeVariant('cancelled')).toBe('destructive');
  });

  it('returns "secondary" for paused state', () => {
    expect(getStateBadgeVariant('paused')).toBe('secondary');
  });

  it('returns "outline" for downloading state', () => {
    expect(getStateBadgeVariant('downloading')).toBe('outline');
  });

  it('returns "outline" for queued state', () => {
    expect(getStateBadgeVariant('queued')).toBe('outline');
  });
});

describe('findClosestPriority', () => {
  it('returns exact match for critical (10)', () => {
    expect(findClosestPriority(10)).toBe('10');
  });

  it('returns exact match for high (8)', () => {
    expect(findClosestPriority(8)).toBe('8');
  });

  it('returns exact match for normal (5)', () => {
    expect(findClosestPriority(5)).toBe('5');
  });

  it('returns exact match for low (1)', () => {
    expect(findClosestPriority(1)).toBe('1');
  });

  it('returns closest for value between high and critical (9)', () => {
    expect(findClosestPriority(9)).toBe('10');
  });

  it('returns closest for value between normal and high (7)', () => {
    expect(findClosestPriority(7)).toBe('8');
  });

  it('returns closest for value between low and normal (3)', () => {
    // 3 is equidistant from 1 (diff=2) and 5 (diff=2); sort is stable so 5 wins
    expect(findClosestPriority(3)).toBe('5');
  });

  it('returns low for value closer to 1 (2)', () => {
    expect(findClosestPriority(2)).toBe('1');
  });

  it('returns low for zero', () => {
    expect(findClosestPriority(0)).toBe('1');
  });

  it('returns critical for very high value', () => {
    expect(findClosestPriority(100)).toBe('10');
  });

  it('returns low for negative value', () => {
    expect(findClosestPriority(-5)).toBe('1');
  });
});

describe('runDownloadPreflight', () => {
  it('allows with unknown size', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(true);

    const result = await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: null,
      checkDiskSpace,
    });

    expect(result).toEqual({
      allowed: true,
      reason: 'unknown_size',
    });
    expect(checkDiskSpace).not.toHaveBeenCalled();
  });

  it('blocks when known size is insufficient', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(false);

    const result = await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: 1024,
      checkDiskSpace,
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'insufficient_space',
      requiredBytes: 1024,
    });
    expect(checkDiskSpace).toHaveBeenCalledWith('C:/downloads', 1024);
  });

  it('allows when known size is sufficient', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(true);

    const result = await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: 2048,
      checkDiskSpace,
    });

    expect(result).toEqual({
      allowed: true,
      reason: 'ok',
      requiredBytes: 2048,
    });
    expect(checkDiskSpace).toHaveBeenCalledWith('C:/downloads', 2048);
  });

  it('blocks when disk check throws', async () => {
    const checkDiskSpace = jest.fn().mockRejectedValue(new Error('disk check failed'));

    const result = await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: 123,
      checkDiskSpace,
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'check_failed',
      requiredBytes: 123,
      error: 'disk check failed',
    });
  });
});

describe('runDownloadPreflightWithUi', () => {
  const t = (key: string) => key;

  it('shows unknown-size warning only once with shared ref', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(true);
    const onInfo = jest.fn();
    const onError = jest.fn();
    const unknownSizeWarningRef = { current: false };

    const first = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: null,
        checkDiskSpace,
      },
      { t, onInfo, onError, unknownSizeWarningRef }
    );

    const second = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: undefined,
        checkDiskSpace,
      },
      { t, onInfo, onError, unknownSizeWarningRef }
    );

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(onInfo).toHaveBeenCalledTimes(1);
    expect(onInfo).toHaveBeenCalledWith('downloads.preflight.unknownSizeWarning');
    expect(onError).not.toHaveBeenCalled();
    expect(checkDiskSpace).not.toHaveBeenCalled();
  });

  it('shows insufficient-space error when check returns false', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(false);
    const onInfo = jest.fn();
    const onError = jest.fn();

    const ok = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: 1024,
        checkDiskSpace,
      },
      { t, onInfo, onError }
    );

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith('downloads.errors.insufficientSpace');
    expect(onInfo).not.toHaveBeenCalled();
  });

  it('shows check-failed error message when disk check throws', async () => {
    const checkDiskSpace = jest.fn().mockRejectedValue(new Error('disk exploded'));
    const onInfo = jest.fn();
    const onError = jest.fn();

    const ok = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: 2048,
        checkDiskSpace,
      },
      { t, onInfo, onError }
    );

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith('disk exploded');
    expect(onInfo).not.toHaveBeenCalled();
  });
});

describe('normalizeDownloadFailure', () => {
  it('maps cancelled state to cancelled class with retry', () => {
    const info = normalizeDownloadFailure({
      state: 'cancelled',
      error: null,
    });

    expect(info.failureClass).toBe('cancelled');
    expect(info.retryable).toBe(true);
  });

  it('maps checksum errors to integrity_error without retry', () => {
    const info = normalizeDownloadFailure({
      state: 'failed',
      error: 'Checksum mismatch: expected abc, got def',
      recoverable: false,
    });

    expect(info.failureClass).toBe('integrity_error');
    expect(info.retryable).toBe(false);
  });

  it('maps timeout failures to timeout class with retry', () => {
    const info = normalizeDownloadFailure({
      state: 'failed',
      error: 'Download timeout after 300 seconds',
    });

    expect(info.failureClass).toBe('timeout');
    expect(info.retryable).toBe(true);
  });
});
