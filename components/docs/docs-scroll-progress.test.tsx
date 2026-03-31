import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DocsScrollProgress } from './docs-scroll-progress';

jest.mock('@/components/ui/progress', () => ({
  Progress: ({
    value,
    max,
    ...props
  }: {
    value?: number;
    max?: number;
    [key: string]: unknown;
  }) => <div data-testid="progress" data-value={value ?? 0} data-max={max ?? 0} {...props} />,
}));

describe('DocsScrollProgress', () => {
  it('falls back to window scroll when containerRef is not provided', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 100, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 200, writable: true, configurable: true });

    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<DocsScrollProgress />);
    await act(async () => {});

    expect(addSpy).toHaveBeenCalled();

    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const value = Number(screen.getByTestId('progress').getAttribute('data-value'));
      expect(value).toBeCloseTo(50, 1);
    });

    unmount();
    expect(removeSpy).toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('clamps window-based progress between 0 and 100', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 100, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 200, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: -20, writable: true, configurable: true });

    render(<DocsScrollProgress />);
    await act(async () => {});

    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '0');
    });

    Object.defineProperty(window, 'scrollY', { value: 999, writable: true, configurable: true });
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '100');
    });
  });

  it('uses ScrollArea viewport scroll when a radix viewport exists under containerRef', async () => {
    const container = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.setAttribute('data-radix-scroll-area-viewport', '');
    container.appendChild(viewport);

    Object.defineProperty(viewport, 'scrollTop', { value: 25, writable: true, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 125, writable: true, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 75, writable: true, configurable: true });

    const addSpy = jest.spyOn(viewport, 'addEventListener');
    const removeSpy = jest.spyOn(viewport, 'removeEventListener');

    const ref = { current: container } as React.RefObject<HTMLElement>;
    const { unmount } = render(<DocsScrollProgress containerRef={ref} />);
    await act(async () => {});

    expect(addSpy).toHaveBeenCalled();

    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const value = Number(screen.getByTestId('progress').getAttribute('data-value'));
      expect(value).toBeCloseTo(50, 1);
    });

    // clamp to 100
    (viewport as unknown as { scrollTop: number }).scrollTop = 999;
    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const value = Number(screen.getByTestId('progress').getAttribute('data-value'));
      expect(value).toBe(100);
    });

    unmount();
    expect(removeSpy).toHaveBeenCalled();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('falls back to the container element when no radix viewport exists', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', { value: 40, writable: true, configurable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 140, writable: true, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 100, writable: true, configurable: true });

    const addSpy = jest.spyOn(container, 'addEventListener');
    const removeSpy = jest.spyOn(container, 'removeEventListener');

    const ref = { current: container } as React.RefObject<HTMLElement>;
    const { unmount } = render(<DocsScrollProgress containerRef={ref} />);
    await act(async () => {});

    container.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '100');
    });

    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
