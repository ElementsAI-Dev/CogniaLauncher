export interface ResolvedLink {
  type: 'internal' | 'external' | 'anchor' | 'plain';
  resolved: string;
}

export function resolveDocLink(href: string, basePath?: string): ResolvedLink {
  if (href.startsWith('#')) {
    return { type: 'anchor', resolved: href };
  }

  if (href.endsWith('.md') || href.startsWith('../') || href.startsWith('./')) {
    let resolved = href.replace(/\.md$/, '');
    if (resolved.startsWith('../')) {
      // Go up one directory from basePath, then append rest
      const parentDir = basePath?.split('/').slice(0, -1).join('/') ?? '';
      resolved = resolved.replace(/^\.\.\//, '');
      resolved = parentDir ? `${parentDir}/${resolved}` : resolved;
    } else if (resolved.startsWith('./')) {
      resolved = resolved.replace(/^\.\//, '');
      resolved = basePath ? `${basePath}/${resolved}` : resolved;
    } else if (!resolved.includes('/') && basePath) {
      // Bare filename like "configuration" — resolve relative to basePath
      resolved = `${basePath}/${resolved}`;
    }
    return { type: 'internal', resolved: `/docs/${resolved}` };
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { type: 'external', resolved: href };
  }

  return { type: 'plain', resolved: href };
}
