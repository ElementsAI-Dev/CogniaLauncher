/**
 * Tests for useChangelog hook.
 *
 * The hook uses a module-level cache, so we use jest.isolateModules
 * to get a fresh module for tests that need to test the fetch path,
 * and share the module for tests that just need the cached result.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useChangelog } from './use-changelog';

// Mock platform
jest.mock('@/lib/platform', () => ({
  isTauri: () => false,
}));

// Mock getChangelog
jest.mock('@/lib/constants/about', () => ({
  getChangelog: (locale: string) => [
    {
      version: '0.1.0',
      date: '2025-01-15',
      source: 'local' as const,
      changes: [
        { type: 'added' as const, description: locale === 'zh' ? '首次发布' : 'Initial release' },
      ],
    },
  ],
}));

const mockReleases = [
  {
    id: 1,
    tag_name: 'v0.2.0',
    name: 'v0.2.0',
    body: '## New Features\n- Added stuff',
    published_at: '2025-02-01T00:00:00Z',
    prerelease: false,
    draft: false,
    assets: [],
  },
  {
    id: 2,
    tag_name: 'v0.1.0',
    name: 'v0.1.0',
    body: '## Initial Release',
    published_at: '2025-01-15T00:00:00Z',
    prerelease: false,
    draft: false,
    assets: [],
  },
  {
    id: 3,
    tag_name: 'v0.3.0-beta',
    name: 'v0.3.0-beta',
    body: 'Beta release',
    published_at: '2025-03-01T00:00:00Z',
    prerelease: true,
    draft: false,
    assets: [],
  },
  {
    id: 4,
    tag_name: 'v0.0.1-draft',
    name: 'Draft',
    body: null,
    published_at: null,
    prerelease: false,
    draft: true,
    assets: [],
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockReleases),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useChangelog', () => {
  it('returns local entries immediately', () => {
    const { result } = renderHook(() => useChangelog('en'));
    expect(result.current.entries.length).toBeGreaterThanOrEqual(1);
    const localEntry = result.current.entries.find(e => e.version === '0.1.0');
    expect(localEntry).toBeDefined();
  });

  it('fetches remote entries and merges them', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    expect(result.current.entries.length).toBeGreaterThan(1);
    const v020 = result.current.entries.find(e => e.version === '0.2.0');
    expect(v020).toBeDefined();
    expect(v020?.source).toBe('remote');
    expect(v020?.markdownBody).toBe('## New Features\n- Added stuff');
  });

  it('filters out draft releases', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    const draft = result.current.entries.find(e => e.version === '0.0.1-draft');
    expect(draft).toBeUndefined();
  });

  it('preserves pre-release flag', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    const beta = result.current.entries.find(e => e.version === '0.3.0-beta');
    expect(beta).toBeDefined();
    expect(beta?.prerelease).toBe(true);
  });

  it('merges remote into local for same version', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    const v010 = result.current.entries.find(e => e.version === '0.1.0');
    expect(v010).toBeDefined();
    expect(v010?.changes.length).toBeGreaterThan(0);
    expect(v010?.markdownBody).toBe('## Initial Release');
    expect(v010?.source).toBe('remote');
  });

  it('sorts entries by version descending', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    const versions = result.current.entries.map(e => e.version);
    const v020Idx = versions.indexOf('0.2.0');
    const v010Idx = versions.indexOf('0.1.0');
    expect(v020Idx).toBeLessThan(v010Idx);
  });

  it('sets GitHub URL for remote entries', async () => {
    const { result } = renderHook(() => useChangelog('en'));

    await waitFor(() => {
      expect(result.current.hasRemote).toBe(true);
    });

    const v020 = result.current.entries.find(e => e.version === '0.2.0');
    expect(v020?.url).toContain('github.com');
    expect(v020?.url).toContain('v0.2.0');
  });
});
