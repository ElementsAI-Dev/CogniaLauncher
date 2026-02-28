export type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const CALLOUT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

/**
 * Parse a callout type from blockquote children text.
 * Returns the callout type and cleaned text, or null if not a callout.
 */
export function parseCallout(text: string): { type: CalloutType; rest: string } | null {
  const match = text.match(CALLOUT_REGEX);
  if (!match) return null;
  return {
    type: match[1].toLowerCase() as CalloutType,
    rest: text.replace(CALLOUT_REGEX, ''),
  };
}

export function getCalloutIcon(type: CalloutType): string {
  switch (type) {
    case 'note': return 'ℹ️';
    case 'tip': return '💡';
    case 'important': return '❗';
    case 'warning': return '⚠️';
    case 'caution': return '🔴';
  }
}
