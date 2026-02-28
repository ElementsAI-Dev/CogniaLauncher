import {
  POPOVER_OFFSET,
  TOUR_PADDING,
  ARROW_CLASS,
  BUBBLE_HINTS,
  TOUR_STEPS,
  STEP_ICONS,
  LANGUAGES,
  THEMES,
  MIRROR_PRESETS,
  SHELL_OPTIONS,
} from './onboarding';

describe('positioning constants', () => {
  it('POPOVER_OFFSET is a positive number', () => {
    expect(POPOVER_OFFSET).toBeGreaterThan(0);
  });

  it('TOUR_PADDING is a non-negative number', () => {
    expect(TOUR_PADDING).toBeGreaterThanOrEqual(0);
  });

  it('ARROW_CLASS covers all 4 sides', () => {
    expect(ARROW_CLASS).toHaveProperty('top');
    expect(ARROW_CLASS).toHaveProperty('bottom');
    expect(ARROW_CLASS).toHaveProperty('left');
    expect(ARROW_CLASS).toHaveProperty('right');
  });
});

describe('BUBBLE_HINTS', () => {
  it('is a non-empty array', () => {
    expect(BUBBLE_HINTS.length).toBeGreaterThan(0);
  });

  it('each hint has required fields', () => {
    BUBBLE_HINTS.forEach((hint) => {
      expect(hint.id).toBeTruthy();
      expect(hint.target).toBeTruthy();
      expect(hint.titleKey).toBeTruthy();
      expect(hint.descKey).toBeTruthy();
      expect(['top', 'bottom', 'left', 'right']).toContain(hint.side);
    });
  });

  it('has unique IDs', () => {
    const ids = BUBBLE_HINTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TOUR_STEPS', () => {
  it('is a non-empty array', () => {
    expect(TOUR_STEPS.length).toBeGreaterThan(0);
  });

  it('each step has required fields', () => {
    TOUR_STEPS.forEach((step) => {
      expect(step.id).toBeTruthy();
      expect(step.target).toBeTruthy();
      expect(step.titleKey).toBeTruthy();
      expect(step.descKey).toBeTruthy();
    });
  });

  it('has unique IDs', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('STEP_ICONS', () => {
  it('has icon for each wizard step', () => {
    expect(STEP_ICONS['welcome']).toBeDefined();
    expect(STEP_ICONS['language']).toBeDefined();
    expect(STEP_ICONS['theme']).toBeDefined();
    expect(STEP_ICONS['complete']).toBeDefined();
  });
});

describe('LANGUAGES', () => {
  it('contains English and Chinese', () => {
    expect(LANGUAGES).toHaveLength(2);
    const values = LANGUAGES.map((l) => l.value);
    expect(values).toContain('en');
    expect(values).toContain('zh');
  });

  it('each language has value, label, nativeLabel, flag', () => {
    LANGUAGES.forEach((lang) => {
      expect(lang.value).toBeTruthy();
      expect(lang.label).toBeTruthy();
      expect(lang.nativeLabel).toBeTruthy();
      expect(lang.flag).toBeTruthy();
    });
  });
});

describe('THEMES', () => {
  it('has light, dark, system', () => {
    const values = THEMES.map((t) => t.value);
    expect(values).toContain('light');
    expect(values).toContain('dark');
    expect(values).toContain('system');
  });

  it('each theme has icon and preview class', () => {
    THEMES.forEach((theme) => {
      expect(theme.icon).toBeDefined();
      expect(typeof theme.preview).toBe('string');
    });
  });
});

describe('MIRROR_PRESETS', () => {
  it('has default, china, custom', () => {
    const values = MIRROR_PRESETS.map((p) => p.value);
    expect(values).toContain('default');
    expect(values).toContain('china');
    expect(values).toContain('custom');
  });
});

describe('SHELL_OPTIONS', () => {
  it('has powershell, bash, zsh, fish', () => {
    const values = SHELL_OPTIONS.map((s) => s.value);
    expect(values).toContain('powershell');
    expect(values).toContain('bash');
    expect(values).toContain('zsh');
    expect(values).toContain('fish');
  });

  it('each shell has label, configFile, command', () => {
    SHELL_OPTIONS.forEach((shell) => {
      expect(shell.label).toBeTruthy();
      expect(shell.configFile).toBeTruthy();
      expect(shell.command).toBeTruthy();
    });
  });
});
