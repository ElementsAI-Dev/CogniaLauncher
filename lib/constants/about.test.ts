import {
  BUILD_DEPENDENCIES,
  getChangelog,
  type BuildDependency,
  type ChangelogEntry,
  type ChangelogChangeType,
} from './about';

describe('BUILD_DEPENDENCIES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(BUILD_DEPENDENCIES)).toBe(true);
    expect(BUILD_DEPENDENCIES.length).toBeGreaterThan(0);
  });

  it('contains Tauri, Rust, Next.js, and React', () => {
    const names = BUILD_DEPENDENCIES.map((d) => d.name);
    expect(names).toContain('Tauri');
    expect(names).toContain('Rust');
    expect(names).toContain('Next.js');
    expect(names).toContain('React');
  });

  it('each dependency has all required fields', () => {
    BUILD_DEPENDENCIES.forEach((dep: BuildDependency) => {
      expect(typeof dep.name).toBe('string');
      expect(typeof dep.version).toBe('string');
      expect(typeof dep.color).toBe('string');
      expect(typeof dep.textColor).toBe('string');
      expect(typeof dep.darkColor).toBe('string');
      expect(typeof dep.darkTextColor).toBe('string');
      expect(typeof dep.letter).toBe('string');
      expect(typeof dep.url).toBe('string');
    });
  });

  it('each dependency has a valid URL', () => {
    BUILD_DEPENDENCIES.forEach((dep) => {
      expect(dep.url).toMatch(/^https?:\/\//);
    });
  });

  it('each dependency version starts with v', () => {
    BUILD_DEPENDENCIES.forEach((dep) => {
      expect(dep.version).toMatch(/^v\d/);
    });
  });

  it('each dependency has a non-empty letter', () => {
    BUILD_DEPENDENCIES.forEach((dep) => {
      expect(dep.letter.length).toBeGreaterThan(0);
    });
  });

  it('colors are hex format', () => {
    BUILD_DEPENDENCIES.forEach((dep) => {
      expect(dep.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(dep.textColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(dep.darkColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(dep.darkTextColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe('getChangelog', () => {
  it('returns English changelog for "en"', () => {
    const changelog = getChangelog('en');
    expect(Array.isArray(changelog)).toBe(true);
    expect(changelog.length).toBeGreaterThan(0);
  });

  it('returns Chinese changelog for "zh"', () => {
    const changelog = getChangelog('zh');
    expect(Array.isArray(changelog)).toBe(true);
    expect(changelog.length).toBeGreaterThan(0);
  });

  it('falls back to English for unknown locale', () => {
    const changelog = getChangelog('fr');
    const enChangelog = getChangelog('en');
    expect(changelog).toEqual(enChangelog);
  });

  it('each entry has required fields', () => {
    const changelog = getChangelog('en');
    changelog.forEach((entry: ChangelogEntry) => {
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(Array.isArray(entry.changes)).toBe(true);
      expect(entry.changes.length).toBeGreaterThan(0);
    });
  });

  it('each change has valid type and description', () => {
    const validTypes: ChangelogChangeType[] = [
      'added', 'changed', 'fixed', 'removed',
      'deprecated', 'security', 'performance', 'breaking',
    ];
    const changelog = getChangelog('en');
    changelog.forEach((entry) => {
      entry.changes.forEach((change) => {
        expect(validTypes).toContain(change.type);
        expect(typeof change.description).toBe('string');
        expect(change.description.length).toBeGreaterThan(0);
      });
    });
  });

  it('entry dates follow YYYY-MM-DD format', () => {
    const changelog = getChangelog('en');
    changelog.forEach((entry) => {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('entry versions follow semver format', () => {
    const changelog = getChangelog('en');
    changelog.forEach((entry) => {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  it('en and zh have the same number of entries', () => {
    const en = getChangelog('en');
    const zh = getChangelog('zh');
    expect(en.length).toBe(zh.length);
  });

  it('en and zh entries have matching versions', () => {
    const en = getChangelog('en');
    const zh = getChangelog('zh');
    en.forEach((entry, i) => {
      expect(entry.version).toBe(zh[i].version);
    });
  });

  it('local entries have source set to local', () => {
    const changelog = getChangelog('en');
    changelog.forEach((entry) => {
      if (entry.source) {
        expect(['local', 'remote']).toContain(entry.source);
      }
    });
  });
});
