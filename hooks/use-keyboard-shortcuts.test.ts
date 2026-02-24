import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useEnvironmentShortcuts, formatShortcut } from './use-keyboard-shortcuts';
import { _setCachedOS, _resetCachedOS } from '@/lib/platform';

describe('formatShortcut', () => {
  afterEach(() => {
    _resetCachedOS();
  });

  it('should format simple key', () => {
    expect(formatShortcut({ key: 'a' })).toBe('A');
  });

  it('should format with Ctrl modifier on Windows', () => {
    _setCachedOS('windows');
    expect(formatShortcut({ key: 's', ctrlKey: true })).toBe('Ctrl+S');
  });

  it('should format with Cmd modifier on Mac', () => {
    _setCachedOS('macos');
    expect(formatShortcut({ key: 's', ctrlKey: true })).toBe('⌘S');
  });

  it('should format with multiple modifiers', () => {
    _setCachedOS('windows');
    expect(formatShortcut({ key: 'z', ctrlKey: true, shiftKey: true })).toBe('Ctrl+Shift+Z');
  });

  it('should format Alt key', () => {
    _setCachedOS('windows');
    expect(formatShortcut({ key: 'f', altKey: true })).toBe('Alt+F');
  });

  it('should format key with uppercase', () => {
    expect(formatShortcut({ key: 'escape' })).toBe('ESCAPE');
    expect(formatShortcut({ key: 'enter' })).toBe('ENTER');
  });

  it('should format with metaKey', () => {
    _setCachedOS('macos');
    expect(formatShortcut({ key: 'c', metaKey: true })).toBe('⌘C');
  });
});

describe('useKeyboardShortcuts', () => {
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  beforeEach(() => {
    keydownHandler = null;
    jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandler = handler as (e: KeyboardEvent) => void;
      }
    });
    jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register event listener on mount', () => {
    renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should cleanup event listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should trigger action on matching shortcut', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: document.body });

    keydownHandler?.(event);

    expect(action).toHaveBeenCalled();
  });

  it('should not trigger action when key does not match', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = new KeyboardEvent('keydown', {
      key: 'j',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: document.body });

    keydownHandler?.(event);

    expect(action).not.toHaveBeenCalled();
  });

  it('should not trigger action when modifier does not match', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: false,
    });
    Object.defineProperty(event, 'target', { value: document.body });

    keydownHandler?.(event);

    expect(action).not.toHaveBeenCalled();
  });

  it('should ignore shortcuts when input is focused', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: input });

    keydownHandler?.(event);

    expect(action).not.toHaveBeenCalled();
  });

  it('should ignore shortcuts when textarea is focused', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const textarea = document.createElement('textarea');
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });

    keydownHandler?.(event);

    expect(action).not.toHaveBeenCalled();
  });

  it('should handle multiple shortcuts', () => {
    const action1 = jest.fn();
    const action2 = jest.fn();
    const shortcuts = [
      { key: 'a', ctrlKey: true, action: action1, description: 'action1' },
      { key: 'b', ctrlKey: true, action: action2, description: 'action2' },
    ];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event1 = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
    Object.defineProperty(event1, 'target', { value: document.body });
    keydownHandler?.(event1);

    expect(action1).toHaveBeenCalled();
    expect(action2).not.toHaveBeenCalled();

    const event2 = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true });
    Object.defineProperty(event2, 'target', { value: document.body });
    keydownHandler?.(event2);

    expect(action2).toHaveBeenCalled();
  });

  it('should prevent default when shortcut matches', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: document.body });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

    keydownHandler?.(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not register listener when disabled', () => {
    renderHook(() => useKeyboardShortcuts({ shortcuts: [], enabled: false }));
    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('should handle shift modifier', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'z', ctrlKey: true, shiftKey: true, action, description: 'redo' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });
    Object.defineProperty(event, 'target', { value: document.body });

    keydownHandler?.(event);

    expect(action).toHaveBeenCalled();
  });

  it('should ignore contenteditable elements', () => {
    const action = jest.fn();
    const shortcuts = [{ key: 'k', ctrlKey: true, action, description: 'test' }];

    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const div = document.createElement('div');
    div.contentEditable = 'true';
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    Object.defineProperty(event, 'target', { value: div });

    keydownHandler?.(event);

    expect(action).not.toHaveBeenCalled();
  });
});

describe('useEnvironmentShortcuts', () => {
  beforeEach(() => {
    jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
    jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register environment-specific shortcuts', () => {
    const onRefresh = jest.fn();
    const onAdd = jest.fn();
    const onSearch = jest.fn();
    const onEscape = jest.fn();

    renderHook(() =>
      useEnvironmentShortcuts({
        onRefresh,
        onAdd,
        onSearch,
        onEscape,
      })
    );

    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should work with partial callbacks', () => {
    const onRefresh = jest.fn();

    renderHook(() =>
      useEnvironmentShortcuts({
        onRefresh,
      })
    );

    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should work with no callbacks', () => {
    renderHook(() => useEnvironmentShortcuts({}));

    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
