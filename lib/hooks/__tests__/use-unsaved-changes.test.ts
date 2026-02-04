import { renderHook } from '@testing-library/react';
import {
  useUnsavedChanges,
  hasGlobalUnsavedChanges,
  getUnsavedChangesSources,
  _clearRegistry,
} from '../use-unsaved-changes';

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    // Clear registry before each test to ensure test isolation
    _clearRegistry();
  });

  it('registers source with initial hasChanges state', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toContain('test-source');

    unmount();
  });

  it('registers source with false hasChanges state', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', false));

    expect(hasGlobalUnsavedChanges()).toBe(false);
    expect(getUnsavedChangesSources()).not.toContain('test-source');

    unmount();
  });

  it('updates hasChanges state when prop changes', () => {
    const { rerender, unmount } = renderHook(
      ({ hasChanges }) => useUnsavedChanges('test-source', hasChanges),
      { initialProps: { hasChanges: false } }
    );

    expect(hasGlobalUnsavedChanges()).toBe(false);

    rerender({ hasChanges: true });

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toContain('test-source');

    rerender({ hasChanges: false });

    expect(hasGlobalUnsavedChanges()).toBe(false);

    unmount();
  });

  it('unregisters source on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', true));

    expect(getUnsavedChangesSources()).toContain('test-source');

    unmount();

    expect(getUnsavedChangesSources()).not.toContain('test-source');
  });

  it('supports multiple sources', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', true));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', false));
    const { unmount: unmount3 } = renderHook(() => useUnsavedChanges('source-3', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toEqual(expect.arrayContaining(['source-1', 'source-3']));
    expect(getUnsavedChangesSources()).not.toContain('source-2');

    unmount1();

    expect(hasGlobalUnsavedChanges()).toBe(true);
    expect(getUnsavedChangesSources()).toContain('source-3');
    expect(getUnsavedChangesSources()).not.toContain('source-1');

    unmount3();

    expect(hasGlobalUnsavedChanges()).toBe(false);

    unmount2();
  });

  it('handles sourceId updates', () => {
    const { rerender, unmount } = renderHook(
      ({ sourceId, hasChanges }) => useUnsavedChanges(sourceId, hasChanges),
      { initialProps: { sourceId: 'original-source', hasChanges: true } }
    );

    expect(getUnsavedChangesSources()).toContain('original-source');

    rerender({ sourceId: 'new-source', hasChanges: true });

    // The old source should still be registered until effect cleanup
    // The new source will use the ref value
    expect(hasGlobalUnsavedChanges()).toBe(true);

    unmount();
  });
});

describe('hasGlobalUnsavedChanges', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  it('returns false when no sources are registered', () => {
    expect(hasGlobalUnsavedChanges()).toBe(false);
  });

  it('returns true when any source has changes', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', false));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', true));

    expect(hasGlobalUnsavedChanges()).toBe(true);

    unmount1();
    unmount2();
  });

  it('returns false when all sources have no changes', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', false));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', false));

    expect(hasGlobalUnsavedChanges()).toBe(false);

    unmount1();
    unmount2();
  });
});

describe('getUnsavedChangesSources', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  it('returns empty array when no sources have changes', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('source-1', false));

    expect(getUnsavedChangesSources()).toEqual([]);

    unmount();
  });

  it('returns only sources with unsaved changes', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', true));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', false));
    const { unmount: unmount3 } = renderHook(() => useUnsavedChanges('source-3', true));

    const sources = getUnsavedChangesSources();
    expect(sources).toHaveLength(2);
    expect(sources).toContain('source-1');
    expect(sources).toContain('source-3');
    expect(sources).not.toContain('source-2');

    unmount1();
    unmount2();
    unmount3();
  });
});

describe('cognia:check-unsaved event', () => {
  beforeEach(() => {
    _clearRegistry();
  });

  it('responds to custom event with unsaved changes status', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', true));

    const event = new CustomEvent('cognia:check-unsaved', {
      detail: { hasChanges: false },
    });

    window.dispatchEvent(event);

    expect(event.detail.hasChanges).toBe(true);

    unmount();
  });

  it('responds with false when no unsaved changes', () => {
    const { unmount } = renderHook(() => useUnsavedChanges('test-source', false));

    const event = new CustomEvent('cognia:check-unsaved', {
      detail: { hasChanges: false },
    });

    window.dispatchEvent(event);

    expect(event.detail.hasChanges).toBe(false);

    unmount();
  });

  it('handles multiple sources in event response', () => {
    const { unmount: unmount1 } = renderHook(() => useUnsavedChanges('source-1', false));
    const { unmount: unmount2 } = renderHook(() => useUnsavedChanges('source-2', true));

    const event = new CustomEvent('cognia:check-unsaved', {
      detail: { hasChanges: false },
    });

    window.dispatchEvent(event);

    expect(event.detail.hasChanges).toBe(true);

    unmount1();
    unmount2();
  });
});
