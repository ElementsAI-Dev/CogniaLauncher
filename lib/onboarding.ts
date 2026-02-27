import type { BubbleHintDef } from '@/types/onboarding';
import { POPOVER_OFFSET } from '@/lib/constants/onboarding';

/**
 * Compute the CSS position of the popover relative to a target rect.
 * Falls back to viewport-safe positioning if the preferred side overflows.
 */
export function computePosition(
  target: DOMRect,
  popover: HTMLElement,
  side: BubbleHintDef['side'],
): { top: string; left: string; transform: string; actualSide: string } {
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const sides: BubbleHintDef['side'][] = [side, 'bottom', 'top', 'right', 'left'];
  for (const s of sides) {
    let top = 0;
    let left = 0;
    let transform = '';

    switch (s) {
      case 'bottom':
        top = target.bottom + POPOVER_OFFSET;
        left = target.left + target.width / 2;
        transform = 'translateX(-50%)';
        if (top + ph <= vh && left - pw / 2 >= 0 && left + pw / 2 <= vw) {
          return { top: `${top}px`, left: `${left}px`, transform, actualSide: s };
        }
        break;
      case 'top':
        top = target.top - ph - POPOVER_OFFSET;
        left = target.left + target.width / 2;
        transform = 'translateX(-50%)';
        if (top >= 0 && left - pw / 2 >= 0 && left + pw / 2 <= vw) {
          return { top: `${top}px`, left: `${left}px`, transform, actualSide: s };
        }
        break;
      case 'right':
        top = target.top + target.height / 2;
        left = target.right + POPOVER_OFFSET;
        transform = 'translateY(-50%)';
        if (left + pw <= vw && top - ph / 2 >= 0 && top + ph / 2 <= vh) {
          return { top: `${top}px`, left: `${left}px`, transform, actualSide: s };
        }
        break;
      case 'left':
        top = target.top + target.height / 2;
        left = target.left - pw - POPOVER_OFFSET;
        transform = 'translateY(-50%)';
        if (left >= 0 && top - ph / 2 >= 0 && top + ph / 2 <= vh) {
          return { top: `${top}px`, left: `${left}px`, transform, actualSide: s };
        }
        break;
    }
  }

  // Final fallback: bottom center
  return {
    top: `${target.bottom + POPOVER_OFFSET}px`,
    left: `${target.left + target.width / 2}px`,
    transform: 'translateX(-50%)',
    actualSide: 'bottom',
  };
}
