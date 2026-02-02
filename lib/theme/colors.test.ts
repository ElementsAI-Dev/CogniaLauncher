import { accentColors, applyAccentColor, removeAccentColor, getDefaultAccentColor } from './colors';
import type { AccentColor } from './types';

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
