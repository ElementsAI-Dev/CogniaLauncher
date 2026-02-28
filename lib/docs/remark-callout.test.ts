import { parseCallout, getCalloutIcon } from './remark-callout';

describe('parseCallout', () => {
  it('parses [!NOTE] callout', () => {
    const result = parseCallout('[!NOTE] This is a note');
    expect(result).toEqual({ type: 'note', rest: 'This is a note' });
  });

  it('parses [!TIP] callout', () => {
    const result = parseCallout('[!TIP] A useful tip');
    expect(result).toEqual({ type: 'tip', rest: 'A useful tip' });
  });

  it('parses [!IMPORTANT] callout', () => {
    const result = parseCallout('[!IMPORTANT] Pay attention');
    expect(result).toEqual({ type: 'important', rest: 'Pay attention' });
  });

  it('parses [!WARNING] callout', () => {
    const result = parseCallout('[!WARNING] Be careful');
    expect(result).toEqual({ type: 'warning', rest: 'Be careful' });
  });

  it('parses [!CAUTION] callout', () => {
    const result = parseCallout('[!CAUTION] Danger zone');
    expect(result).toEqual({ type: 'caution', rest: 'Danger zone' });
  });

  it('is case-insensitive', () => {
    const result = parseCallout('[!note] lowercase');
    expect(result).toEqual({ type: 'note', rest: 'lowercase' });
  });

  it('returns null for non-callout text', () => {
    expect(parseCallout('Just regular text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCallout('')).toBeNull();
  });

  it('handles callout with no trailing text', () => {
    const result = parseCallout('[!TIP] ');
    expect(result).toEqual({ type: 'tip', rest: '' });
  });
});

describe('getCalloutIcon', () => {
  it('returns info icon for note', () => {
    expect(getCalloutIcon('note')).toBe('ℹ️');
  });

  it('returns bulb icon for tip', () => {
    expect(getCalloutIcon('tip')).toBe('💡');
  });

  it('returns exclamation icon for important', () => {
    expect(getCalloutIcon('important')).toBe('❗');
  });

  it('returns warning icon for warning', () => {
    expect(getCalloutIcon('warning')).toBe('⚠️');
  });

  it('returns red circle for caution', () => {
    expect(getCalloutIcon('caution')).toBe('🔴');
  });
});
