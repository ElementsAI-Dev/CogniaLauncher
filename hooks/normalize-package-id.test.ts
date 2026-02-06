import { normalizePackageId } from './use-packages';

describe('normalizePackageId', () => {
  describe('simple package names', () => {
    it('should return simple package name unchanged', () => {
      expect(normalizePackageId('lodash')).toBe('lodash');
    });

    it('should handle package names with hyphens', () => {
      expect(normalizePackageId('cli-service')).toBe('cli-service');
    });

    it('should handle package names with underscores', () => {
      expect(normalizePackageId('my_package')).toBe('my_package');
    });
  });

  describe('packages with versions', () => {
    it('should strip numeric versions', () => {
      expect(normalizePackageId('lodash@4.17.21')).toBe('lodash');
    });

    it('should strip caret versions', () => {
      expect(normalizePackageId('lodash@^4.0.0')).toBe('lodash');
    });

    it('should strip tilde versions', () => {
      expect(normalizePackageId('lodash@~4.0.0')).toBe('lodash');
    });

    it('should strip wildcard versions', () => {
      expect(normalizePackageId('lodash@*')).toBe('lodash');
      expect(normalizePackageId('lodash@x')).toBe('lodash');
      expect(normalizePackageId('lodash@X')).toBe('lodash');
    });

    it('should strip version with v prefix', () => {
      expect(normalizePackageId('lodash@v4.17.21')).toBe('lodash');
    });
  });

  describe('packages with comparison operators', () => {
    it('should strip >= versions', () => {
      expect(normalizePackageId('lodash@>=4.0.0')).toBe('lodash');
    });

    it('should strip <= versions', () => {
      expect(normalizePackageId('lodash@<=4.0.0')).toBe('lodash');
    });

    it('should strip > versions', () => {
      expect(normalizePackageId('lodash@>4.0.0')).toBe('lodash');
    });

    it('should strip < versions', () => {
      expect(normalizePackageId('lodash@<4.0.0')).toBe('lodash');
    });

    it('should strip = versions', () => {
      expect(normalizePackageId('lodash@=4.0.0')).toBe('lodash');
    });
  });

  describe('packages with dist tags', () => {
    it('should strip latest tag', () => {
      expect(normalizePackageId('lodash@latest')).toBe('lodash');
    });

    it('should strip next tag', () => {
      expect(normalizePackageId('lodash@next')).toBe('lodash');
    });

    it('should strip beta tag', () => {
      expect(normalizePackageId('lodash@beta')).toBe('lodash');
    });

    it('should strip alpha tag', () => {
      expect(normalizePackageId('lodash@alpha')).toBe('lodash');
    });

    it('should strip canary tag', () => {
      expect(normalizePackageId('lodash@canary')).toBe('lodash');
    });

    it('should strip rc tag', () => {
      expect(normalizePackageId('lodash@rc')).toBe('lodash');
    });

    it('should strip stable tag', () => {
      expect(normalizePackageId('lodash@stable')).toBe('lodash');
    });

    it('should strip dev tag', () => {
      expect(normalizePackageId('lodash@dev')).toBe('lodash');
    });

    it('should strip nightly tag', () => {
      expect(normalizePackageId('lodash@nightly')).toBe('lodash');
    });

    it('should handle case-insensitive dist tags', () => {
      expect(normalizePackageId('lodash@LATEST')).toBe('lodash');
      expect(normalizePackageId('lodash@Latest')).toBe('lodash');
    });
  });

  describe('scoped packages', () => {
    it('should handle scoped packages without version', () => {
      expect(normalizePackageId('@types/node')).toBe('@types/node');
      expect(normalizePackageId('@vue/cli-service')).toBe('@vue/cli-service');
    });

    it('should handle scoped packages with version', () => {
      expect(normalizePackageId('@types/node@18.0.0')).toBe('@types/node');
    });

    it('should handle scoped packages with caret version', () => {
      expect(normalizePackageId('@types/react@^18.0.0')).toBe('@types/react');
    });

    it('should handle scoped packages with dist tag', () => {
      expect(normalizePackageId('@types/node@latest')).toBe('@types/node');
    });

    it('should handle scoped packages with comparison operators', () => {
      expect(normalizePackageId('@types/node@>=18.0.0')).toBe('@types/node');
    });
  });

  describe('packages with provider prefix', () => {
    it('should preserve provider prefix', () => {
      expect(normalizePackageId('npm:lodash')).toBe('npm:lodash');
    });

    it('should preserve provider and strip version', () => {
      expect(normalizePackageId('npm:lodash@4.17.21')).toBe('npm:lodash');
    });

    it('should preserve provider with scoped package', () => {
      expect(normalizePackageId('npm:@types/node')).toBe('npm:@types/node');
    });

    it('should preserve provider with scoped package and version', () => {
      expect(normalizePackageId('npm:@types/node@18.0.0')).toBe('npm:@types/node');
    });

    it('should preserve provider with dist tag', () => {
      expect(normalizePackageId('npm:lodash@latest')).toBe('npm:lodash');
    });
  });

  describe('dist tags with hyphen suffix', () => {
    it('should strip beta-N tags', () => {
      expect(normalizePackageId('lodash@beta-1')).toBe('lodash');
    });

    it('should strip rc-N tags', () => {
      expect(normalizePackageId('lodash@rc-1')).toBe('lodash');
    });

    it('should strip next-N tags', () => {
      expect(normalizePackageId('react@next-14')).toBe('react');
    });

    it('should strip canary-N tags', () => {
      expect(normalizePackageId('next@canary-20240101')).toBe('next');
    });
  });

  describe('strings starting with dist tag names that are NOT versions', () => {
    it('should NOT treat "development" as a version (starts with "dev")', () => {
      expect(normalizePackageId('lodash@development')).toBe('lodash@development');
    });

    it('should NOT treat "devices" as a version (starts with "dev")', () => {
      expect(normalizePackageId('lodash@devices')).toBe('lodash@devices');
    });

    it('should NOT treat "rctool" as a version (starts with "rc")', () => {
      expect(normalizePackageId('lodash@rctool')).toBe('lodash@rctool');
    });

    it('should NOT treat "latestversion" as a version (starts with "latest")', () => {
      expect(normalizePackageId('lodash@latestversion')).toBe('lodash@latestversion');
    });

    it('should NOT treat "stablerelease" as a version (starts with "stable")', () => {
      expect(normalizePackageId('lodash@stablerelease')).toBe('lodash@stablerelease');
    });

    it('should NOT treat "nightlytest" as a version (starts with "nightly")', () => {
      expect(normalizePackageId('lodash@nightlytest')).toBe('lodash@nightlytest');
    });
  });

  describe('edge cases', () => {
    it('should not treat @ at start as version separator', () => {
      expect(normalizePackageId('@scope/package')).toBe('@scope/package');
    });

    it('should handle package names that look like versions but are not', () => {
      expect(normalizePackageId('package-v8')).toBe('package-v8');
    });

    it('should handle empty @ suffix', () => {
      expect(normalizePackageId('lodash@')).toBe('lodash@');
    });

    it('should not treat non-version @ suffixes as versions', () => {
      expect(normalizePackageId('lodash@something')).toBe('lodash@something');
    });

    it('should handle scoped package with only scope (no slash)', () => {
      expect(normalizePackageId('@scope')).toBe('@scope');
    });

    it('should handle deeply scoped packages', () => {
      expect(normalizePackageId('@org/sub/pkg@1.0.0')).toBe('@org/sub/pkg');
    });
  });
});
