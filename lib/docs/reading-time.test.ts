import { estimateReadingTime } from './reading-time';

describe('estimateReadingTime', () => {
  it('returns 1 for very short content', () => {
    expect(estimateReadingTime('Hello')).toBe(1);
  });

  it('estimates English text at ~200 words/min', () => {
    const words = Array(400).fill('word').join(' ');
    expect(estimateReadingTime(words)).toBe(2);
  });

  it('estimates Chinese text at ~400 chars/min', () => {
    const chars = '字'.repeat(800);
    expect(estimateReadingTime(chars)).toBe(2);
  });

  it('handles mixed CJK and English', () => {
    const mixed = '你好世界 '.repeat(100) + Array(100).fill('hello').join(' ');
    const result = estimateReadingTime(mixed);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('strips code blocks before counting', () => {
    const content = '# Title\n\n```typescript\n' + Array(500).fill('const x = 1;').join('\n') + '\n```\n\nShort paragraph.';
    const result = estimateReadingTime(content);
    expect(result).toBe(1);
  });
});
