import { renderHook, act } from '@testing-library/react';
import { useSettingsShortcuts, useSectionNavigation } from './use-settings-shortcuts';

describe('useSettingsShortcuts', () => {
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  beforeEach(() => {
    keydownHandler = null;
    jest.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandler = handler as (e: KeyboardEvent) => void;
      }
    });
    jest.spyOn(document, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register event listener on mount', () => {
    renderHook(() => useSettingsShortcuts({}));
    expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should cleanup event listener on unmount', () => {
    const { unmount } = renderHook(() => useSettingsShortcuts({}));
    unmount();
    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should not register listener when disabled', () => {
    renderHook(() => useSettingsShortcuts({ enabled: false }));
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it('should call onSave on Ctrl+S when hasChanges is true', () => {
    const onSave = jest.fn();
    renderHook(() => useSettingsShortcuts({ onSave, hasChanges: true }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

    keydownHandler?.(event);

    expect(onSave).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not call onSave when hasChanges is false', () => {
    const onSave = jest.fn();
    renderHook(() => useSettingsShortcuts({ onSave, hasChanges: false }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });

    keydownHandler?.(event);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should not call onSave when isLoading is true', () => {
    const onSave = jest.fn();
    renderHook(() => useSettingsShortcuts({ onSave, hasChanges: true, isLoading: true }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });

    keydownHandler?.(event);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should call onReset on Ctrl+R when not in input', () => {
    const onReset = jest.fn();
    renderHook(() => useSettingsShortcuts({ onReset }));

    // Mock activeElement as body (not input)
    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

    keydownHandler?.(event);

    expect(onReset).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not call onReset when input is focused', () => {
    const onReset = jest.fn();
    renderHook(() => useSettingsShortcuts({ onReset }));

    const input = document.createElement('input');
    Object.defineProperty(document, 'activeElement', {
      value: input,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true });

    keydownHandler?.(event);

    expect(onReset).not.toHaveBeenCalled();
  });

  it('should call onEscape on Escape key', () => {
    const onEscape = jest.fn();
    renderHook(() => useSettingsShortcuts({ onEscape }));

    const event = new KeyboardEvent('keydown', { key: 'Escape' });

    keydownHandler?.(event);

    expect(onEscape).toHaveBeenCalled();
  });

  it('should call onFocusSearch on / key when not in input', () => {
    const onFocusSearch = jest.fn();
    renderHook(() => useSettingsShortcuts({ onFocusSearch }));

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: '/' });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

    keydownHandler?.(event);

    expect(onFocusSearch).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not call onFocusSearch when in textarea', () => {
    const onFocusSearch = jest.fn();
    renderHook(() => useSettingsShortcuts({ onFocusSearch }));

    const textarea = document.createElement('textarea');
    Object.defineProperty(document, 'activeElement', {
      value: textarea,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: '/' });

    keydownHandler?.(event);

    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  it('should call onNavigateSection with prev on ArrowUp', () => {
    const onNavigateSection = jest.fn();
    renderHook(() => useSettingsShortcuts({ onNavigateSection }));

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

    keydownHandler?.(event);

    expect(onNavigateSection).toHaveBeenCalledWith('prev');
  });

  it('should call onNavigateSection with next on ArrowDown', () => {
    const onNavigateSection = jest.fn();
    renderHook(() => useSettingsShortcuts({ onNavigateSection }));

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

    keydownHandler?.(event);

    expect(onNavigateSection).toHaveBeenCalledWith('next');
  });

  it('should call onJumpToSection with first on Home', () => {
    const onJumpToSection = jest.fn();
    renderHook(() => useSettingsShortcuts({ onJumpToSection }));

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'Home' });

    keydownHandler?.(event);

    expect(onJumpToSection).toHaveBeenCalledWith('first');
  });

  it('should call onJumpToSection with last on End', () => {
    const onJumpToSection = jest.fn();
    renderHook(() => useSettingsShortcuts({ onJumpToSection }));

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'End' });

    keydownHandler?.(event);

    expect(onJumpToSection).toHaveBeenCalledWith('last');
  });

  it('should handle metaKey (Cmd) for Mac shortcuts', () => {
    const onSave = jest.fn();
    renderHook(() => useSettingsShortcuts({ onSave, hasChanges: true }));

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true });

    keydownHandler?.(event);

    expect(onSave).toHaveBeenCalled();
  });
});

describe('useSectionNavigation', () => {
  const sectionIds = ['general', 'appearance', 'system'] as const;

  it('should navigate to next section', () => {
    const setActiveSection = jest.fn();
    const mockScrollIntoView = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: mockScrollIntoView,
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'general',
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('next');
    });

    expect(setActiveSection).toHaveBeenCalledWith('appearance');
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    jest.restoreAllMocks();
  });

  it('should navigate to previous section', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'appearance',
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('prev');
    });

    expect(setActiveSection).toHaveBeenCalledWith('general');

    jest.restoreAllMocks();
  });

  it('should wrap around to last section on prev from first', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'general',
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('prev');
    });

    expect(setActiveSection).toHaveBeenCalledWith('system');

    jest.restoreAllMocks();
  });

  it('should wrap around to first section on next from last', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'system',
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('next');
    });

    expect(setActiveSection).toHaveBeenCalledWith('general');

    jest.restoreAllMocks();
  });

  it('should jump to first section', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'system',
        setActiveSection,
      })
    );

    act(() => {
      result.current.jumpToSection('first');
    });

    expect(setActiveSection).toHaveBeenCalledWith('general');

    jest.restoreAllMocks();
  });

  it('should jump to last section', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: 'general',
        setActiveSection,
      })
    );

    act(() => {
      result.current.jumpToSection('last');
    });

    expect(setActiveSection).toHaveBeenCalledWith('system');

    jest.restoreAllMocks();
  });

  it('should handle empty sectionIds for navigation', () => {
    const setActiveSection = jest.fn();

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [],
        activeSection: null,
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('next');
    });

    expect(setActiveSection).not.toHaveBeenCalled();
  });

  it('should handle empty sectionIds for jump', () => {
    const setActiveSection = jest.fn();

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [],
        activeSection: null,
        setActiveSection,
      })
    );

    act(() => {
      result.current.jumpToSection('first');
    });

    expect(setActiveSection).not.toHaveBeenCalled();
  });

  it('should handle null activeSection', () => {
    const setActiveSection = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);

    const { result } = renderHook(() =>
      useSectionNavigation({
        sectionIds: [...sectionIds],
        activeSection: null,
        setActiveSection,
      })
    );

    act(() => {
      result.current.navigateSection('next');
    });

    // When activeSection is null, currentIndex is -1, so next goes to index 0
    expect(setActiveSection).toHaveBeenCalledWith('general');

    jest.restoreAllMocks();
  });
});
