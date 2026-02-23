import type { AccentColor, AccentColorPalette, ChartColorPalette, ChartColorTheme, ColorScheme } from './types';

/**
 * Accent color definitions using oklch color space for perceptual uniformity.
 * Each accent color has light and dark mode variants.
 */
export const accentColors: AccentColorPalette = {
  zinc: {
    light: {
      primary: 'oklch(0.205 0 0)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.205 0 0)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.708 0 0)',
      'chart-1': 'oklch(0.646 0.222 41.116)',
    },
    dark: {
      primary: 'oklch(0.922 0 0)',
      'primary-foreground': 'oklch(0.205 0 0)',
      'sidebar-primary': 'oklch(0.922 0 0)',
      'sidebar-primary-foreground': 'oklch(0.205 0 0)',
      ring: 'oklch(0.556 0 0)',
      'chart-1': 'oklch(0.488 0.243 264.376)',
    },
  },
  blue: {
    light: {
      primary: 'oklch(0.488 0.243 264.376)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.488 0.243 264.376)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.623 0.214 259.815)',
      'chart-1': 'oklch(0.488 0.243 264.376)',
    },
    dark: {
      primary: 'oklch(0.623 0.214 259.815)',
      'primary-foreground': 'oklch(0.145 0 0)',
      'sidebar-primary': 'oklch(0.623 0.214 259.815)',
      'sidebar-primary-foreground': 'oklch(0.145 0 0)',
      ring: 'oklch(0.488 0.243 264.376)',
      'chart-1': 'oklch(0.623 0.214 259.815)',
    },
  },
  green: {
    light: {
      primary: 'oklch(0.517 0.176 142.495)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.517 0.176 142.495)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.696 0.17 162.48)',
      'chart-1': 'oklch(0.517 0.176 142.495)',
    },
    dark: {
      primary: 'oklch(0.696 0.17 162.48)',
      'primary-foreground': 'oklch(0.145 0 0)',
      'sidebar-primary': 'oklch(0.696 0.17 162.48)',
      'sidebar-primary-foreground': 'oklch(0.145 0 0)',
      ring: 'oklch(0.517 0.176 142.495)',
      'chart-1': 'oklch(0.696 0.17 162.48)',
    },
  },
  purple: {
    light: {
      primary: 'oklch(0.493 0.237 292.009)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.493 0.237 292.009)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.627 0.265 303.9)',
      'chart-1': 'oklch(0.493 0.237 292.009)',
    },
    dark: {
      primary: 'oklch(0.627 0.265 303.9)',
      'primary-foreground': 'oklch(0.145 0 0)',
      'sidebar-primary': 'oklch(0.627 0.265 303.9)',
      'sidebar-primary-foreground': 'oklch(0.145 0 0)',
      ring: 'oklch(0.493 0.237 292.009)',
      'chart-1': 'oklch(0.627 0.265 303.9)',
    },
  },
  orange: {
    light: {
      primary: 'oklch(0.606 0.22 45.105)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.606 0.22 45.105)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.744 0.172 55.053)',
      'chart-1': 'oklch(0.606 0.22 45.105)',
    },
    dark: {
      primary: 'oklch(0.744 0.172 55.053)',
      'primary-foreground': 'oklch(0.145 0 0)',
      'sidebar-primary': 'oklch(0.744 0.172 55.053)',
      'sidebar-primary-foreground': 'oklch(0.145 0 0)',
      ring: 'oklch(0.606 0.22 45.105)',
      'chart-1': 'oklch(0.744 0.172 55.053)',
    },
  },
  rose: {
    light: {
      primary: 'oklch(0.577 0.245 27.325)',
      'primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.577 0.245 27.325)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      ring: 'oklch(0.704 0.191 22.216)',
      'chart-1': 'oklch(0.577 0.245 27.325)',
    },
    dark: {
      primary: 'oklch(0.704 0.191 22.216)',
      'primary-foreground': 'oklch(0.145 0 0)',
      'sidebar-primary': 'oklch(0.704 0.191 22.216)',
      'sidebar-primary-foreground': 'oklch(0.145 0 0)',
      ring: 'oklch(0.577 0.245 27.325)',
      'chart-1': 'oklch(0.704 0.191 22.216)',
    },
  },
} as const;

/**
 * Apply accent color CSS variables to the document root.
 * @param color - The accent color to apply
 * @param isDark - Whether dark mode is active
 */
export function applyAccentColor(color: AccentColor, isDark: boolean): void {
  if (typeof document === 'undefined') return;
  
  const mode = isDark ? 'dark' : 'light';
  const colorDef = accentColors[color];
  
  if (!colorDef) {
    console.warn(`Unknown accent color: ${color}`);
    return;
  }
  
  const colors: ColorScheme = colorDef[mode];
  const root = document.documentElement;
  
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}

/**
 * Remove custom accent color CSS variables from the document root.
 * This resets to the default theme colors defined in globals.css.
 */
export function removeAccentColor(): void {
  if (typeof document === 'undefined') return;
  
  const properties = [
    '--primary',
    '--primary-foreground',
    '--sidebar-primary',
    '--sidebar-primary-foreground',
    '--ring',
    '--chart-1',
  ];
  
  const root = document.documentElement;
  properties.forEach((prop) => {
    root.style.removeProperty(prop);
  });
}

/**
 * Get the current accent color from the store or default.
 */
export function getDefaultAccentColor(): AccentColor {
  return 'blue';
}

/**
 * Chart color palettes for each chart color theme.
 * Each palette defines 5 colors for light and dark modes using oklch.
 */
export const CHART_COLOR_PALETTES: Record<ChartColorTheme, ChartColorPalette> = {
  default: {
    light: [
      'oklch(0.646 0.222 41.116)',
      'oklch(0.6 0.118 184.704)',
      'oklch(0.398 0.07 227.392)',
      'oklch(0.828 0.189 84.429)',
      'oklch(0.769 0.188 70.08)',
    ],
    dark: [
      'oklch(0.488 0.243 264.376)',
      'oklch(0.696 0.17 162.48)',
      'oklch(0.769 0.188 70.08)',
      'oklch(0.627 0.265 303.9)',
      'oklch(0.645 0.246 16.439)',
    ],
  },
  vibrant: {
    light: [
      'oklch(0.55 0.28 264)',
      'oklch(0.62 0.24 145)',
      'oklch(0.65 0.26 30)',
      'oklch(0.58 0.27 305)',
      'oklch(0.70 0.22 55)',
    ],
    dark: [
      'oklch(0.68 0.26 264)',
      'oklch(0.72 0.22 145)',
      'oklch(0.74 0.24 30)',
      'oklch(0.70 0.25 305)',
      'oklch(0.78 0.20 55)',
    ],
  },
  pastel: {
    light: [
      'oklch(0.78 0.12 264)',
      'oklch(0.80 0.10 162)',
      'oklch(0.82 0.11 84)',
      'oklch(0.79 0.13 330)',
      'oklch(0.81 0.09 200)',
    ],
    dark: [
      'oklch(0.65 0.14 264)',
      'oklch(0.67 0.12 162)',
      'oklch(0.69 0.13 84)',
      'oklch(0.66 0.15 330)',
      'oklch(0.68 0.11 200)',
    ],
  },
  ocean: {
    light: [
      'oklch(0.55 0.20 230)',
      'oklch(0.60 0.16 195)',
      'oklch(0.50 0.18 260)',
      'oklch(0.65 0.14 175)',
      'oklch(0.45 0.15 245)',
    ],
    dark: [
      'oklch(0.65 0.18 230)',
      'oklch(0.70 0.14 195)',
      'oklch(0.60 0.16 260)',
      'oklch(0.75 0.12 175)',
      'oklch(0.55 0.13 245)',
    ],
  },
  sunset: {
    light: [
      'oklch(0.62 0.24 25)',
      'oklch(0.70 0.20 55)',
      'oklch(0.58 0.22 350)',
      'oklch(0.75 0.18 80)',
      'oklch(0.55 0.25 10)',
    ],
    dark: [
      'oklch(0.70 0.22 25)',
      'oklch(0.76 0.18 55)',
      'oklch(0.66 0.20 350)',
      'oklch(0.80 0.16 80)',
      'oklch(0.63 0.23 10)',
    ],
  },
  monochrome: {
    light: [
      'oklch(0.30 0 0)',
      'oklch(0.45 0 0)',
      'oklch(0.60 0 0)',
      'oklch(0.75 0 0)',
      'oklch(0.50 0 0)',
    ],
    dark: [
      'oklch(0.90 0 0)',
      'oklch(0.75 0 0)',
      'oklch(0.60 0 0)',
      'oklch(0.45 0 0)',
      'oklch(0.70 0 0)',
    ],
  },
};

/**
 * Apply chart color theme CSS variables to the document root.
 * Sets --chart-1 through --chart-5 based on the selected theme and mode.
 */
export function applyChartColorTheme(theme: ChartColorTheme, isDark: boolean): void {
  if (typeof document === 'undefined') return;

  const mode = isDark ? 'dark' : 'light';
  const palette = CHART_COLOR_PALETTES[theme];

  if (!palette) {
    console.warn(`Unknown chart color theme: ${theme}`);
    return;
  }

  const colors = palette[mode];
  const root = document.documentElement;

  colors.forEach((value, index) => {
    root.style.setProperty(`--chart-${index + 1}`, value);
  });
}

/**
 * Remove custom chart color CSS variables, reverting to globals.css defaults.
 */
export function removeChartColorTheme(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  for (let i = 1; i <= 5; i++) {
    root.style.removeProperty(`--chart-${i}`);
  }
}
