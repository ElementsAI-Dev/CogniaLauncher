import { isInternalNavigationPath } from './plugin-navigation';

describe('plugin-navigation', () => {
  it('accepts app-relative paths', () => {
    expect(isInternalNavigationPath('/toolbox/plugins')).toBe(true);
  });

  it('rejects protocol-relative paths', () => {
    expect(isInternalNavigationPath('//example.com')).toBe(false);
  });

  it('rejects non-app paths', () => {
    expect(isInternalNavigationPath('https://example.com')).toBe(false);
    expect(isInternalNavigationPath('toolbox/plugins')).toBe(false);
    expect(isInternalNavigationPath('')).toBe(false);
  });
});
