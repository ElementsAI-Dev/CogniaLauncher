import { deriveCacheOverviewInsights } from './insights';

describe('cache overview insights', () => {
  const now = new Date('2026-03-14T12:00:00.000Z').getTime();

  it('prioritizes repair guidance when cache verification reports issues', () => {
    const insights = deriveCacheOverviewInsights({
      cacheInfo: {
        download_cache: {
          entry_count: 12,
          size: 300 * 1024 * 1024,
          size_human: '300 MB',
          location: '/cache/downloads',
        },
        metadata_cache: {
          entry_count: 8,
          size: 100 * 1024 * 1024,
          size_human: '100 MB',
          location: '/cache/metadata',
        },
        default_downloads: {
          entry_count: 4,
          size: 50 * 1024 * 1024,
          size_human: '50 MB',
          location: '/downloads',
          is_available: true,
          reason: null,
        },
        total_size: 450 * 1024 * 1024,
        total_size_human: '450 MB',
        max_size: 1024 * 1024 * 1024,
        usage_percent: 44,
      },
      monitor: {
        internalSize: 400 * 1024 * 1024,
        internalSizeHuman: '400 MB',
        defaultDownloadsSize: 50 * 1024 * 1024,
        defaultDownloadsSizeHuman: '50 MB',
        defaultDownloadsCount: 4,
        defaultDownloadsPath: '/downloads',
        defaultDownloadsAvailable: true,
        defaultDownloadsReason: null,
        externalSize: 800 * 1024 * 1024,
        externalSizeHuman: '800 MB',
        totalSize: 1250 * 1024 * 1024,
        totalSizeHuman: '1.25 GB',
        maxSize: 1024 * 1024 * 1024,
        maxSizeHuman: '1 GB',
        usagePercent: 44,
        threshold: 80,
        exceedsThreshold: false,
        diskTotal: 0,
        diskAvailable: 0,
        diskAvailableHuman: '0 B',
        externalCaches: [
          {
            provider: 'npm',
            displayName: 'npm',
            size: 500 * 1024 * 1024,
            sizeHuman: '500 MB',
            cachePath: '/ext/npm',
          },
        ],
      },
      accessStats: {
        hits: 180,
        misses: 20,
        hit_rate: 0.9,
        total_requests: 200,
        last_reset: null,
      },
      accessStatsReadState: {
        status: 'ready',
        error: null,
        lastUpdatedAt: now - 1_000,
      },
      hotFiles: [
        {
          key: 'downloads/react.tgz',
          file_path: '/cache/downloads/react.tgz',
          size: 1024,
          size_human: '1 KB',
          checksum: 'abc',
          entry_type: 'download',
          created_at: '2026-03-14T11:00:00.000Z',
          last_accessed: '2026-03-14T11:59:00.000Z',
          hit_count: 32,
        },
      ],
      hotFilesReadState: {
        status: 'ready',
        error: null,
        lastUpdatedAt: now - 2_000,
      },
      historySummary: {
        total_cleanups: 3,
        total_freed_bytes: 123456,
        total_freed_human: '1.2 GB',
        total_files_cleaned: 42,
        trash_cleanups: 2,
        permanent_cleanups: 1,
      },
      historyReadState: {
        status: 'ready',
        error: null,
        lastUpdatedAt: now - 5_000,
      },
      cacheVerification: {
        valid_entries: 18,
        missing_files: 1,
        corrupted_files: 1,
        size_mismatches: 0,
        is_healthy: false,
        details: [],
      },
      totalIssues: 2,
      now,
    });

    expect(insights.primaryAction.id).toBe('repair');
    expect(insights.primaryAction.tone).toBe('danger');
    expect(insights.primaryAction.targetId).toBe('cache-health');
    expect(insights.scopeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'internal',
          entryCount: 20,
          coverage: 'historical',
        }),
        expect.objectContaining({
          id: 'default_downloads',
          status: 'available',
        }),
        expect.objectContaining({
          id: 'external',
          tone: 'warning',
          coverage: 'snapshot',
        }),
      ]),
    );
    expect(insights.freshness.state).toBe('fresh');
    expect(insights.freshness.lastUpdatedAt).toBe(now - 1_000);
  });

  it('recommends cleanup when cache pressure is high and marks unavailable scopes', () => {
    const insights = deriveCacheOverviewInsights({
      cacheInfo: {
        download_cache: {
          entry_count: 2,
          size: 910 * 1024 * 1024,
          size_human: '910 MB',
          location: '/cache/downloads',
        },
        metadata_cache: {
          entry_count: 1,
          size: 10 * 1024 * 1024,
          size_human: '10 MB',
          location: '/cache/metadata',
        },
        default_downloads: {
          entry_count: 0,
          size: 0,
          size_human: '0 B',
          location: null,
          is_available: false,
          reason: 'missing',
        },
        total_size: 920 * 1024 * 1024,
        total_size_human: '920 MB',
        max_size: 1024 * 1024 * 1024,
        usage_percent: 90,
      },
      monitor: null,
      accessStats: null,
      accessStatsReadState: {
        status: 'idle',
        error: null,
        lastUpdatedAt: null,
      },
      hotFiles: [],
      hotFilesReadState: {
        status: 'idle',
        error: null,
        lastUpdatedAt: null,
      },
      historySummary: null,
      historyReadState: {
        status: 'idle',
        error: null,
        lastUpdatedAt: null,
      },
      cacheVerification: null,
      totalIssues: 0,
      now,
    });

    expect(insights.primaryAction.id).toBe('clean');
    expect(insights.primaryAction.tone).toBe('danger');
    expect(
      insights.scopeSummaries.find((scope) => scope.id === 'default_downloads'),
    ).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        tone: 'muted',
      }),
    );
    expect(
      insights.scopeSummaries.find((scope) => scope.id === 'external'),
    ).toEqual(
      expect.objectContaining({
        status: 'snapshot_pending',
        coverage: 'snapshot',
      }),
    );
    expect(insights.freshness.state).toBe('missing');
  });
});
