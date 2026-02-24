import type { ChangelogChangeType } from './about';

export function getTypeColor(type: string): string {
  switch (type) {
    case 'added':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'changed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'fixed':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'removed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'deprecated':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'security':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'performance':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'breaking':
      return 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

const TYPE_I18N_KEY: Record<string, string> = {
  added: 'about.changelogAdded',
  changed: 'about.changelogChanged',
  fixed: 'about.changelogFixed',
  removed: 'about.changelogRemoved',
  deprecated: 'about.changelogDeprecated',
  security: 'about.changelogSecurity',
  performance: 'about.changelogPerformance',
  breaking: 'about.changelogBreaking',
};

export function getTypeLabel(
  type: string | ChangelogChangeType,
  t: (key: string) => string,
): string {
  return TYPE_I18N_KEY[type] ? t(TYPE_I18N_KEY[type]) : type;
}

/** Simple semver comparison (major.minor.patch). Returns negative if a < b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
