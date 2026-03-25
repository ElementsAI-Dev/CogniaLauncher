import { DOCS_GITHUB_DEFAULT_BRANCH, DOCS_GITHUB_REPO_URL, getDocsEditUrl } from './source';

describe('docs source workflow helpers', () => {
  it('exports the configured repository source of truth', () => {
    expect(DOCS_GITHUB_REPO_URL).toBe('https://github.com/AstroAir/CogniaLauncher');
    expect(DOCS_GITHUB_DEFAULT_BRANCH).toBe('master');
  });

  it('builds edit URLs against the configured default branch', () => {
    expect(getDocsEditUrl('docs/en/reference/hooks.md')).toBe(
      'https://github.com/AstroAir/CogniaLauncher/edit/master/docs/en/reference/hooks.md'
    );
  });

  it('keeps canonical section index paths intact', () => {
    expect(getDocsEditUrl('docs/zh/guide/index.md')).toBe(
      'https://github.com/AstroAir/CogniaLauncher/edit/master/docs/zh/guide/index.md'
    );
  });
});
