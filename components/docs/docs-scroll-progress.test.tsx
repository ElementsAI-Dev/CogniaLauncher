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
});

