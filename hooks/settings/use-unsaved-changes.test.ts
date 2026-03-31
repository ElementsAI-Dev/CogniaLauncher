import { renderHook } from '@testing-library/react';
import {
  useUnsavedChanges,
  hasGlobalUnsavedChanges,
  getUnsavedChangesSources,
  _clearRegistry,
} from './use-unsaved-changes';

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  afterEach(() => {
    _clearRegistry();
  });

  it('should register a source with no changes', () => {
    renderHook(() => useUnsavedChanges('test-source', false));

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).toEqual([]);
  });

  it('should register a source with changes', () => {
    renderHook(() => useUnsavedChanges('test-source', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toEqual(['test-source']);
  });

  it('should update when hasChanges changes', () => {
    const { rerender } = renderHook(
      ({ hasChanges }) => useUnsavedChanges('test-source', hasChanges),
      { initialProps: { hasChanges: false } }
    );

    expect(hasGlobalUnsavedChanges()).toBe(false);

    rerender({ hasChanges: true });

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toEqual(['test-source']);

    rerender({ hasChanges: false });

    expect(hasGlobalUnsavedChanges()).toBe(false);
  });

  it('should unregister source on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);

    unmount();

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).toEqual([]);
  });

  it('should handle multiple sources', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', true));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', false));
    const { unmount: unmount3 } = renderHook(() => useUnsavedChanges('source-3', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toContain('source-1');
    expect(getUnsavedChangesSources()).toContain('source-3');
    expect(getUnsavedChangesSources()).not.toContain('source-2');

    unmount1();

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toEqual(['source-3']);

    unmount3();

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).toEqual([]);

    unmount2();
  });

  it('should handle sourceId changes', () => {
    const { rerender } = renderHook(
      ({ sourceId, hasChanges }) => useUnsavedChanges(sourceId, hasChanges),
      { initialProps: { sourceId: 'source-a', hasChanges: true } }
    );

    expect(getUnsavedChangesSources()).toEqual(['source-a']);

    rerender({ sourceId: 'source-b', hasChanges: true });

    // The old sourceId ref should still be used
    expect(hasGlobalUnsavedChanges()).toBe(true);
  });

  it('should correctly report when no sources have changes', () => {
    renderHook(() => useUnsavedChanges('source-1', false));
    renderHook(() => useUnsavedChanges('source-2', false));
    renderHook(() => useUnsavedChanges('source-3', false));

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).toEqual([]);
  });

  it('should handle rapid toggle of hasChanges', () => {
    const { rerender } = renderHook(
      ({ hasChanges }) => useUnsavedChanges('rapid-source', hasChanges),
      { initialProps: { hasChanges: false } }
    );

    for (let i = 0; i < 10; i++) {
      rerender({ hasChanges: i % 2 === 0 });
    }

    // Final state should be hasChanges: false (i=9, 9%2=1, so false)
    expect(hasGlobalUnsavedChanges()).toBe(false);
  });
});

describe('hasGlobalUnsavedChanges', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  afterEach(() => {
    _clearRegistry();
  });

  it('should return false when registry is empty', () => {
    expect(hasGlobalUnsavedChanges()).toBe(false);
  });

  it('should return true when at least one source has changes', () => {
    renderHook(() => useUnsavedChanges('source-1', false));
    renderHook(() => useUnsavedChanges('source-2', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);
  });
});

describe('getUnsavedChangesSources', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  afterEach(() => {
    _clearRegistry();
  });

  it('should return empty array when no sources have changes', () => {
    expect(getUnsavedChangesSources()).toEqual([]);
  });

  it('should return all source ids with changes', () => {
    renderHook(() => useUnsavedChanges('settings', true));
    renderHook(() => useUnsavedChanges('editor', true));
    renderHook(() => useUnsavedChanges('clean-source', false));

    const sources = getUnsavedChangesSources();
    expect(sources).toHaveLength(2);
    expect(sources).toContain('settings');
    expect(sources).toContain('editor');
  });
});

describe('_clearRegistry', () => {
  it('should clear all registered sources', () => {
    renderHook(() => useUnsavedChanges('source-1', true));
    renderHook(() => useUnsavedChanges('source-2', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);

    _clearRegistry();

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).toEqual([]);
  });
});
