import { COMMON_WSL2_SETTINGS, QUICK_SETTINGS, NETWORK_PRESETS, PM_LABELS } from './wsl';

describe('COMMON_WSL2_SETTINGS', () => {
  it('is a non-empty array', () => {
    expect(COMMON_WSL2_SETTINGS.length).toBeGreaterThan(0);
  });

  it('each setting has required fields', () => {
    COMMON_WSL2_SETTINGS.forEach((s) => {
      expect(s.key).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(['text', 'bool', 'select']).toContain(s.type);
      expect(['wsl2', 'experimental']).toContain(s.section);
    });
  });

  it('contains memory setting', () => {
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'memory')).toBeDefined();
  });

  it('select type settings have options', () => {
    COMMON_WSL2_SETTINGS.filter((s) => s.type === 'select').forEach((s) => {
      expect(s.options).toBeDefined();
      expect(s.options!.length).toBeGreaterThan(0);
    });
  });
});

describe('QUICK_SETTINGS', () => {
  it('is a non-empty array', () => {
    expect(QUICK_SETTINGS.length).toBeGreaterThan(0);
  });

  it('each setting has required fields', () => {
    QUICK_SETTINGS.forEach((s) => {
      expect(s.section).toBeTruthy();
      expect(s.key).toBeTruthy();
      expect(s.labelKey).toBeTruthy();
      expect(s.descKey).toBeTruthy();
      expect(['boolean', 'text']).toContain(s.type);
      expect(s.defaultValue).toBeDefined();
    });
  });

  it('contains systemd setting', () => {
    expect(QUICK_SETTINGS.find((s) => s.key === 'systemd')).toBeDefined();
  });
});

describe('NETWORK_PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(NETWORK_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('each preset has required fields', () => {
    NETWORK_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.labelKey).toBeTruthy();
      expect(p.descKey).toBeTruthy();
      expect(p.settings.length).toBeGreaterThan(0);
    });
  });

  it('has unique IDs', () => {
    const ids = NETWORK_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('PM_LABELS', () => {
  it('is a non-empty Record', () => {
    expect(Object.keys(PM_LABELS).length).toBeGreaterThan(0);
  });

  it('maps apt to its label', () => {
    expect(PM_LABELS['apt']).toBe('APT (dpkg)');
  });

  it('maps pacman to its label', () => {
    expect(PM_LABELS['pacman']).toBe('Pacman');
  });
});
