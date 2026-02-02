import { renderHook } from '@testing-library/react';
import { useSettingsShortcuts } from '../use-settings-shortcuts';

describe('useSettingsShortcuts', () => {
  describe('Ctrl+S save shortcut', () => {
    it('should call onSave when Ctrl+S is pressed', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: true,
          isLoading: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when disabled', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: false,
          hasChanges: true,
          isLoading: false,
        })
      );

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should not call onSave when no changes', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: false,
          isLoading: false,
        })
      );

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should not call onSave when loading', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: true,
          isLoading: true,
        })
      );

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should work with Meta key (Mac)', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: true,
          isLoading: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape shortcut', () => {
    it('should call onEscape when Escape is pressed', () => {
      const onEscape = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave: jest.fn(),
          onEscape,
          enabled: true,
          hasChanges: true,
          isLoading: false,
        })
      );

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('should not call onEscape if not provided', () => {
      const onSave = jest.fn();
      renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: true,
          isLoading: false,
        })
      );

      // Should not throw
      expect(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const onSave = jest.fn();
      const { unmount } = renderHook(() =>
        useSettingsShortcuts({
          onSave,
          enabled: true,
          hasChanges: true,
          isLoading: false,
        })
      );

      unmount();

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
