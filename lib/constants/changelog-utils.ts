import type { ChangelogChange, ChangelogChangeType } from './about';

type ParsedVersionIdentifier =
  | { kind: 'numeric'; value: number; raw: string }
  | { kind: 'alpha'; value: string; raw: string };

type ParsedVersionLike = {
  major: number;
  minor: number;
  patch: number;
  prerelease: ParsedVersionIdentifier[] | null;
  raw: string;
};

function parsePrereleaseIdentifiers(input: string): ParsedVersionIdentifier[] {
  return input
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const maybeNumber = Number(raw);
      if (/^\d+$/.test(raw) && Number.isFinite(maybeNumber)) {
        return { kind: 'numeric', value: maybeNumber, raw } as const;
      }
      return { kind: 'alpha', value: raw.toLowerCase(), raw } as const;
    });
}

function parseVersionLike(input: string): ParsedVersionLike | null {
  const trimmed = input.trim();
  const normalized = trimmed.replace(/^v(?=\d)/i, '');
  const match = normalized.match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/,
  );
  if (!match) return null;

  const major = Number(match[1] ?? 0);
  const minor = Number(match[2] ?? 0);
  const patch = Number(match[3] ?? 0);
  if (![major, minor, patch].every((n) => Number.isFinite(n))) return null;

  const prereleaseRaw = match[4] ? String(match[4]) : null;
  const prerelease = prereleaseRaw
    ? parsePrereleaseIdentifiers(prereleaseRaw)
    : null;

  return { major, minor, patch, prerelease, raw: trimmed };
}

function compareParsedIdentifiers(
  a: ParsedVersionIdentifier,
  b: ParsedVersionIdentifier,
): number {
  if (a.kind === 'numeric' && b.kind === 'numeric') {
    return a.value - b.value;
  }
  if (a.kind === 'numeric' && b.kind === 'alpha') {
    // SemVer: numeric identifiers have lower precedence than non-numeric.
    return -1;
  }
  if (a.kind === 'alpha' && b.kind === 'numeric') {
    return 1;
  }
  if (a.kind === 'alpha' && b.kind === 'alpha') {
    return a.value.localeCompare(b.value, 'en', { sensitivity: 'base' });
  }
  return 0;
}

function comparePrerelease(
  a: ParsedVersionIdentifier[] | null,
  b: ParsedVersionIdentifier[] | null,
): number {
  if (!a && !b) return 0;
  if (!a && b) return 1; // release > prerelease
  if (a && !b) return -1;

  const aa = a ?? [];
  const bb = b ?? [];
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const ai = aa[i];
    const bi = bb[i];
    if (!ai && bi) return -1;
    if (ai && !bi) return 1;
    if (!ai || !bi) continue;
    const diff = compareParsedIdentifiers(ai, bi);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Deterministic version-like comparison.
 * - Supports `v` prefix, missing minor/patch, and prerelease tags (e.g. 1.2.3-rc.1).
 * - For non-parseable versions, falls back to a stable lexical compare.
 *
 * Returns negative if a < b, positive if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersionLike(a);
  const pb = parseVersionLike(b);

  if (!pa && !pb) {
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
  }
  if (pa && !pb) return 1;
  if (!pa && pb) return -1;

  const aParsed = pa!;
  const bParsed = pb!;

  const majorDiff = aParsed.major - bParsed.major;
  if (majorDiff !== 0) return majorDiff;
  const minorDiff = aParsed.minor - bParsed.minor;
  if (minorDiff !== 0) return minorDiff;
  const patchDiff = aParsed.patch - bParsed.patch;
  if (patchDiff !== 0) return patchDiff;

  return comparePrerelease(aParsed.prerelease, bParsed.prerelease);
}

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

/** Backwards-compatible semver-ish comparison. Returns negative if a < b. */
export function compareSemver(a: string, b: string): number {
  return compareVersions(a, b);
}

const CHANGE_TYPE_HEADING_ALIASES: Array<[ChangelogChangeType, RegExp[]]> = [
  [
    'added',
    [/^added$/i, /^additions?$/i, /^new$/i, /^(新增|添加|增加)$/],
  ],
  [
    'changed',
    [
      /^changed$/i,
      /^changes$/i,
      /^updated$/i,
      /^update$/i,
      /^(变更|更改|更新)$/,
    ],
  ],
  [
    'fixed',
    [/^fixed$/i, /^fixes$/i, /^bug fixes?$/i, /^(修复|修正)$/],
  ],
  [
    'removed',
    [/^removed$/i, /^removals?$/i, /^(移除|删除)$/],
  ],
  [
    'deprecated',
    [/^deprecated$/i, /^(弃用)$/],
  ],
  [
    'security',
    [/^security$/i, /^(安全)$/],
  ],
  [
    'performance',
    [/^performance$/i, /^perf$/i, /^(性能)$/],
  ],
  [
    'breaking',
    [/^breaking$/i, /^breaking changes?$/i, /^(破坏性|不兼容|重大变更)$/],
  ],
];

function normalizeHeadingText(text: string): string {
  return text
    .trim()
    .replace(/[:：]\s*$/, '')
    .replace(/^\[(.+)\]$/, '$1')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function headingToChangeType(heading: string): ChangelogChangeType | null {
  const normalized = normalizeHeadingText(heading);
  for (const [type, aliases] of CHANGE_TYPE_HEADING_ALIASES) {
    if (aliases.some((re) => re.test(normalized))) return type;
  }
  return null;
}

function extractListItemText(line: string): string | null {
  const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
  if (bullet?.[1]) return bullet[1].trim();
  const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
  if (ordered?.[1]) return ordered[1].trim();
  return null;
}

/**
 * Best-effort parser for GitHub release notes.
 * Only extracts items when a recognizable change-type heading is found.
 */
export function parseReleaseNotesToChanges(markdownBody: string): ChangelogChange[] {
  const lines = markdownBody.split(/\r?\n/);
  const changes: ChangelogChange[] = [];

  let currentType: ChangelogChangeType | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch?.[1]) {
      currentType = headingToChangeType(headingMatch[1]);
      continue;
    }

    const boldHeadingMatch = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (boldHeadingMatch?.[1]) {
      currentType = headingToChangeType(boldHeadingMatch[1]);
      continue;
    }

    const itemText = extractListItemText(line);
    if (!itemText) continue;
    if (!currentType) continue;

    const description = itemText.trim();
    if (!description) continue;

    changes.push({ type: currentType, description });
  }

  return changes;
}
