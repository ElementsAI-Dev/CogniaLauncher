import { renderHook } from '@testing-library/react';
import { useAppearanceConfigSync } from './use-appearance-config-sync';

// Mock theme hook
const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: 'light' }),
}));

// Mock appearance store
const mockSetAccentColor = jest.fn();
const mockSetChartColorTheme = jest.fn();
const mockSetReducedMotion = jest.fn();
jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: jest.fn(() => ({
    accentColor: 'blue',
    chartColorTheme: 'default',
    reducedMotion: false,
    setAccentColor: mockSetAccentColor,
    setChartColorTheme: mockSetChartColorTheme,
    setReducedMotion: mockSetReducedMotion,
  })),
}));

// Mock locale provider
const mockSetLocale = jest.fn();
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: mockSetLocale,
  }),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock parseAppearanceConfig
jest.mock('@/lib/theme', () => ({
  parseAppearanceConfig: (config: Record<string, string>) => ({
    theme: config['appearance.theme'] || config.theme,
    accentColor: config['appearance.accent_color'] || config.accentColor,
    chartColorTheme: config['appearance.chart_color_theme'] || config.chartColorTheme,
    reducedMotion: config.reducedMotion === 'true',
    locale: config['appearance.language'],
    invalidKeys: [],
  }),
}));

describe('useAppearanceConfigSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not update when config is empty', () => {
    renderHook(() => useAppearanceConfigSync({}));

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockSetAccentColor).not.toHaveBeenCalled();
  });

  it('should sync theme from config', () => {
    const config = { theme: 'dark' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should sync accent color from config', () => {
    const config = { accentColor: 'purple' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetAccentColor).toHaveBeenCalledWith('purple');
  });

  it('should sync reduced motion from config', () => {
    const config = { reducedMotion: 'true' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it('should sync chart color theme from config', () => {
    const config = { chartColorTheme: 'ocean' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetChartColorTheme).toHaveBeenCalledWith('ocean');
  });

  it('should sync all appearance settings from config', () => {
    const config = {
      theme: 'dark',
      accentColor: 'green',
      chartColorTheme: 'vibrant',
      reducedMotion: 'true',
    };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(mockSetAccentColor).toHaveBeenCalledWith('green');
    expect(mockSetChartColorTheme).toHaveBeenCalledWith('vibrant');
    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it('should not re-sync when config values are the same as current state', () => {
    // Theme is 'light' in mock, so setting 'light' should not trigger setTheme
    const config = { theme: 'light' };
    renderHook(() => useAppearanceConfigSync(config));

    // Should not be called since theme is already 'light'
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it('should sync when config values differ from current state', () => {
    const config = { theme: 'dark' }; // Different from mock default 'light'
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});
