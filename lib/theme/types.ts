export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor = 'zinc' | 'blue' | 'green' | 'purple' | 'orange' | 'rose';

export interface ThemeConfig {
  mode: ThemeMode;
  accentColor: AccentColor;
  reducedMotion: boolean;
}

export interface ColorScheme {
  primary: string;
  'primary-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  ring: string;
  'chart-1': string;
}

export interface AccentColorDefinition {
  light: ColorScheme;
  dark: ColorScheme;
}

export interface AccentColorPalette {
  [key: string]: AccentColorDefinition;
}

export const ACCENT_COLOR_LABELS: Record<AccentColor, string> = {
  zinc: 'Zinc',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
  orange: 'Orange',
  rose: 'Rose',
};

export const ACCENT_COLOR_CSS_CLASSES: Record<AccentColor, string> = {
  zinc: 'bg-zinc-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  purple: 'bg-purple-600',
  orange: 'bg-orange-600',
  rose: 'bg-rose-600',
};
