import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('is defined and non-empty', () => {
    expect(APP_VERSION).toBeDefined();
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it('follows semver format', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('matches package.json version', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../package.json');
    expect(APP_VERSION).toBe(pkg.version);
  });
});
