import { cn, formatSize, formatSpeed } from '../utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });

  it('handles undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles empty strings', () => {
    expect(cn('base', '', 'end')).toBe('base end');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-4 py-2', 'px-8')).toBe('py-2 px-8');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('handles complex mixed inputs', () => {
    expect(cn('base', ['array-class'], { 'object-class': true })).toBe('base array-class object-class');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('formatSize', () => {
  describe('basic formatting', () => {
    it('formats bytes correctly', () => {
      expect(formatSize(500)).toBe('500.0 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatSize(1048576)).toBe('1.0 MB');
      expect(formatSize(1572864)).toBe('1.5 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatSize(1073741824)).toBe('1.0 GB');
      expect(formatSize(1610612736)).toBe('1.5 GB');
    });

    it('caps at gigabytes for very large values', () => {
      expect(formatSize(1099511627776)).toBe('1024.0 GB');
    });
  });

  describe('edge cases', () => {
    it('formats zero bytes', () => {
      expect(formatSize(0)).toBe('0.0 B');
    });

    it('returns fallback for null', () => {
      expect(formatSize(null)).toBe('Unknown');
    });

    it('returns fallback for undefined', () => {
      expect(formatSize(undefined)).toBe('Unknown');
    });

    it('accepts custom fallback string', () => {
      expect(formatSize(null, 'N/A')).toBe('N/A');
      expect(formatSize(undefined, '-')).toBe('-');
    });

    it('handles very small positive values', () => {
      expect(formatSize(1)).toBe('1.0 B');
    });

    it('handles exact boundary values', () => {
      expect(formatSize(1023)).toBe('1023.0 B');
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(1025)).toBe('1.0 KB');
    });
  });

  describe('precision', () => {
    it('always shows one decimal place', () => {
      expect(formatSize(100)).toBe('100.0 B');
      expect(formatSize(1000)).toBe('1000.0 B');
      expect(formatSize(2048)).toBe('2.0 KB');
    });
  });
});

describe('formatSpeed', () => {
  describe('basic formatting', () => {
    it('formats bytes per second correctly', () => {
      expect(formatSpeed(500)).toBe('500.0 B/s');
    });

    it('formats kilobytes per second correctly', () => {
      expect(formatSpeed(1024)).toBe('1.0 KB/s');
      expect(formatSpeed(1536)).toBe('1.5 KB/s');
    });

    it('formats megabytes per second correctly', () => {
      expect(formatSpeed(1048576)).toBe('1.0 MB/s');
      expect(formatSpeed(1572864)).toBe('1.5 MB/s');
    });

    it('formats gigabytes per second correctly', () => {
      expect(formatSpeed(1073741824)).toBe('1.0 GB/s');
      expect(formatSpeed(1610612736)).toBe('1.5 GB/s');
    });
  });

  describe('edge cases', () => {
    it('formats zero speed', () => {
      expect(formatSpeed(0)).toBe('0.0 B/s');
    });

    it('handles very small positive values', () => {
      expect(formatSpeed(1)).toBe('1.0 B/s');
    });

    it('handles exact boundary values', () => {
      expect(formatSpeed(1023)).toBe('1023.0 B/s');
      expect(formatSpeed(1024)).toBe('1.0 KB/s');
    });

    it('caps at gigabytes for very large values', () => {
      expect(formatSpeed(1099511627776)).toBe('1024.0 GB/s');
    });
  });

  describe('precision', () => {
    it('always shows one decimal place', () => {
      expect(formatSpeed(100)).toBe('100.0 B/s');
      expect(formatSpeed(2048)).toBe('2.0 KB/s');
    });

    it('rounds correctly', () => {
      expect(formatSpeed(1536)).toBe('1.5 KB/s');
      expect(formatSpeed(2560)).toBe('2.5 KB/s');
    });
  });
});
