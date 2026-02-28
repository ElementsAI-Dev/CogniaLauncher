import { PROVIDER_ICON_FILES, PLATFORM_ICON_FILES, LANGUAGE_ICON_FILES, CACHE_PROVIDER_MAP } from './icon-maps';

describe('PROVIDER_ICON_FILES', () => {
  it('is a non-empty Record', () => {
    expect(Object.keys(PROVIDER_ICON_FILES).length).toBeGreaterThan(0);
  });

  it('contains core providers', () => {
    expect(PROVIDER_ICON_FILES['npm']).toBe('npm');
    expect(PROVIDER_ICON_FILES['pip']).toBe('pip');
    expect(PROVIDER_ICON_FILES['cargo']).toBe('cargo');
    expect(PROVIDER_ICON_FILES['brew']).toBe('brew');
    expect(PROVIDER_ICON_FILES['winget']).toBe('winget');
  });

  it('maps system providers to their base icons', () => {
    expect(PROVIDER_ICON_FILES['system-node']).toBe('nvm');
    expect(PROVIDER_ICON_FILES['system-python']).toBe('pyenv');
    expect(PROVIDER_ICON_FILES['system-rust']).toBe('rustup');
  });

  it('all values are non-empty strings', () => {
    Object.values(PROVIDER_ICON_FILES).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

describe('PLATFORM_ICON_FILES', () => {
  it('contains windows, linux, macos', () => {
    expect(PLATFORM_ICON_FILES['windows']).toBeDefined();
    expect(PLATFORM_ICON_FILES['linux']).toBeDefined();
    expect(PLATFORM_ICON_FILES['macos']).toBeDefined();
  });
});

describe('LANGUAGE_ICON_FILES', () => {
  it('contains major language icons', () => {
    expect(LANGUAGE_ICON_FILES['node']).toBe('node');
    expect(LANGUAGE_ICON_FILES['python']).toBe('python');
    expect(LANGUAGE_ICON_FILES['rust']).toBe('rust');
    expect(LANGUAGE_ICON_FILES['go']).toBe('go');
    expect(LANGUAGE_ICON_FILES['java']).toBe('java');
  });

  it('has more than 20 languages', () => {
    expect(Object.keys(LANGUAGE_ICON_FILES).length).toBeGreaterThan(20);
  });
});

describe('CACHE_PROVIDER_MAP', () => {
  it('maps cache types to provider IDs', () => {
    expect(CACHE_PROVIDER_MAP['npm']).toBe('npm');
    expect(CACHE_PROVIDER_MAP['pip']).toBe('pip');
    expect(CACHE_PROVIDER_MAP['cargo']).toBe('cargo');
    expect(CACHE_PROVIDER_MAP['gradle']).toBe('sdkman');
  });

  it('has more than 20 entries', () => {
    expect(Object.keys(CACHE_PROVIDER_MAP).length).toBeGreaterThan(20);
  });
});
