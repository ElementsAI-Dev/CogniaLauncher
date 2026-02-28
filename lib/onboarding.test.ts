import { computePosition } from './onboarding';

function makeRect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function makePopover(w: number, h: number): HTMLElement {
  return { offsetWidth: w, offsetHeight: h } as HTMLElement;
}

describe('computePosition', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('positions bottom when preferred and fits', () => {
    const target = makeRect(100, 400, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'bottom');
    expect(result.actualSide).toBe('bottom');
  });

  it('positions top when preferred and fits', () => {
    const target = makeRect(200, 400, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'top');
    expect(result.actualSide).toBe('top');
  });

  it('positions right when preferred and fits', () => {
    const target = makeRect(300, 200, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'right');
    expect(result.actualSide).toBe('right');
  });

  it('positions left when preferred and fits', () => {
    const target = makeRect(300, 500, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'left');
    expect(result.actualSide).toBe('left');
  });

  it('falls back from top to bottom when top overflows', () => {
    // Target near top edge - not enough room above
    const target = makeRect(10, 400, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'top');
    expect(result.actualSide).toBe('bottom');
  });

  it('falls back to bottom as last resort', () => {
    // Very constrained viewport
    Object.defineProperty(window, 'innerWidth', { value: 100, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 100, writable: true });
    const target = makeRect(30, 30, 40, 40);
    const popover = makePopover(200, 200);
    const result = computePosition(target, popover, 'left');
    expect(result.actualSide).toBe('bottom');
  });

  it('returns CSS position strings with px units', () => {
    const target = makeRect(100, 400, 100, 40);
    const popover = makePopover(200, 100);
    const result = computePosition(target, popover, 'bottom');
    expect(result.top).toMatch(/^\d+(\.\d+)?px$/);
    expect(result.left).toMatch(/^\d+(\.\d+)?px$/);
    expect(result.transform).toBeTruthy();
  });
});
