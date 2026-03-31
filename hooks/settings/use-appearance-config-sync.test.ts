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
const mockSetInterfaceRadius = jest.fn();
const mockSetInterfaceDensity = jest.fn();
const mockSetReducedMotion = jest.fn();
const mockSetWindowEffect = jest.fn();
jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: jest.fn(() => ({
    accentColor: 'blue',
    chartColorTheme: 'default',
    interfaceRadius: 0.625,
    interfaceDensity: 'comfortable',
    reducedMotion: false,
    windowEffect: 'auto',
    setAccentColor: mockSetAccentColor,
    setChartColorTheme: mockSetChartColorTheme,
    setInterfaceRadius: mockSetInterfaceRadius,
    setInterfaceDensity: mockSetInterfaceDensity,
    setReducedMotion: mockSetReducedMotion,
    setWindowEffect: mockSetWindowEffect,
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
    warning: jest.fn(),
  },
}));

const mockConfigSet = jest.fn();
const mockIsTauri = jest.fn(() => false);
jest.mock('@/lib/tauri', () => ({
  configSet: (...args: unknown[]) => mockConfigSet(...args),
  isTauri: () => mockIsTauri(),
}));

const mockParseAppearanceConfig = jest.fn((config: Record<string, string>) => ({
  theme: config['appearance.theme'] || config.theme || 'system',
  accentColor: config['appearance.accent_color'] || config.accentColor || 'blue',
  chartColorTheme: config['appearance.chart_color_theme'] || config.chartColorTheme || 'default',
  interfaceRadius: config['appearance.interface_radius'] ? parseFloat(config['appearance.interface_radius']) : 0.625,
  interfaceDensity: config['appearance.interface_density'] || 'comfortable',
  reducedMotion: config.reducedMotion === 'true',
  windowEffect: config['appearance.window_effect'] || 'auto',
  locale: config['appearance.language'] || 'en',
  invalidKeys: [],
}));

// Mock parseAppearanceConfig
jest.mock('@/lib/theme', () => ({
  APPEARANCE_CONFIG_PATHS: {
    theme: 'appearance.theme',
    accentColor: 'appearance.accent_color',
    chartColorTheme: 'appearance.chart_color_theme',
    interfaceRadius: 'appearance.interface_radius',
    interfaceDensity: 'appearance.interface_density',
    reducedMotion: 'appearance.reduced_motion',
    language: 'appearance.language',
    windowEffect: 'appearance.window_effect',
  },
  parseAppearanceConfig: (config: Record<string, string>) => mockParseAppearanceConfig(config),
}));

describe('useAppearanceConfigSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockParseAppearanceConfig.mockImplementation((config: Record<string, string>) => ({
      theme: config['appearance.theme'] || config.theme || 'system',
      accentColor: config['appearance.accent_color'] || config.accentColor || 'blue',
      chartColorTheme: config['appearance.chart_color_theme'] || config.chartColorTheme || 'default',
      interfaceRadius: config['appearance.interface_radius'] ? parseFloat(config['appearance.interface_radius']) : 0.625,
      interfaceDensity: config['appearance.interface_density'] || 'comfortable',
      reducedMotion: config.reducedMotion === 'true',
      windowEffect: config['appearance.window_effect'] || 'auto',
      locale: config['appearance.language'] || 'en',
      invalidKeys: [],
    }));
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

  it('should sync interface radius from config', () => {
    const config = { 'appearance.interface_radius': '0.75' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetInterfaceRadius).toHaveBeenCalledWith(0.75);
  });

  it('should sync interface density from config', () => {
    const config = { 'appearance.interface_density': 'compact' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetInterfaceDensity).toHaveBeenCalledWith('compact');
  });

  it('should sync all appearance settings from config', () => {
    const config = {
      theme: 'dark',
      accentColor: 'green',
      chartColorTheme: 'vibrant',
      'appearance.interface_radius': '0.5',
      'appearance.interface_density': 'spacious',
      reducedMotion: 'true',
    };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(mockSetAccentColor).toHaveBeenCalledWith('green');
    expect(mockSetChartColorTheme).toHaveBeenCalledWith('vibrant');
    expect(mockSetInterfaceRadius).toHaveBeenCalledWith(0.5);
    expect(mockSetInterfaceDensity).toHaveBeenCalledWith('spacious');
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

  it('should sync window effect from config', () => {
    const config = { 'appearance.window_effect': 'mica' };
    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetWindowEffect).toHaveBeenCalledWith('mica');
  });

  it('writes canonical values back for invalid appearance config keys on desktop', async () => {
    mockIsTauri.mockReturnValue(true);
    mockParseAppearanceConfig.mockImplementation(() => ({
      theme: 'system',
      accentColor: 'blue',
      chartColorTheme: 'default',
      interfaceRadius: 0.625,
      interfaceDensity: 'comfortable',
      reducedMotion: false,
      windowEffect: 'auto',
      locale: 'en',
      invalidKeys: ['theme'],
    }));

    renderHook(() => useAppearanceConfigSync({ 'appearance.theme': 'invalid' }));

    await Promise.resolve();
    expect(mockConfigSet).toHaveBeenCalledWith('appearance.theme', 'system');
  });
});
