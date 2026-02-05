import {
  defaultLocale,
  localeNames,
  getLocaleFromCookie,
  setLocaleCookie,
  locales,
  type Locale,
} from '../i18n';

describe('i18n utilities', () => {
  describe('constants', () => {
    it('has en as default locale', () => {
      expect(defaultLocale).toBe('en');
    });

    it('has locale names for all supported locales', () => {
      expect(localeNames.en).toBe('English');
      expect(localeNames.zh).toBe('中文');
    });

    it('exports locales array', () => {
      expect(locales).toContain('en');
      expect(locales).toContain('zh');
      expect(locales.length).toBe(2);
    });
  });

  describe('getLocaleFromCookie', () => {
    afterEach(() => {
      // Reset document.cookie after each test
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
    });

    it('returns default locale when no cookie is set', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
      expect(getLocaleFromCookie()).toBe('en');
    });

    it('returns locale from NEXT_LOCALE cookie', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'NEXT_LOCALE=zh',
      });
      expect(getLocaleFromCookie()).toBe('zh');
    });

    it('returns default locale for invalid locale in cookie', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'NEXT_LOCALE=fr',
      });
      expect(getLocaleFromCookie()).toBe('en');
    });

    it('handles cookie among multiple cookies', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'other=value; NEXT_LOCALE=zh; another=test',
      });
      expect(getLocaleFromCookie()).toBe('zh');
    });

    it('returns default locale when document is undefined', () => {
      // Save the original document
      const doc = global.document;
      
      // Temporarily remove document
      // @ts-expect-error - intentionally testing undefined case
      delete global.document;
      
      expect(getLocaleFromCookie()).toBe('en');
      
      // Restore document
      global.document = doc;
    });
  });

  describe('setLocaleCookie', () => {
    it('sets NEXT_LOCALE cookie correctly', () => {
      // Clear any existing NEXT_LOCALE cookie
      document.cookie = 'NEXT_LOCALE=; max-age=0';
      
      setLocaleCookie('zh');
      
      // Verify cookie was set by reading it back
      expect(document.cookie).toContain('NEXT_LOCALE=zh');
    });

    it('can set different locales', () => {
      setLocaleCookie('en');
      expect(document.cookie).toContain('NEXT_LOCALE=en');

      setLocaleCookie('zh');
      expect(document.cookie).toContain('NEXT_LOCALE=zh');
    });

    it('does nothing when document is undefined', () => {
      // Save the original document
      const doc = global.document;
      
      // Temporarily remove document
      // @ts-expect-error - intentionally testing undefined case
      delete global.document;
      
      // Should not throw
      expect(() => setLocaleCookie('zh')).not.toThrow();
      
      // Restore document
      global.document = doc;
    });
  });

  describe('Locale type', () => {
    it('accepts valid locale values', () => {
      const enLocale: Locale = 'en';
      const zhLocale: Locale = 'zh';
      
      expect(enLocale).toBe('en');
      expect(zhLocale).toBe('zh');
    });
  });
});
