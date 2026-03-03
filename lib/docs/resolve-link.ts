export interface ResolvedLink {
  type: 'internal' | 'external' | 'anchor' | 'plain';
  resolved: string;
}

function splitHref(href: string): { pathname: string; suffix: string } {
  const queryIndex = href.indexOf('?');
  const hashIndex = href.indexOf('#');
  let splitIndex = -1;

  if (queryIndex !== -1 && hashIndex !== -1) {
    splitIndex = Math.min(queryIndex, hashIndex);
  } else if (queryIndex !== -1) {
    splitIndex = queryIndex;
  } else if (hashIndex !== -1) {
    splitIndex = hashIndex;
  }

  if (splitIndex === -1) {
    return { pathname: href, suffix: '' };
  }

  return {
    pathname: href.slice(0, splitIndex),
    suffix: href.slice(splitIndex),
  };
}

function normalizeDocPath(pathname: string, basePath?: string): string {
  const withoutExt = pathname.replace(/\.md$/i, '');
  const baseSegments = (basePath ?? '').split('/').filter(Boolean);
  const sourceSegments = withoutExt.split('/').filter(Boolean);
  const segments = withoutExt.startsWith('/') ? [] : [...baseSegments];

  for (const segment of sourceSegments) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop();
      }
      continue;
    }
    segments.push(segment);
  }

  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  return segments.join('/');
}

export function resolveDocLink(href: string, basePath?: string): ResolvedLink {
  if (href.startsWith('#')) {
    return { type: 'anchor', resolved: href };
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { type: 'external', resolved: href };
  }

  const { pathname, suffix } = splitHref(href);
  const isInternalDocPath =
    pathname.endsWith('.md') || pathname.startsWith('./') || pathname.startsWith('../');

  if (isInternalDocPath) {
    const resolvedPath = normalizeDocPath(pathname, basePath);
    const resolved = resolvedPath.length > 0 ? `/docs/${resolvedPath}` : '/docs';
    return { type: 'internal', resolved: `${resolved}${suffix}` };
  }

  return { type: 'plain', resolved: href };
}
