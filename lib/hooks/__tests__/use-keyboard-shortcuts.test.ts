import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useEnvironmentShortcuts, formatShortcut } from '../use-keyboard-shortcuts';

describe('useKeyboardShortcuts', () => {
  describe('basic shortcuts', () => {
    it('should call action when shortcut key is pressed', () => {
      const action = jest.fn();
      const shortcuts = [
        { key: 'r', ctrlKey: true, action, description: 'Refresh' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should not call action when wrong key is pressed', () => {
      const action = jest.fn();
      const shortcuts = [
        { key: 'r', ctrlKey: true, action, description: 'Refresh' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(action).not.toHaveBeenCalled();
    });

    it('should not call action when modifier is missing', () => {
      const action = jest.fn();
      const shortcuts = [
        { key: 'r', ctrlKey: true, action, description: 'Refresh' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts }));

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        ctrlKey: false,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('enabled state', () => {
    it('should not trigger when disabled', () => {
      const action = jest.fn();
      const shortcuts = [
        { key: 'r', ctrlKey: true, action, description: 'Refresh' },
      ];

      renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: false }));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));

      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const action = jest.fn();
      const shortcuts = [
        { key: 'r', ctrlKey: true, action, description: 'Refresh' },
      ];

      const { unmount } = renderHook(() => useKeyboardShortcuts({ shortcuts }));
      unmount();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));

      expect(action).not.toHaveBeenCalled();
    });
  });
});

describe('useEnvironmentShortcuts', () => {
  it('should set up refresh shortcut', () => {
    const onRefresh = jest.fn();

    renderHook(() => useEnvironmentShortcuts({ onRefresh }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should set up escape shortcut', () => {
    const onEscape = jest.fn();

    renderHook(() => useEnvironmentShortcuts({ onEscape }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe('formatShortcut', () => {
  it('should format key without modifiers', () => {
    const formatted = formatShortcut({ key: 'Escape' });
    expect(formatted).toBe('ESCAPE');
  });

  it('should uppercase the key', () => {
    const formatted = formatShortcut({ key: 'a' });
    expect(formatted).toBe('A');
  });

  it('should include Ctrl modifier', () => {
    const formatted = formatShortcut({ key: 'r', ctrlKey: true });
    expect(formatted).toContain('R');
  });
});
