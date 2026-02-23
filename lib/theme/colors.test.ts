import { accentColors, applyAccentColor, removeAccentColor, getDefaultAccentColor, CHART_COLOR_PALETTES, applyChartColorTheme, removeChartColorTheme } from './colors';
import type { AccentColor, ChartColorTheme } from './types';

describe('accentColors', () => {
  const expectedColors: AccentColor[] = ['zinc', 'blue', 'green', 'purple', 'orange', 'rose'];

  it('contains all expected accent colors', () => {
    expectedColors.forEach((color) => {
      expect(accentColors[color]).toBeDefined();
    });
  });

  it('each color has light and dark variants', () => {
    expectedColors.forEach((color) => {
      expect(accentColors[color].light).toBeDefined();
      expect(accentColors[color].dark).toBeDefined();
    });
  });

  it('each variant has required color properties', () => {
    const requiredProps = ['primary', 'primary-foreground', 'sidebar-primary', 'sidebar-primary-foreground', 'ring', 'chart-1'];
    
    expectedColors.forEach((color) => {
      requiredProps.forEach((prop) => {
        expect(accentColors[color].light[prop as keyof typeof accentColors.blue.light]).toBeDefined();
        expect(accentColors[color].dark[prop as keyof typeof accentColors.blue.dark]).toBeDefined();
      });
    });
  });

  it('all color values use oklch format', () => {
    expectedColors.forEach((color) => {
      Object.values(accentColors[color].light).forEach((value) => {
        expect(value).toMatch(/^oklch\(/);
      });
      Object.values(accentColors[color].dark).forEach((value) => {
        expect(value).toMatch(/^oklch\(/);
      });
    });
  });
});

describe('applyAccentColor', () => {
  beforeEach(() => {
    // Reset document root style
    document.documentElement.style.cssText = '';
  });

  it('applies light mode colors correctly', () => {
    applyAccentColor('blue', false);
    
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(accentColors.blue.light.primary);
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe(accentColors.blue.light['primary-foreground']);
  });

  it('applies dark mode colors correctly', () => {
    applyAccentColor('blue', true);
    
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(accentColors.blue.dark.primary);
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe(accentColors.blue.dark['primary-foreground']);
  });

  it('applies different accent colors', () => {
    applyAccentColor('rose', false);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(accentColors.rose.light.primary);

    applyAccentColor('green', true);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(accentColors.green.dark.primary);
  });
});

describe('removeAccentColor', () => {
  beforeEach(() => {
    // Apply some colors first
    applyAccentColor('blue', false);
  });

  it('removes all accent color properties', () => {
    removeAccentColor();
    
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ring')).toBe('');
  });
});

describe('getDefaultAccentColor', () => {
  it('returns blue as default', () => {
    expect(getDefaultAccentColor()).toBe('blue');
  });
});

describe('CHART_COLOR_PALETTES', () => {
  const expectedThemes: ChartColorTheme[] = ['default', 'vibrant', 'pastel', 'ocean', 'sunset', 'monochrome'];

  it('contains all expected chart themes', () => {
    expectedThemes.forEach((theme) => {
      expect(CHART_COLOR_PALETTES[theme]).toBeDefined();
    });
  });

  it('each theme has light and dark palettes with 5 colors', () => {
    expectedThemes.forEach((theme) => {
      expect(CHART_COLOR_PALETTES[theme].light).toHaveLength(5);
      expect(CHART_COLOR_PALETTES[theme].dark).toHaveLength(5);
    });
  });

  it('all color values use oklch format', () => {
    expectedThemes.forEach((theme) => {
      CHART_COLOR_PALETTES[theme].light.forEach((color) => {
        expect(color).toMatch(/^oklch\(/);
      });
      CHART_COLOR_PALETTES[theme].dark.forEach((color) => {
        expect(color).toMatch(/^oklch\(/);
      });
    });
  });
});

describe('applyChartColorTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('applies light mode chart colors correctly', () => {
    applyChartColorTheme('default', false);

    for (let i = 0; i < 5; i++) {
      const value = document.documentElement.style.getPropertyValue(`--chart-${i + 1}`);
      expect(value).toBe(CHART_COLOR_PALETTES.default.light[i]);
    }
  });

  it('applies dark mode chart colors correctly', () => {
    applyChartColorTheme('default', true);

    for (let i = 0; i < 5; i++) {
      const value = document.documentElement.style.getPropertyValue(`--chart-${i + 1}`);
      expect(value).toBe(CHART_COLOR_PALETTES.default.dark[i]);
    }
  });

  it('applies different themes', () => {
    applyChartColorTheme('ocean', false);
    expect(document.documentElement.style.getPropertyValue('--chart-1')).toBe(CHART_COLOR_PALETTES.ocean.light[0]);

    applyChartColorTheme('sunset', true);
    expect(document.documentElement.style.getPropertyValue('--chart-1')).toBe(CHART_COLOR_PALETTES.sunset.dark[0]);
  });

  it('handles unknown theme gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    applyChartColorTheme('nonexistent' as ChartColorTheme, false);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    consoleSpy.mockRestore();
  });
});

describe('removeChartColorTheme', () => {
  beforeEach(() => {
    applyChartColorTheme('default', false);
  });

  it('removes all chart color properties', () => {
    removeChartColorTheme();

    for (let i = 1; i <= 5; i++) {
      expect(document.documentElement.style.getPropertyValue(`--chart-${i}`)).toBe('');
    }
  });
});
