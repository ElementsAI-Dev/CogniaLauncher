export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor = 'zinc' | 'blue' | 'green' | 'purple' | 'orange' | 'rose';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

export const ACCENT_COLORS: AccentColor[] = ['zinc', 'blue', 'green', 'purple', 'orange', 'rose'];

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

export function isThemeMode(value?: string): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function isAccentColor(value?: string): value is AccentColor {
  return typeof value === 'string' && (ACCENT_COLORS as readonly string[]).includes(value);
}

export type ChartColorTheme = 'default' | 'vibrant' | 'pastel' | 'ocean' | 'sunset' | 'monochrome';

export const CHART_COLOR_THEMES: ChartColorTheme[] = ['default', 'vibrant', 'pastel', 'ocean', 'sunset', 'monochrome'];

export function isChartColorTheme(value?: string): value is ChartColorTheme {
  return typeof value === 'string' && (CHART_COLOR_THEMES as readonly string[]).includes(value);
}

export interface ChartColorPalette {
  light: [string, string, string, string, string];
  dark: [string, string, string, string, string];
}

export type InterfaceRadius = 0 | 0.3 | 0.5 | 0.625 | 0.75 | 1.0;

export const INTERFACE_RADII: InterfaceRadius[] = [0, 0.3, 0.5, 0.625, 0.75, 1.0];

export const INTERFACE_RADIUS_LABELS: Record<InterfaceRadius, string> = {
  0: 'Sharp',
  0.3: 'Slight',
  0.5: 'Medium',
  0.625: 'Default',
  0.75: 'Round',
  1.0: 'Full',
};

export function isInterfaceRadius(value?: string): boolean {
  if (typeof value !== 'string') return false;
  const num = parseFloat(value);
  return !isNaN(num) && (INTERFACE_RADII as readonly number[]).includes(num);
}

export type InterfaceDensity = 'compact' | 'comfortable' | 'spacious';

export const INTERFACE_DENSITIES: InterfaceDensity[] = ['compact', 'comfortable', 'spacious'];

export function isInterfaceDensity(value?: string): value is InterfaceDensity {
  return typeof value === 'string' && (INTERFACE_DENSITIES as readonly string[]).includes(value);
}
