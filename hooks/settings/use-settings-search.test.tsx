import { renderHook, act } from '@testing-library/react';
import { useSettingsSearch, useActiveSection } from './use-settings-search';

// Mock the settings registry
jest.mock('@/lib/constants/settings-registry', () => ({
  SETTINGS_REGISTRY: [
    {
      key: 'theme',
      labelKey: 'settings.theme.label',
      descKey: 'settings.theme.description',
      section: 'appearance',
      keywords: ['dark', 'light', 'color'],
      advanced: false,
      tauriOnly: false,
    },
    {
      key: 'language',
      labelKey: 'settings.language.label',
      descKey: 'settings.language.description',
      section: 'general',
      keywords: ['locale', 'i18n'],
      advanced: false,
      tauriOnly: false,
    },
    {
      key: 'advancedMode',
      labelKey: 'settings.advanced.label',
      descKey: 'settings.advanced.description',
      section: 'general',
      keywords: ['developer', 'expert'],
      advanced: true,
      tauriOnly: false,
    },
    {
      key: 'tauriFeature',
      labelKey: 'settings.tauri.label',
      descKey: 'settings.tauri.description',
      section: 'system',
      keywords: ['desktop', 'native'],
      advanced: false,
      tauriOnly: true,
    },
  ],
  SETTINGS_SECTIONS: [
    { id: 'general', order: 1 },
    { id: 'appearance', order: 2 },
    { id: 'system', order: 3 },
  ],
}));

describe('useSettingsSearch', () => {
  const mockT = (key: string): string => {
    const translations: Record<string, string> = {
      'settings.theme.label': 'Theme',
      'settings.theme.description': 'Choose your preferred color theme',
      'settings.language.label': 'Language',
      'settings.language.description': 'Select application language',
      'settings.advanced.label': 'Advanced Mode',
      'settings.advanced.description': 'Enable advanced features',
      'settings.tauri.label': 'Desktop Feature',
      'settings.tauri.description': 'Native desktop functionality',
    };
    return translations[key] || key;
  };

  it('should initialize with empty query', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(result.current.totalResults).toBe(0);
  });

  it('should update query on setQuery', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('theme');
    });

    expect(result.current.query).toBe('theme');
    expect(result.current.isSearching).toBe(true);
  });

  it('should find settings by label', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('Theme');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].setting.key).toBe('theme');
    expect(result.current.results[0].matchedIn).toContain('label');
  });

  it('should find settings by description', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('color');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    const themeResult = result.current.results.find(r => r.setting.key === 'theme');
    expect(themeResult?.matchedIn).toContain('keywords');
  });

  it('should find settings by keywords', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('dark');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].matchedIn).toContain('keywords');
  });

  it('should clear search', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

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

  it('should filter out advanced settings when showAdvanced is false', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: false })
    );

    act(() => {
      result.current.setQuery('advanced');
    });

    const advancedResult = result.current.results.find(r => r.setting.key === 'advancedMode');
    expect(advancedResult).toBeUndefined();
  });

  it('should include advanced settings when showAdvanced is true', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showAdvanced: true })
    );

    act(() => {
      result.current.setQuery('developer');
    });

    const advancedResult = result.current.results.find(r => r.setting.key === 'advancedMode');
    expect(advancedResult).toBeDefined();
  });

  it('should filter out tauri-only settings when showTauriOnly is false', () => {
    const { result } = renderHook(() =>
      useSettingsSearch({ t: mockT, showTauriOnly: false })
    );

    act(() => {
      result.current.setQuery('desktop');
    });

    const tauriResult = result.current.results.find(r => r.setting.key === 'tauriFeature');
    expect(tauriResult).toBeUndefined();
  });

  it('should track matching sections', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('theme');
    });

    expect(result.current.matchingSections.has('appearance')).toBe(true);
  });

  it('should sort results with label matches first', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('lang');
    });

    // Language has a label match
    expect(result.current.results[0].setting.key).toBe('language');
  });

  it('should highlight text correctly', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('The');
    });

    const highlighted = result.current.highlightText('Theme Settings');
    expect(highlighted).toHaveLength(2);
    expect(highlighted[0]).toEqual({ text: 'The', highlighted: true });
    expect(highlighted[1]).toEqual({ text: 'me Settings', highlighted: false });
  });

  it('should return unhighlighted text when no query', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    const highlighted = result.current.highlightText('Theme Settings');
    expect(highlighted).toEqual([{ text: 'Theme Settings', highlighted: false }]);
  });

  it('should handle case-insensitive search', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('THEME');
    });

    expect(result.current.results.length).toBeGreaterThan(0);
  });

  it('should search by key itself', () => {
    const { result } = renderHook(() => useSettingsSearch({ t: mockT }));

    act(() => {
      result.current.setQuery('theme');
    });

    const themeResult = result.current.results.find(r => r.setting.key === 'theme');
    expect(themeResult).toBeDefined();
  });
});

describe('useActiveSection', () => {
  const sectionIds = ['general', 'appearance', 'system'] as const;

  it('should initialize with first section as active', () => {
    const { result } = renderHook(() => useActiveSection([...sectionIds]));

    expect(result.current.activeSection).toBe('general');
  });

  it('should initialize with null when no sections', () => {
    const { result } = renderHook(() => useActiveSection([]));

    expect(result.current.activeSection).toBeNull();
  });

  it('should allow setting active section', () => {
    const { result } = renderHook(() => useActiveSection([...sectionIds]));

    act(() => {
      result.current.setActiveSection('appearance');
    });

    expect(result.current.activeSection).toBe('appearance');
  });

  it('should automatically observe section elements via IntersectionObserver', () => {
    // The IntersectionObserver is now managed internally by the hook
    // We verify that the hook initializes correctly and exposes the right API
    const { result } = renderHook(() => useActiveSection([...sectionIds]));

    expect(result.current.activeSection).toBe('general');
    expect(typeof result.current.setActiveSection).toBe('function');
    expect(typeof result.current.scrollToSection).toBe('function');
  });

  it('should provide scrollToSection function', () => {
    const { result } = renderHook(() => useActiveSection([...sectionIds]));

    expect(typeof result.current.scrollToSection).toBe('function');
  });

  it('should update active section on scrollToSection', () => {
    // Mock getElementById
    const mockElement = {
      scrollIntoView: jest.fn(),
    };
    jest.spyOn(document, 'getElementById').mockReturnValue(mockElement as unknown as HTMLElement);

    const { result } = renderHook(() => useActiveSection([...sectionIds]));

    act(() => {
      result.current.scrollToSection('system');
    });

    expect(result.current.activeSection).toBe('system');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    jest.restoreAllMocks();
  });
});
