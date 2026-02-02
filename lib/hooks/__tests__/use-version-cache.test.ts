import { renderHook, act } from '@testing-library/react';
import { useVersionCache } from '../use-version-cache';

describe('useVersionCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get cached values', () => {
      const { result } = renderHook(() => useVersionCache<string[]>());

      act(() => {
        result.current.set('node', ['20.0.0', '18.0.0']);
      });

      expect(result.current.get('node')).toEqual(['20.0.0', '18.0.0']);
    });

    it('should return null for non-existent keys', () => {
      const { result } = renderHook(() => useVersionCache<string[]>());

      expect(result.current.get('python')).toBeNull();
    });

    it('should invalidate specific key', () => {
      const { result } = renderHook(() => useVersionCache<string[]>());

      act(() => {
        result.current.set('node', ['20.0.0']);
        result.current.set('python', ['3.11.0']);
        result.current.invalidate('node');
      });

      expect(result.current.get('node')).toBeNull();
      expect(result.current.get('python')).toEqual(['3.11.0']);
    });

    it('should invalidate all keys', () => {
      const { result } = renderHook(() => useVersionCache<string[]>());

      act(() => {
        result.current.set('node', ['20.0.0']);
        result.current.set('python', ['3.11.0']);
        result.current.invalidateAll();
      });

      expect(result.current.get('node')).toBeNull();
      expect(result.current.get('python')).toBeNull();
    });

    it('should check if key is valid', () => {
      const { result } = renderHook(() => useVersionCache<string[]>());

      act(() => {
        result.current.set('node', ['20.0.0']);
      });

      expect(result.current.isValid('node')).toBe(true);
      expect(result.current.isValid('python')).toBe(false);
    });
  });

  describe('expiry behavior', () => {
    it('should return null for expired entries', () => {
      const { result } = renderHook(() => 
        useVersionCache<string[]>({ expiryMs: 1000 })
      );

      act(() => {
        result.current.set('node', ['20.0.0']);
      });

      expect(result.current.get('node')).toEqual(['20.0.0']);

      // Advance time past expiry
      act(() => {
        jest.advanceTimersByTime(1001);
      });

      expect(result.current.get('node')).toBeNull();
    });

    it('should not expire entries before expiry time', () => {
      const { result } = renderHook(() => 
        useVersionCache<string[]>({ expiryMs: 5000 })
      );

      act(() => {
        result.current.set('node', ['20.0.0']);
      });

      // Advance time but not past expiry
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(result.current.get('node')).toEqual(['20.0.0']);
    });
  });
});
