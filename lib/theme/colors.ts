import type { AccentColor, AccentColorPalette, ColorScheme } from './types';

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
