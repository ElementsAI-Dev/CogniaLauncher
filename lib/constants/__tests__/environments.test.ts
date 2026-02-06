import {
  LANGUAGES,
  DEFAULT_PROVIDERS,
  DEFAULT_DETECTION_FILES,
  VERSION_FILTERS,
  INSTALLATION_STEPS,
  type LanguageId,
  type VersionFilter,
  type InstallationStep,
} from '../environments';

describe('Environment Constants', () => {
  describe('LANGUAGES', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(LANGUAGES)).toBe(true);
      expect(LANGUAGES.length).toBeGreaterThan(0);
    });

    it('contains all expected languages', () => {
      const expectedIds = ['node', 'python', 'go', 'rust', 'ruby', 'java', 'php', 'dotnet', 'deno', 'bun'];
      expectedIds.forEach((id) => {
        const lang = LANGUAGES.find((l) => l.id === id);
        expect(lang).toBeDefined();
      });
    });

    it('each language has required properties', () => {
      LANGUAGES.forEach((lang) => {
        expect(lang.id).toBeDefined();
        expect(typeof lang.id).toBe('string');
        expect(lang.name).toBeDefined();
        expect(typeof lang.name).toBe('string');
        expect(lang.icon).toBeDefined();
        expect(typeof lang.icon).toBe('string');
        expect(lang.color).toBeDefined();
        expect(typeof lang.color).toBe('string');
      });
    });

    it('has unique language IDs', () => {
      const ids = LANGUAGES.map((l) => l.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('color property contains tailwind classes', () => {
      LANGUAGES.forEach((lang) => {
        expect(lang.color).toMatch(/bg-\w+-\d+/);
        expect(lang.color).toMatch(/border-\w+-\d+/);
      });
    });

    it('has correct display names', () => {
      const node = LANGUAGES.find((l) => l.id === 'node');
      expect(node?.name).toBe('Node.js');

      const python = LANGUAGES.find((l) => l.id === 'python');
      expect(python?.name).toBe('Python');

      const rust = LANGUAGES.find((l) => l.id === 'rust');
      expect(rust?.name).toBe('Rust');
    });
  });

  describe('DEFAULT_PROVIDERS', () => {
    it('has providers for all languages', () => {
      const languageIds = LANGUAGES.map((l) => l.id);
      languageIds.forEach((id) => {
        expect(DEFAULT_PROVIDERS[id]).toBeDefined();
        expect(Array.isArray(DEFAULT_PROVIDERS[id])).toBe(true);
        expect(DEFAULT_PROVIDERS[id].length).toBeGreaterThan(0);
      });
    });

    it('each provider has required properties', () => {
      Object.values(DEFAULT_PROVIDERS).forEach((providers) => {
        providers.forEach((provider) => {
          expect(provider.id).toBeDefined();
          expect(typeof provider.id).toBe('string');
          expect(provider.name).toBeDefined();
          expect(typeof provider.name).toBe('string');
          expect(provider.description).toBeDefined();
          expect(typeof provider.description).toBe('string');
        });
      });
    });

    it('node has fnm and nvm providers', () => {
      const nodeProviders = DEFAULT_PROVIDERS.node;
      const fnm = nodeProviders.find((p) => p.id === 'fnm');
      const nvm = nodeProviders.find((p) => p.id === 'nvm');
      
      expect(fnm).toBeDefined();
      expect(nvm).toBeDefined();
    });

    it('python has pyenv provider', () => {
      const pythonProviders = DEFAULT_PROVIDERS.python;
      const pyenv = pythonProviders.find((p) => p.id === 'pyenv');
      expect(pyenv).toBeDefined();
    });

    it('rust has rustup provider', () => {
      const rustProviders = DEFAULT_PROVIDERS.rust;
      const rustup = rustProviders.find((p) => p.id === 'rustup');
      expect(rustup).toBeDefined();
    });
  });

  describe('DEFAULT_DETECTION_FILES', () => {
    it('has detection files for all languages', () => {
      const languageIds = LANGUAGES.map((l) => l.id);
      languageIds.forEach((id) => {
        expect(DEFAULT_DETECTION_FILES[id]).toBeDefined();
        expect(Array.isArray(DEFAULT_DETECTION_FILES[id])).toBe(true);
        expect(DEFAULT_DETECTION_FILES[id].length).toBeGreaterThan(0);
      });
    });

    it('node has expected detection files', () => {
      const nodeFiles = DEFAULT_DETECTION_FILES.node;
      expect(nodeFiles).toContain('.nvmrc');
      expect(nodeFiles).toContain('.node-version');
    });

    it('python has expected detection files', () => {
      const pythonFiles = DEFAULT_DETECTION_FILES.python;
      expect(pythonFiles).toContain('.python-version');
      expect(pythonFiles).toContain('pyproject.toml');
    });

    it('rust has expected detection files', () => {
      const rustFiles = DEFAULT_DETECTION_FILES.rust;
      expect(rustFiles).toContain('rust-toolchain.toml');
      expect(rustFiles).toContain('rust-toolchain');
    });

    it('all languages support .tool-versions', () => {
      Object.values(DEFAULT_DETECTION_FILES).forEach((files) => {
        expect(files).toContain('.tool-versions');
      });
    });
  });

  describe('VERSION_FILTERS', () => {
    it('contains all expected filters', () => {
      expect(VERSION_FILTERS).toContain('all');
      expect(VERSION_FILTERS).toContain('stable');
      expect(VERSION_FILTERS).toContain('lts');
      expect(VERSION_FILTERS).toContain('latest');
    });

    it('has exactly 4 filters', () => {
      expect(VERSION_FILTERS.length).toBe(4);
    });

    it('is readonly at TypeScript level', () => {
      // TypeScript ensures this at compile time via 'as const'
      // Runtime immutability is not enforced, but type safety is
      expect(Array.isArray(VERSION_FILTERS)).toBe(true);
    });
  });

  describe('INSTALLATION_STEPS', () => {
    it('contains all expected steps', () => {
      expect(INSTALLATION_STEPS).toContain('fetching');
      expect(INSTALLATION_STEPS).toContain('downloading');
      expect(INSTALLATION_STEPS).toContain('extracting');
      expect(INSTALLATION_STEPS).toContain('configuring');
      expect(INSTALLATION_STEPS).toContain('done');
      expect(INSTALLATION_STEPS).toContain('error');
    });

    it('has exactly 6 steps', () => {
      expect(INSTALLATION_STEPS.length).toBe(6);
    });

    it('has steps in logical order', () => {
      const fetchingIndex = INSTALLATION_STEPS.indexOf('fetching');
      const downloadingIndex = INSTALLATION_STEPS.indexOf('downloading');
      const extractingIndex = INSTALLATION_STEPS.indexOf('extracting');
      const configuringIndex = INSTALLATION_STEPS.indexOf('configuring');
      const doneIndex = INSTALLATION_STEPS.indexOf('done');

      expect(fetchingIndex).toBeLessThan(downloadingIndex);
      expect(downloadingIndex).toBeLessThan(extractingIndex);
      expect(extractingIndex).toBeLessThan(configuringIndex);
      expect(configuringIndex).toBeLessThan(doneIndex);
    });

    it('is readonly at TypeScript level', () => {
      // TypeScript ensures this at compile time via 'as const'
      expect(Array.isArray(INSTALLATION_STEPS)).toBe(true);
    });
  });

  describe('Type definitions', () => {
    it('LanguageId type matches LANGUAGES ids', () => {
      const languageIds: LanguageId[] = LANGUAGES.map((l) => l.id);
      expect(languageIds).toContain('node');
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('rust');
    });

    it('VersionFilter type matches VERSION_FILTERS', () => {
      const filters: VersionFilter[] = [...VERSION_FILTERS];
      expect(filters).toContain('all');
      expect(filters).toContain('stable');
    });

    it('InstallationStep type matches INSTALLATION_STEPS', () => {
      const steps: InstallationStep[] = [...INSTALLATION_STEPS];
      expect(steps).toContain('downloading');
      expect(steps).toContain('done');
    });
  });
});
