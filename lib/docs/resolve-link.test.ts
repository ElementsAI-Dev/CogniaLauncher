import { resolveDocLink } from './resolve-link';

describe('resolveDocLink', () => {
  it('resolves anchor links', () => {
    expect(resolveDocLink('#section')).toEqual({ type: 'anchor', resolved: '#section' });
  });

  it('resolves .md file links with basePath', () => {
    expect(resolveDocLink('installation.md', 'guide')).toEqual({
      type: 'internal',
      resolved: '/docs/guide/installation',
    });
  });

  it('resolves .md file links without basePath', () => {
    expect(resolveDocLink('installation.md')).toEqual({
      type: 'internal',
      resolved: '/docs/installation',
    });
  });

  it('resolves ./ relative links with basePath', () => {
    expect(resolveDocLink('./configuration', 'guide')).toEqual({
      type: 'internal',
      resolved: '/docs/guide/configuration',
    });
  });

  it('resolves ./ relative links without basePath', () => {
    expect(resolveDocLink('./configuration')).toEqual({
      type: 'internal',
      resolved: '/docs/configuration',
    });
  });

  it('resolves ../ relative links with basePath', () => {
    expect(resolveDocLink('../index', 'guide/sub')).toEqual({
      type: 'internal',
      resolved: '/docs/guide/index',
    });
  });

  it('resolves ../ relative links without basePath', () => {
    expect(resolveDocLink('../overview')).toEqual({
      type: 'internal',
      resolved: '/docs/overview',
    });
  });

  it('resolves bare filename with basePath (no / in name)', () => {
    expect(resolveDocLink('configuration.md', 'guide')).toEqual({
      type: 'internal',
      resolved: '/docs/guide/configuration',
    });
  });

  it('resolves http external links', () => {
    expect(resolveDocLink('http://example.com')).toEqual({
      type: 'external',
      resolved: 'http://example.com',
    });
  });

  it('resolves https external links', () => {
    expect(resolveDocLink('https://github.com/repo')).toEqual({
      type: 'external',
      resolved: 'https://github.com/repo',
    });
  });

  it('resolves plain links as plain type', () => {
    expect(resolveDocLink('mailto:test@example.com')).toEqual({
      type: 'plain',
      resolved: 'mailto:test@example.com',
    });
  });

  it('resolves .md link with path separators', () => {
    expect(resolveDocLink('sub/page.md', 'docs')).toEqual({
      type: 'internal',
      resolved: '/docs/sub/page',
    });
  });
});
