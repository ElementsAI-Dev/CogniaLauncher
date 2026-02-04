import { renderHook } from '@testing-library/react';
import { useAppearanceConfigSync } from '../use-appearance-config-sync';

jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
  })),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: jest.fn(() => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    messages: {},
  })),
}));

jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: jest.fn(() => ({
    accentColor: 'blue',
    setAccentColor: jest.fn(),
    reducedMotion: false,
    setReducedMotion: jest.fn(),
  })),
}));

jest.mock('@/lib/theme', () => ({
  parseAppearanceConfig: jest.fn(() => ({
    theme: 'dark',
    accentColor: 'green',
    reducedMotion: true,
    locale: 'zh',
    invalidKeys: [],
  })),
}));

jest.mock('sonner', () => ({
  toast: {
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

import { useTheme } from 'next-themes';
import { useLocale } from '@/components/providers/locale-provider';
import { useAppearanceStore } from '@/lib/stores/appearance';
import { parseAppearanceConfig } from '@/lib/theme';
import { toast } from 'sonner';

const mockedUseTheme = jest.mocked(useTheme);
const mockedUseLocale = jest.mocked(useLocale);
const mockedUseAppearanceStore = jest.mocked(useAppearanceStore);
const mockedParseAppearanceConfig = jest.mocked(parseAppearanceConfig);

describe('useAppearanceConfigSync', () => {
  const mockSetTheme = jest.fn();
  const mockSetAccentColor = jest.fn();
  const mockSetReducedMotion = jest.fn();
  const mockSetLocale = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      themes: ['light', 'dark', 'system'],
      resolvedTheme: 'light',
      systemTheme: 'light',
      forcedTheme: undefined,
    });
    mockedUseLocale.mockReturnValue({
      t: (key: string) => key,
      locale: 'en',
      setLocale: mockSetLocale,
      messages: {},
    });
    mockedUseAppearanceStore.mockReturnValue({
      accentColor: 'blue',
      setAccentColor: mockSetAccentColor,
      reducedMotion: false,
      setReducedMotion: mockSetReducedMotion,
    });
    mockedParseAppearanceConfig.mockReturnValue({
      theme: 'dark' as const,
      accentColor: 'green' as const,
      reducedMotion: true,
      locale: 'zh' as const,
      invalidKeys: [],
    });
  });

  it('does nothing when config is empty', () => {
    renderHook(() => useAppearanceConfigSync({}));

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockSetAccentColor).not.toHaveBeenCalled();
    expect(mockSetReducedMotion).not.toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('syncs theme when different from current', () => {
    const config = {
      'appearance.theme': 'dark',
      'appearance.accent_color': 'green',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'zh',
    };

    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('syncs accent color when different from current', () => {
    const config = {
      'appearance.theme': 'light',
      'appearance.accent_color': 'green',
      'appearance.reduced_motion': 'false',
      'appearance.language': 'en',
    };

    mockedParseAppearanceConfig.mockReturnValue({
      theme: 'light',
      accentColor: 'green',
      reducedMotion: false,
      locale: 'en',
      invalidKeys: [],
    });

    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetAccentColor).toHaveBeenCalledWith('green');
  });

  it('syncs reduced motion when different from current', () => {
    const config = {
      'appearance.theme': 'light',
      'appearance.accent_color': 'blue',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'en',
    };

    mockedParseAppearanceConfig.mockReturnValue({
      theme: 'light',
      accentColor: 'blue',
      reducedMotion: true,
      locale: 'en',
      invalidKeys: [],
    });

    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it('syncs locale when different from current', () => {
    const config = {
      'appearance.theme': 'light',
      'appearance.accent_color': 'blue',
      'appearance.reduced_motion': 'false',
      'appearance.language': 'zh',
    };

    mockedParseAppearanceConfig.mockReturnValue({
      theme: 'light',
      accentColor: 'blue',
      reducedMotion: false,
      locale: 'zh',
      invalidKeys: [],
    });

    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetLocale).toHaveBeenCalledWith('zh');
  });

  it('shows warning toast when there are invalid keys', () => {
    const config = {
      'appearance.theme': 'invalid-theme',
      'appearance.accent_color': 'blue',
      'appearance.reduced_motion': 'false',
      'appearance.language': 'en',
    };

    mockedParseAppearanceConfig.mockReturnValue({
      theme: undefined,
      accentColor: 'blue' as const,
      reducedMotion: false,
      locale: 'en' as const,
      invalidKeys: ['theme'],
    });

    renderHook(() => useAppearanceConfigSync(config));

    expect(toast.warning).toHaveBeenCalled();
  });

  it('does not sync values that are the same as current', () => {
    const config = {
      'appearance.theme': 'light',
      'appearance.accent_color': 'blue',
      'appearance.reduced_motion': 'false',
      'appearance.language': 'en',
    };

    mockedParseAppearanceConfig.mockReturnValue({
      theme: 'light',
      accentColor: 'blue',
      reducedMotion: false,
      locale: 'en',
      invalidKeys: [],
    });

    renderHook(() => useAppearanceConfigSync(config));

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockSetAccentColor).not.toHaveBeenCalled();
    expect(mockSetReducedMotion).not.toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('does not re-sync when config snapshot has not changed', () => {
    const config = {
      'appearance.theme': 'dark',
      'appearance.accent_color': 'green',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'zh',
    };

    const { rerender } = renderHook(() => useAppearanceConfigSync(config));

    // Clear mocks after first render
    mockSetTheme.mockClear();
    mockSetAccentColor.mockClear();
    mockSetReducedMotion.mockClear();
    mockSetLocale.mockClear();

    // Rerender with same config - should not trigger setters again
    rerender();

    expect(mockSetTheme).not.toHaveBeenCalled();
  });
});
