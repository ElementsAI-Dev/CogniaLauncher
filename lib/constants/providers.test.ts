import { SYSTEM_PROVIDER_IDS, PACKAGE_MANAGER_IDS, ALL_PROVIDER_IDS } from './providers';

describe('SYSTEM_PROVIDER_IDS', () => {
  it('is a Set', () => {
    expect(SYSTEM_PROVIDER_IDS).toBeInstanceOf(Set);
  });

  it('contains expected system providers', () => {
    const expected = ['apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports', 'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl'];
    expected.forEach((id) => {
      expect(SYSTEM_PROVIDER_IDS.has(id)).toBe(true);
    });
  });

  it('has expected size', () => {
    expect(SYSTEM_PROVIDER_IDS.size).toBe(13);
  });

  it('does not contain language package managers', () => {
    expect(SYSTEM_PROVIDER_IDS.has('npm')).toBe(false);
    expect(SYSTEM_PROVIDER_IDS.has('pip')).toBe(false);
    expect(SYSTEM_PROVIDER_IDS.has('cargo')).toBe(false);
  });
});

describe('PACKAGE_MANAGER_IDS', () => {
  it('is a Set', () => {
    expect(PACKAGE_MANAGER_IDS).toBeInstanceOf(Set);
  });

  it('contains expected package managers', () => {
    const expected = ['npm', 'pnpm', 'yarn', 'pip', 'uv', 'cargo', 'vcpkg', 'docker', 'podman', 'psgallery', 'github'];
    expected.forEach((id) => {
      expect(PACKAGE_MANAGER_IDS.has(id)).toBe(true);
    });
  });

  it('does not overlap with system providers', () => {
    PACKAGE_MANAGER_IDS.forEach((id) => {
      expect(SYSTEM_PROVIDER_IDS.has(id)).toBe(false);
    });
  });
});

describe('ALL_PROVIDER_IDS', () => {
  it('is an array', () => {
    expect(Array.isArray(ALL_PROVIDER_IDS)).toBe(true);
  });

  it('has no duplicates', () => {
    const unique = new Set(ALL_PROVIDER_IDS);
    expect(unique.size).toBe(ALL_PROVIDER_IDS.length);
  });

  it('contains all system provider IDs', () => {
    SYSTEM_PROVIDER_IDS.forEach((id) => {
      expect(ALL_PROVIDER_IDS).toContain(id);
    });
  });

  it('contains all package manager IDs', () => {
    PACKAGE_MANAGER_IDS.forEach((id) => {
      expect(ALL_PROVIDER_IDS).toContain(id);
    });
  });

  it('contains environment/version managers', () => {
    const envManagers = ['nvm', 'fnm', 'pyenv', 'rustup', 'goenv', 'rbenv', 'phpbrew', 'sdkman', 'volta', 'asdf', 'mise', 'nix'];
    envManagers.forEach((id) => {
      expect(ALL_PROVIDER_IDS).toContain(id);
    });
  });

  it('contains C/C++ package managers', () => {
    expect(ALL_PROVIDER_IDS).toContain('vcpkg');
    expect(ALL_PROVIDER_IDS).toContain('conan');
    expect(ALL_PROVIDER_IDS).toContain('xmake');
  });

  it('contains system environment fallbacks', () => {
    const systemFallbacks = ['system-node', 'system-python', 'system-rust', 'system-go', 'system-ruby', 'system-java', 'system-kotlin', 'system-php', 'system-dotnet', 'system-deno', 'system-bun'];
    systemFallbacks.forEach((id) => {
      expect(ALL_PROVIDER_IDS).toContain(id);
    });
  });

  it('has more than 40 providers', () => {
    expect(ALL_PROVIDER_IDS.length).toBeGreaterThan(40);
  });
});
