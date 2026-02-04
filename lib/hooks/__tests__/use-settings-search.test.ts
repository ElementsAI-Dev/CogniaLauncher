import { renderHook, act } from '@testing-library/react';
import { useSettingsSearch, useActiveSection } from '../use-settings-search';
import type { SettingsSection } from '@/lib/constants/settings-registry';

jest.mock('@/lib/constants/settings-registry', () => ({
  SETTINGS_REGISTRY: [
    {
      key: 'general.parallel_downloads',
      section: 'general',
      labelKey: 'settings.parallelDownloads',
      descKey: 'settings.parallelDownloadsDesc',
      type: 'input',
      keywords: ['concurrent', 'download', 'parallel', '并行', '下载'],
    },
    {
      key: 'appearance.theme',
      section: 'appearance',
      labelKey: 'settings.theme',
      descKey: 'settings.themeDesc',
      type: 'select',
      keywords: ['theme', 'dark', 'light', '主题', '深色'],
    },
    {
      key: 'network.proxy',
      section: 'network',
      labelKey: 'settings.proxy',
      descKey: 'settings.proxyDesc',
      type: 'input',
      keywords: ['proxy', 'http', '代理'],
      advanced: true,
    },
    {
      key: 'updates.auto_install',
      section: 'updates',
      labelKey: 'settings.autoInstallUpdates',
      descKey: 'settings.autoInstallUpdatesDesc',
      type: 'switch',
      keywords: ['update', 'auto', '更新'],
      tauriOnly: true,
    },
  ],
  SETTINGS_SECTIONS: [
    { id: 'general', labelKey: 'settings.general', descKey: 'settings.generalDesc', icon: 'Settings2', order: 1 },
    { id: 'network', labelKey: 'settings.network', descKey: 'settings.networkDesc', icon: 'Network', order: 2 },
    { id: 'appearance', labelKey: 'settings.appearance', descKey: 'settings.appearanceDesc', icon: 'Palette', order: 3 },
    { id: 'updates', labelKey: 'settings.updates', descKey: 'settings.updatesDesc', icon: 'RefreshCw', order: 4 },
  ],
}));

describe('useSettingsSearch', () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'settings.parallelDownloads': 'Parallel Downloads',
      'settings.parallelDownloadsDesc': 'Number of concurrent downloads',
      'settings.theme': 'Theme',
      'settings.themeDesc': 'Choose your preferred theme',
      'settings.proxy': 'Proxy',
      'settings.proxyDesc': 'HTTP proxy settings',
      'settings.autoInstallUpdates': 'Auto Install Updates',
      'settings.autoInstallUpdatesDesc': 'Automatically install updates',
    };
    return translations[key] || key;
  };

  it('returns empty results when query is empty', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.totalResults).toBe(0);
  });

  it('searches by label', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('Theme');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('appearance.theme');
    expect(result.current.results[0].matchedIn).toContain('label');
    expect(result.current.isSearching).toBe(true);
  });

  it('searches by description', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('concurrent');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('general.parallel_downloads');
    expect(result.current.results[0].matchedIn).toContain('description');
  });

  it('searches by keywords', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('dark');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('appearance.theme');
    expect(result.current.results[0].matchedIn).toContain('keywords');
  });

  it('searches by Chinese keywords', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('主题');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('appearance.theme');
  });

  it('searches by setting key', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('parallel_downloads');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('general.parallel_downloads');
  });

  it('is case insensitive', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('THEME');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('appearance.theme');
  });

  it('filters out advanced settings when showAdvanced is false', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: false, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('proxy');
    });

    expect(result.current.results).toEqual([]);
  });

  it('filters out tauriOnly settings when showTauriOnly is false', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: false })
    );

    act(() => {
      result.current.setQuery('auto install');
    });

    expect(result.current.results).toEqual([]);
  });

  it('returns matching sections', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('download');
    });

    expect(result.current.matchingSections.has('general')).toBe(true);
  });

  it('returns matching section definitions sorted by order', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('a'); // Matches multiple sections
    });

    const sectionIds = result.current.matchingSectionDefinitions.map((s) => s.id);
    expect(sectionIds).toEqual([...sectionIds].sort((a, b) => {
      const order: Record<string, number> = { general: 1, network: 2, appearance: 3, updates: 4 };
      return order[a] - order[b];
    }));
  });

  it('clears search', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('theme');
    });

    expect(result.current.isSearching).toBe(true);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('sorts results with label matches first', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
    );

    act(() => {
      result.current.setQuery('theme');
    });

    // Label match should come before keyword-only matches
    const firstResult = result.current.results[0];
    expect(firstResult.matchedIn).toContain('label');
  });

  describe('highlightText', () => {
    it('returns unhighlighted text when query is empty', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([{ text: 'Hello World', highlighted: false }]);
    });

    it('highlights matching text', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('World');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([
        { text: 'Hello ', highlighted: false },
        { text: 'World', highlighted: true },
      ]);
    });

    it('highlights multiple occurrences', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('o');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([
        { text: 'Hell', highlighted: false },
        { text: 'o', highlighted: true },
        { text: ' W', highlighted: false },
        { text: 'o', highlighted: true },
        { text: 'rld', highlighted: false },
      ]);
    });

    it('handles case insensitive highlighting', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('WORLD');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([
        { text: 'Hello ', highlighted: false },
        { text: 'World', highlighted: true },
      ]);
    });

    it('handles query at start of text', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('Hello');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([
        { text: 'Hello', highlighted: true },
        { text: ' World', highlighted: false },
      ]);
    });

    it('handles query at end of text', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('World');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([
        { text: 'Hello ', highlighted: false },
        { text: 'World', highlighted: true },
      ]);
    });

    it('handles no match', () => {
      const { result } = renderHook(() =>
        useSettingsSearch({ t: mockT, showAdvanced: true, showTauriOnly: true })
      );

      act(() => {
        result.current.setQuery('xyz');
      });

      const parts = result.current.highlightText('Hello World');

      expect(parts).toEqual([{ text: 'Hello World', highlighted: false }]);
    });
  });
});

describe('useActiveSection', () => {
  const sectionIds: SettingsSection[] = ['general', 'network', 'appearance'];

  beforeEach(() => {
    // Mock getElementById
    jest.spyOn(document, 'getElementById').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns first section as initial active section', () => {
    const { result } = renderHook(() => useActiveSection(sectionIds));

    expect(result.current.activeSection).toBe('general');
  });

  it('returns null when sectionIds is empty', () => {
    const { result } = renderHook(() => useActiveSection([]));

    expect(result.current.activeSection).toBeNull();
  });

  it('allows setting active section manually', () => {
    const { result } = renderHook(() => useActiveSection(sectionIds));

    act(() => {
      result.current.setActiveSection('network');
    });

    expect(result.current.activeSection).toBe('network');
  });

  it('scrollToSection updates active section', () => {
    const mockElement = {
      scrollIntoView: jest.fn(),
    };
    jest.spyOn(document, 'getElementById').mockReturnValue(mockElement as unknown as HTMLElement);

    const { result } = renderHook(() => useActiveSection(sectionIds));

    act(() => {
      result.current.scrollToSection('appearance');
    });

    expect(document.getElementById).toHaveBeenCalledWith('section-appearance');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(result.current.activeSection).toBe('appearance');
  });

  it('scrollToSection does nothing when element not found', () => {
    jest.spyOn(document, 'getElementById').mockReturnValue(null);

    const { result } = renderHook(() => useActiveSection(sectionIds));

    act(() => {
      result.current.scrollToSection('network');
    });

    expect(result.current.activeSection).toBe('general'); // Unchanged
  });

  it('observerCallback updates active section from visible entries', () => {
    const { result } = renderHook(() => useActiveSection(sectionIds));

    const mockEntries = [
      {
        isIntersecting: true,
        boundingClientRect: { top: 100 },
        target: { id: 'section-network' },
      },
      {
        isIntersecting: true,
        boundingClientRect: { top: 200 },
        target: { id: 'section-appearance' },
      },
    ] as unknown as IntersectionObserverEntry[];

    act(() => {
      result.current.observerCallback(mockEntries);
    });

    expect(result.current.activeSection).toBe('network');
  });

  it('observerCallback ignores non-intersecting entries', () => {
    const { result } = renderHook(() => useActiveSection(sectionIds));

    const mockEntries = [
      {
        isIntersecting: false,
        boundingClientRect: { top: 100 },
        target: { id: 'section-network' },
      },
    ] as unknown as IntersectionObserverEntry[];

    act(() => {
      result.current.observerCallback(mockEntries);
    });

    expect(result.current.activeSection).toBe('general'); // Unchanged
  });
});
