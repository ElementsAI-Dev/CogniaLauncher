import {
  isValidUrl,
  inferNameFromUrl,
  joinDestinationPath,
  getStateBadgeVariant,
  findClosestPriority,
  normalizeDownloadFailure,
  runDownloadPreflight,
  runDownloadPreflightWithUi,
  createDownloadRequestDraft,
  createHistoryDownloadDraft,
  createTaskDownloadDraft,
  createArtifactProfilePreview,
  getDownloadFollowUpActions,
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

  it('returns the non-empty side when either base path or item name is blank', () => {
    expect(joinDestinationPath('', 'file.zip')).toBe('file.zip');
    expect(joinDestinationPath('/downloads', '')).toBe('/downloads');
  });
});

describe('createDownloadRequestDraft', () => {
  it('normalizes optional request fields into a reusable draft', () => {
    expect(
      createDownloadRequestDraft({
        url: ' https://example.com/archive.zip ',
        destination: ' /downloads/archive.zip ',
        name: ' archive.zip ',
        provider: ' github:owner/repo ',
        sourceDescriptor: {
          kind: 'github_release_asset',
          provider: 'github',
          label: 'owner/repo@v1.0.0',
          repo: 'owner/repo',
          releaseTag: 'v1.0.0',
          artifactId: '42',
        },
        artifactProfile: {
          artifactKind: 'archive',
          sourceKind: 'github_release_asset',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'extract_then_continue',
          suggestedFollowUps: ['extract', 'open'],
        },
        tags: [' release ', 'github', ''],
        mirrorUrls: [' https://mirror.example.com/archive.zip ', ''],
        postAction: 'none',
        segments: 1,
      })
    ).toEqual({
      url: 'https://example.com/archive.zip',
      destination: '/downloads/archive.zip',
      name: 'archive.zip',
      provider: 'github:owner/repo',
      installIntent: 'extract_then_continue',
      sourceDescriptor: {
        kind: 'github_release_asset',
        provider: 'github',
        label: 'owner/repo@v1.0.0',
        repo: 'owner/repo',
        releaseTag: 'v1.0.0',
        artifactId: '42',
      },
      artifactProfile: {
        artifactKind: 'archive',
        sourceKind: 'github_release_asset',
        platform: 'windows',
        arch: 'x64',
        installIntent: 'extract_then_continue',
        suggestedFollowUps: ['extract', 'open'],
      },
      tags: ['release', 'github'],
      mirrorUrls: ['https://mirror.example.com/archive.zip'],
    });
  });

  it('preserves enabled extraction, headers, segments, and post actions when explicitly configured', () => {
    expect(
      createDownloadRequestDraft({
        url: 'https://example.com/archive.zip',
        destination: '/downloads/archive.zip',
        headers: { Authorization: 'token' },
        autoExtract: true,
        extractDest: '/downloads/unpacked',
        segments: 4,
        postAction: 'install',
        deleteAfterExtract: true,
        autoRename: true,
        installIntent: 'open_installer',
      } as never)
    ).toEqual({
      url: 'https://example.com/archive.zip',
      destination: '/downloads/archive.zip',
      name: 'archive.zip',
      headers: { Authorization: 'token' },
      autoExtract: true,
      extractDest: '/downloads/unpacked',
      segments: 4,
      postAction: 'install',
      deleteAfterExtract: true,
      autoRename: true,
      installIntent: 'open_installer',
      sourceDescriptor: {
        kind: 'direct_url',
      },
      artifactProfile: {
        artifactKind: 'archive',
        sourceKind: 'direct_url',
        platform: 'unknown',
        arch: 'unknown',
        installIntent: 'extract_then_continue',
        suggestedFollowUps: ['extract', 'open', 'reveal'],
      },
    });
  });
});

describe('createHistoryDownloadDraft', () => {
  it('builds a reusable draft from a history record', () => {
    expect(
      createHistoryDownloadDraft({
        id: 'hist-1',
        url: 'https://example.com/file.zip',
        filename: 'file.zip',
        destination: '/downloads/file.zip',
        size: 1024,
        sizeHuman: '1 KB',
        checksum: null,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:00:02Z',
        durationSecs: 2,
        durationHuman: '2s',
        averageSpeed: 512,
        speedHuman: '512 B/s',
        status: 'failed',
        error: 'network',
        provider: 'github:owner/repo',
        sourceDescriptor: {
          kind: 'github_workflow_artifact',
          provider: 'github',
          label: 'owner/repo workflow build',
          repo: 'owner/repo',
          workflowRunId: '99',
          artifactId: '123',
        },
        artifactProfile: {
          artifactKind: 'ci_artifact',
          sourceKind: 'github_workflow_artifact',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'extract_then_continue',
          suggestedFollowUps: ['extract'],
        },
      })
    ).toEqual({
      url: 'https://example.com/file.zip',
      destination: '/downloads/file.zip',
      name: 'file.zip',
      provider: 'github:owner/repo',
      installIntent: 'extract_then_continue',
      sourceDescriptor: {
        kind: 'github_workflow_artifact',
        provider: 'github',
        label: 'owner/repo workflow build',
        repo: 'owner/repo',
        workflowRunId: '99',
        artifactId: '123',
      },
      artifactProfile: {
        artifactKind: 'ci_artifact',
        sourceKind: 'github_workflow_artifact',
        platform: 'windows',
        arch: 'x64',
        installIntent: 'extract_then_continue',
        suggestedFollowUps: ['extract'],
      },
    });
  });
});

describe('createTaskDownloadDraft', () => {
  it('builds a reusable draft from a task snapshot', () => {
    expect(
      createTaskDownloadDraft({
        id: 'task-1',
        url: 'https://example.com/build.zip',
        name: 'build.zip',
        destination: '/downloads/build.zip',
        state: 'failed',
        progress: {
          downloadedBytes: 1024,
          totalBytes: 2048,
          speed: 0,
          speedHuman: '0 B/s',
          percent: 50,
          etaSecs: null,
          etaHuman: null,
          downloadedHuman: '1 KB',
          totalHuman: '2 KB',
        },
        error: 'checksum mismatch',
        provider: 'github:owner/repo',
        createdAt: '2026-01-01T00:00:00Z',
        startedAt: '2026-01-01T00:00:01Z',
        completedAt: null,
        retries: 1,
        priority: 5,
        expectedChecksum: null,
        supportsResume: true,
        metadata: {},
        serverFilename: null,
        sourceDescriptor: {
          kind: 'github_workflow_artifact',
          provider: 'github',
          label: 'owner/repo workflow build',
          repo: 'owner/repo',
          workflowRunId: '99',
          artifactId: '123',
        },
        artifactProfile: {
          artifactKind: 'ci_artifact',
          sourceKind: 'github_workflow_artifact',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'extract_then_continue',
          suggestedFollowUps: ['extract'],
        },
        installIntent: 'extract_then_continue',
      }),
    ).toEqual({
      url: 'https://example.com/build.zip',
      destination: '/downloads/build.zip',
      name: 'build.zip',
      provider: 'github:owner/repo',
      installIntent: 'extract_then_continue',
      sourceDescriptor: {
        kind: 'github_workflow_artifact',
        provider: 'github',
        label: 'owner/repo workflow build',
        repo: 'owner/repo',
        workflowRunId: '99',
        artifactId: '123',
      },
      artifactProfile: {
        artifactKind: 'ci_artifact',
        sourceKind: 'github_workflow_artifact',
        platform: 'windows',
        arch: 'x64',
        installIntent: 'extract_then_continue',
        suggestedFollowUps: ['extract'],
      },
    });
  });
});

describe('createArtifactProfilePreview', () => {
  it('classifies installer artifacts and suggests install follow-up', () => {
    expect(
      createArtifactProfilePreview({
        fileName: 'tool-windows-x64.msi',
        sourceKind: 'github_release_asset',
      }),
    ).toEqual({
      artifactKind: 'installer',
      sourceKind: 'github_release_asset',
      platform: 'windows',
      arch: 'x64',
      installIntent: 'open_installer',
      suggestedFollowUps: ['install', 'open', 'reveal'],
    });
  });

  it('classifies CI artifacts as extract-first even without a special extension', () => {
    expect(
      createArtifactProfilePreview({
        fileName: 'build-output.zip',
        sourceKind: 'github_workflow_artifact',
      }),
    ).toEqual({
      artifactKind: 'ci_artifact',
      sourceKind: 'github_workflow_artifact',
      platform: 'unknown',
      arch: 'unknown',
      installIntent: 'extract_then_continue',
      suggestedFollowUps: ['extract', 'open', 'reveal'],
    });
  });
});

describe('getDownloadFollowUpActions', () => {
  it('returns install-aware actions for completed installer downloads', () => {
    expect(
      getDownloadFollowUpActions({
        status: 'completed',
        destinationAvailable: true,
        artifactProfile: {
          artifactKind: 'installer',
          sourceKind: 'direct_url',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'open_installer',
          suggestedFollowUps: ['install'],
        },
      }),
    ).toEqual([
      expect.objectContaining({ kind: 'install', enabled: true }),
      expect.objectContaining({ kind: 'open', enabled: true }),
      expect.objectContaining({ kind: 'reveal', enabled: true }),
    ]);
  });

  it('falls back to reuse when destination is missing or record is not completed', () => {
    expect(
      getDownloadFollowUpActions({
        status: 'failed',
        destinationAvailable: false,
        artifactProfile: {
          artifactKind: 'archive',
          sourceKind: 'github_workflow_artifact',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'extract_then_continue',
          suggestedFollowUps: ['extract'],
        },
      }),
    ).toEqual([
      expect.objectContaining({ kind: 'reuse', enabled: true }),
    ]);
  });

  it('falls back to reuse when a completed download no longer has an available destination', () => {
    expect(
      getDownloadFollowUpActions({
        status: 'completed',
        destinationAvailable: false,
        artifactProfile: {
          artifactKind: 'installer',
          sourceKind: 'direct_url',
          platform: 'windows',
          arch: 'x64',
          installIntent: 'open_installer',
          suggestedFollowUps: ['install'],
        },
      }),
    ).toEqual([
      expect.objectContaining({ kind: 'reuse', enabled: true }),
    ]);
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

  it('treats non-finite or zero byte sizes as unknown-size preflight cases', async () => {
    const checkDiskSpace = jest.fn().mockResolvedValue(true);

    expect(await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: 0,
      checkDiskSpace,
    })).toEqual({
      allowed: true,
      reason: 'unknown_size',
    });

    expect(await runDownloadPreflight({
      destinationPath: 'C:/downloads',
      expectedBytes: Number.NaN,
      checkDiskSpace,
    })).toEqual({
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

  it('skips unknown-size warnings when disabled and returns true for successful known-size checks', async () => {
    const onInfo = jest.fn();
    const onError = jest.fn();
    const checkDiskSpace = jest.fn().mockResolvedValue(true);

    const unknown = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: null,
        checkDiskSpace,
      },
      { t, onInfo, onError, warnUnknownSize: false }
    );
    const ok = await runDownloadPreflightWithUi(
      {
        destinationPath: 'C:/downloads',
        expectedBytes: 2048,
        checkDiskSpace,
      },
      { t, onInfo, onError }
    );

    expect(unknown).toBe(true);
    expect(ok).toBe(true);
    expect(onInfo).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
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

  it('prefers stable reasonCode mapping over error text', () => {
    const info = normalizeDownloadFailure({
      state: 'failed',
      error: 'some localized text',
      reasonCode: 'checksum_mismatch',
    });

    expect(info.failureClass).toBe('integrity_error');
  });

  it('uses recoverable flag to gate retry when reasonCode is transient', () => {
    const info = normalizeDownloadFailure({
      state: 'failed',
      error: 'network issue',
      reasonCode: 'network_error',
      recoverable: false,
    });

    expect(info.failureClass).toBe('network_error');
    expect(info.retryable).toBe(false);
  });

  it('maps selection, cache, and timeout failures from reason codes and raw messages', () => {
    expect(normalizeDownloadFailure({
      state: 'failed',
      reasonCode: 'invalid_url',
      error: 'ignored',
    })).toEqual({ failureClass: 'selection_error', retryable: false });

    expect(normalizeDownloadFailure({
      state: 'failed',
      reasonCode: 'cache_validation_failed',
      error: 'ignored',
    })).toEqual({ failureClass: 'cache_error', retryable: true });

    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'connection timeout while downloading',
    })).toEqual({ failureClass: 'timeout', retryable: true });
  });

  it('maps remaining raw-message and reason-code branches for failure normalization', () => {
    expect(normalizeDownloadFailure({
      state: 'failed',
      reasonCode: 'timeout',
      error: 'ignored',
    })).toEqual({ failureClass: 'timeout', retryable: true });

    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'forbidden by remote policy',
    })).toEqual({ failureClass: 'selection_error', retryable: false });

    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'corrupted cached archive detected',
    })).toEqual({ failureClass: 'cache_error', retryable: true });

    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'network connection reset by peer',
    })).toEqual({ failureClass: 'network_error', retryable: true });
  });

  it('treats http error and rate-limited raw messages as retryable network failures', () => {
    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'HTTP error: 503 Service Unavailable',
    })).toEqual({ failureClass: 'network_error', retryable: true });

    expect(normalizeDownloadFailure({
      state: 'failed',
      error: 'request was rate limited by upstream',
    })).toEqual({ failureClass: 'network_error', retryable: true });
  });
});
