/**
 * Estimate reading time for markdown content.
 * Chinese: ~400 characters/min, English: ~200 words/min.
 */
export function estimateReadingTime(content: string): number {
  // Strip code blocks
  const stripped = content.replace(/```[\s\S]*?```/g, '');

  // Count CJK characters
  const cjkChars = (stripped.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;

  // Count non-CJK words
  const nonCjk = stripped.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '');
  const words = nonCjk.split(/\s+/).filter((w) => w.length > 0).length;

  const minutes = cjkChars / 400 + words / 200;
  return Math.max(1, Math.round(minutes));
}
