import {
  THEME_MODES,
  ACCENT_COLORS,
  ACCENT_COLOR_LABELS,
  ACCENT_COLOR_CSS_CLASSES,
  INTERFACE_RADII,
  INTERFACE_RADIUS_LABELS,
  INTERFACE_DENSITIES,
  CHART_COLOR_THEMES,
  isThemeMode,
  isAccentColor,
  isChartColorTheme,
  isInterfaceRadius,
  isInterfaceDensity,
  type ThemeMode,
  type AccentColor,
  type InterfaceRadius,
  type InterfaceDensity,
  type ChartColorTheme,
  type ChartColorPalette,
  type ThemeConfig,
  type ColorScheme,
  type AccentColorDefinition,
  type AccentColorPalette,
} from './types';

describe('Theme Types', () => {
  describe('THEME_MODES', () => {
    it('contains all expected modes', () => {
      expect(THEME_MODES).toContain('light');
      expect(THEME_MODES).toContain('dark');
      expect(THEME_MODES).toContain('system');
    });

    it('has exactly 3 modes', () => {
      expect(THEME_MODES.length).toBe(3);
    });
  });

  describe('ACCENT_COLORS', () => {
    it('contains all expected colors', () => {
      const expectedColors = ['zinc', 'blue', 'green', 'purple', 'orange', 'rose'];
      expectedColors.forEach((color) => {
        expect(ACCENT_COLORS).toContain(color);
      });
    });

    it('has exactly 6 colors', () => {
      expect(ACCENT_COLORS.length).toBe(6);
    });
  });

  describe('ACCENT_COLOR_LABELS', () => {
    it('has labels for all accent colors', () => {
      ACCENT_COLORS.forEach((color) => {
        expect(ACCENT_COLOR_LABELS[color]).toBeDefined();
        expect(typeof ACCENT_COLOR_LABELS[color]).toBe('string');
      });
    });

    it('has correct labels', () => {
      expect(ACCENT_COLOR_LABELS.zinc).toBe('Zinc');
      expect(ACCENT_COLOR_LABELS.blue).toBe('Blue');
      expect(ACCENT_COLOR_LABELS.green).toBe('Green');
      expect(ACCENT_COLOR_LABELS.purple).toBe('Purple');
      expect(ACCENT_COLOR_LABELS.orange).toBe('Orange');
      expect(ACCENT_COLOR_LABELS.rose).toBe('Rose');
    });
  });

  describe('ACCENT_COLOR_CSS_CLASSES', () => {
    it('has CSS classes for all accent colors', () => {
      ACCENT_COLORS.forEach((color) => {
        expect(ACCENT_COLOR_CSS_CLASSES[color]).toBeDefined();
        expect(typeof ACCENT_COLOR_CSS_CLASSES[color]).toBe('string');
      });
    });

    it('all classes are valid tailwind bg classes', () => {
      Object.values(ACCENT_COLOR_CSS_CLASSES).forEach((cssClass) => {
        expect(cssClass).toMatch(/^bg-\w+-\d+$/);
      });
    });

    it('has correct CSS classes', () => {
      expect(ACCENT_COLOR_CSS_CLASSES.zinc).toBe('bg-zinc-600');
      expect(ACCENT_COLOR_CSS_CLASSES.blue).toBe('bg-blue-600');
      expect(ACCENT_COLOR_CSS_CLASSES.green).toBe('bg-green-600');
      expect(ACCENT_COLOR_CSS_CLASSES.purple).toBe('bg-purple-600');
      expect(ACCENT_COLOR_CSS_CLASSES.orange).toBe('bg-orange-600');
      expect(ACCENT_COLOR_CSS_CLASSES.rose).toBe('bg-rose-600');
    });
  });

  describe('isThemeMode', () => {
    it('returns true for valid theme modes', () => {
      expect(isThemeMode('light')).toBe(true);
      expect(isThemeMode('dark')).toBe(true);
      expect(isThemeMode('system')).toBe(true);
    });

    it('returns false for invalid theme modes', () => {
      expect(isThemeMode('invalid')).toBe(false);
      expect(isThemeMode('auto')).toBe(false);
      expect(isThemeMode('night')).toBe(false);
      expect(isThemeMode('day')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isThemeMode(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isThemeMode('')).toBe(false);
    });

    it('returns false for non-string values', () => {
      // @ts-expect-error - testing invalid input
      expect(isThemeMode(123)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isThemeMode(null)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isThemeMode({})).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isThemeMode('Light')).toBe(false);
      expect(isThemeMode('DARK')).toBe(false);
      expect(isThemeMode('System')).toBe(false);
    });
  });

  describe('isAccentColor', () => {
    it('returns true for valid accent colors', () => {
      expect(isAccentColor('zinc')).toBe(true);
      expect(isAccentColor('blue')).toBe(true);
      expect(isAccentColor('green')).toBe(true);
      expect(isAccentColor('purple')).toBe(true);
      expect(isAccentColor('orange')).toBe(true);
      expect(isAccentColor('rose')).toBe(true);
    });

    it('returns false for invalid accent colors', () => {
      expect(isAccentColor('red')).toBe(false);
      expect(isAccentColor('pink')).toBe(false);
      expect(isAccentColor('teal')).toBe(false);
      expect(isAccentColor('primary')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAccentColor(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isAccentColor('')).toBe(false);
    });

    it('returns false for non-string values', () => {
      // @ts-expect-error - testing invalid input
      expect(isAccentColor(123)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isAccentColor(null)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isAccentColor([])).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isAccentColor('Blue')).toBe(false);
      expect(isAccentColor('GREEN')).toBe(false);
      expect(isAccentColor('Rose')).toBe(false);
    });
  });

  describe('CHART_COLOR_THEMES', () => {
    it('contains all expected themes', () => {
      expect(CHART_COLOR_THEMES).toContain('default');
      expect(CHART_COLOR_THEMES).toContain('vibrant');
      expect(CHART_COLOR_THEMES).toContain('pastel');
      expect(CHART_COLOR_THEMES).toContain('ocean');
      expect(CHART_COLOR_THEMES).toContain('sunset');
      expect(CHART_COLOR_THEMES).toContain('monochrome');
    });

    it('has exactly 6 themes', () => {
      expect(CHART_COLOR_THEMES.length).toBe(6);
    });
  });

  describe('isChartColorTheme', () => {
    it('returns true for valid themes', () => {
      expect(isChartColorTheme('default')).toBe(true);
      expect(isChartColorTheme('vibrant')).toBe(true);
      expect(isChartColorTheme('ocean')).toBe(true);
      expect(isChartColorTheme('monochrome')).toBe(true);
    });

    it('returns false for invalid themes', () => {
      expect(isChartColorTheme('neon')).toBe(false);
      expect(isChartColorTheme('rainbow')).toBe(false);
      expect(isChartColorTheme(undefined)).toBe(false);
      expect(isChartColorTheme('')).toBe(false);
    });
  });

  describe('INTERFACE_RADII', () => {
    it('contains all expected radius values', () => {
      expect(INTERFACE_RADII).toContain(0);
      expect(INTERFACE_RADII).toContain(0.3);
      expect(INTERFACE_RADII).toContain(0.5);
      expect(INTERFACE_RADII).toContain(0.625);
      expect(INTERFACE_RADII).toContain(0.75);
      expect(INTERFACE_RADII).toContain(1.0);
    });

    it('has exactly 6 values', () => {
      expect(INTERFACE_RADII.length).toBe(6);
    });
  });

  describe('INTERFACE_RADIUS_LABELS', () => {
    it('has labels for all radii', () => {
      INTERFACE_RADII.forEach((r) => {
        expect(INTERFACE_RADIUS_LABELS[r]).toBeDefined();
        expect(typeof INTERFACE_RADIUS_LABELS[r]).toBe('string');
      });
    });

    it('has correct label values', () => {
      expect(INTERFACE_RADIUS_LABELS[0]).toBe('Sharp');
      expect(INTERFACE_RADIUS_LABELS[0.625]).toBe('Default');
      expect(INTERFACE_RADIUS_LABELS[1.0]).toBe('Full');
    });
  });

  describe('isInterfaceRadius', () => {
    it('returns true for valid radius strings', () => {
      expect(isInterfaceRadius('0')).toBe(true);
      expect(isInterfaceRadius('0.3')).toBe(true);
      expect(isInterfaceRadius('0.5')).toBe(true);
      expect(isInterfaceRadius('0.625')).toBe(true);
      expect(isInterfaceRadius('0.75')).toBe(true);
      expect(isInterfaceRadius('1')).toBe(true);
    });

    it('returns false for invalid radius strings', () => {
      expect(isInterfaceRadius('0.4')).toBe(false);
      expect(isInterfaceRadius('2')).toBe(false);
      expect(isInterfaceRadius('abc')).toBe(false);
      expect(isInterfaceRadius('')).toBe(false);
      expect(isInterfaceRadius(undefined)).toBe(false);
    });
  });

  describe('INTERFACE_DENSITIES', () => {
    it('contains all expected densities', () => {
      expect(INTERFACE_DENSITIES).toContain('compact');
      expect(INTERFACE_DENSITIES).toContain('comfortable');
      expect(INTERFACE_DENSITIES).toContain('spacious');
    });

    it('has exactly 3 densities', () => {
      expect(INTERFACE_DENSITIES.length).toBe(3);
    });
  });

  describe('isInterfaceDensity', () => {
    it('returns true for valid densities', () => {
      expect(isInterfaceDensity('compact')).toBe(true);
      expect(isInterfaceDensity('comfortable')).toBe(true);
      expect(isInterfaceDensity('spacious')).toBe(true);
    });

    it('returns false for invalid densities', () => {
      expect(isInterfaceDensity('tight')).toBe(false);
      expect(isInterfaceDensity('normal')).toBe(false);
      expect(isInterfaceDensity(undefined)).toBe(false);
      expect(isInterfaceDensity('')).toBe(false);
    });
  });

  describe('Type definitions', () => {
    it('ThemeMode type accepts valid values', () => {
      const light: ThemeMode = 'light';
      const dark: ThemeMode = 'dark';
      const system: ThemeMode = 'system';

      expect(light).toBe('light');
      expect(dark).toBe('dark');
      expect(system).toBe('system');
    });

    it('AccentColor type accepts valid values', () => {
      const zinc: AccentColor = 'zinc';
      const blue: AccentColor = 'blue';
      const green: AccentColor = 'green';
      const purple: AccentColor = 'purple';
      const orange: AccentColor = 'orange';
      const rose: AccentColor = 'rose';

      expect(zinc).toBe('zinc');
      expect(blue).toBe('blue');
      expect(green).toBe('green');
      expect(purple).toBe('purple');
      expect(orange).toBe('orange');
      expect(rose).toBe('rose');
    });

    it('ThemeConfig has correct shape', () => {
      const config: ThemeConfig = {
        mode: 'dark',
        accentColor: 'blue',
        reducedMotion: false,
      };

      expect(config.mode).toBe('dark');
      expect(config.accentColor).toBe('blue');
      expect(config.reducedMotion).toBe(false);
    });

    it('ColorScheme has correct shape', () => {
      const scheme: ColorScheme = {
        primary: 'oklch(0.488 0.243 264.376)',
        'primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-primary': 'oklch(0.488 0.243 264.376)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        ring: 'oklch(0.623 0.214 259.815)',
        'chart-1': 'oklch(0.488 0.243 264.376)',
      };

      expect(scheme.primary).toBeDefined();
      expect(scheme['primary-foreground']).toBeDefined();
      expect(scheme.ring).toBeDefined();
    });

    it('AccentColorDefinition has correct shape', () => {
      const definition: AccentColorDefinition = {
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
      };

      expect(definition.light).toBeDefined();
      expect(definition.dark).toBeDefined();
    });

    it('AccentColorPalette has correct shape', () => {
      const palette: AccentColorPalette = {
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
      };

      expect(palette.blue).toBeDefined();
      expect(palette.blue.light).toBeDefined();
      expect(palette.blue.dark).toBeDefined();
    });

    it('InterfaceRadius type accepts valid values', () => {
      const sharp: InterfaceRadius = 0;
      const def: InterfaceRadius = 0.625;
      const full: InterfaceRadius = 1.0;

      expect(sharp).toBe(0);
      expect(def).toBe(0.625);
      expect(full).toBe(1.0);
    });

    it('InterfaceDensity type accepts valid values', () => {
      const compact: InterfaceDensity = 'compact';
      const comfortable: InterfaceDensity = 'comfortable';
      const spacious: InterfaceDensity = 'spacious';

      expect(compact).toBe('compact');
      expect(comfortable).toBe('comfortable');
      expect(spacious).toBe('spacious');
    });

    it('ChartColorTheme type accepts valid values', () => {
      const def: ChartColorTheme = 'default';
      const ocean: ChartColorTheme = 'ocean';
      const mono: ChartColorTheme = 'monochrome';

      expect(def).toBe('default');
      expect(ocean).toBe('ocean');
      expect(mono).toBe('monochrome');
    });

    it('ChartColorPalette has correct shape', () => {
      const palette: ChartColorPalette = {
        light: ['c1', 'c2', 'c3', 'c4', 'c5'],
        dark: ['d1', 'd2', 'd3', 'd4', 'd5'],
      };

      expect(palette.light).toHaveLength(5);
      expect(palette.dark).toHaveLength(5);
    });
  });
});
