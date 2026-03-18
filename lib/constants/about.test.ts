import {
  BUILD_DEPENDENCIES,
  ABOUT_BRANDED_EXTERNAL_LINKS,
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
      expect(typeof dep.id).toBe('string');
      expect(typeof dep.name).toBe('string');
      expect(typeof dep.version).toBe('string');
      expect(typeof dep.url).toBe('string');
      expect(typeof dep.icon.category).toBe('string');
      expect(typeof dep.icon.name).toBe('string');
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

  it('each dependency has a configured icon reference', () => {
    BUILD_DEPENDENCIES.forEach((dep) => {
      expect(['brands', 'languages', 'providers']).toContain(dep.icon.category);
      expect(dep.icon.name.length).toBeGreaterThan(0);
    });
  });
});

describe('ABOUT_BRANDED_EXTERNAL_LINKS', () => {
  it('contains the GitHub outbound destination', () => {
    expect(ABOUT_BRANDED_EXTERNAL_LINKS.map((link) => link.id)).toContain('github');
  });

  it('uses icon metadata for each branded destination', () => {
    ABOUT_BRANDED_EXTERNAL_LINKS.forEach((link) => {
      expect(typeof link.label).toBe('string');
      expect(link.url).toMatch(/^https?:\/\//);
      expect(['brands', 'languages', 'providers']).toContain(link.icon.category);
      expect(link.icon.name.length).toBeGreaterThan(0);
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
