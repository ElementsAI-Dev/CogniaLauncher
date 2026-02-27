'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computePosition } from '@/lib/onboarding';
import { ARROW_CLASS } from '@/lib/constants/onboarding';
import type { BubbleHintProps, BubbleHintDef } from '@/types/onboarding';

export function BubbleHint({ hint, onDismiss }: BubbleHintProps) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const [actualSide, setActualSide] = useState(hint.side);
  const popoverRef = useRef<HTMLDivElement>(null);
  const foundRef = useRef(false);

  // Find target element with delay
  useEffect(() => {
    let cancelled = false;
    foundRef.current = false;

    const findTarget = (obs?: MutationObserver) => {
      const el = document.querySelector(hint.target);
      if (el && !cancelled) {
        foundRef.current = true;
        setTargetEl(el);
        obs?.disconnect();
      }
    };

    const observer = new MutationObserver(() => {
      if (!cancelled && !foundRef.current) findTarget(observer);
    });

    const delayTimer = setTimeout(() => {
      findTarget(observer);
      // Only start observing if target wasn't found yet
      if (!foundRef.current) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, hint.delay ?? 500);

    return () => {
      cancelled = true;
      clearTimeout(delayTimer);
      observer.disconnect();
    };
  }, [hint.target, hint.delay]);

  // Track target visibility via IntersectionObserver
  useEffect(() => {
    if (!targetEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0.5 },
    );
    observer.observe(targetEl);

    return () => {
      observer.disconnect();
      setVisible(false);
    };
  }, [targetEl]);

  // Position the popover when visible
  useEffect(() => {
    if (!visible || !targetEl || !popoverRef.current) return;

    const updatePosition = () => {
      const el = popoverRef.current;
      if (!el || !targetEl) return;
      const rect = targetEl.getBoundingClientRect();
      const pos = computePosition(rect, el, hint.side);
      el.style.top = pos.top;
      el.style.left = pos.left;
      el.style.transform = pos.transform;
      el.style.opacity = '1';
      setActualSide(pos.actualSide as BubbleHintDef['side']);
    };

    // Small delay for layout to settle
    const timer = setTimeout(updatePosition, 50);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, targetEl, hint.side]);

  const handleDismiss = useCallback(() => {
    onDismiss(hint.id);
  }, [onDismiss, hint.id]);

  if (!visible || typeof document === 'undefined') return null;

  const popover = (
    <div
      ref={popoverRef}
      className={cn(
        'fixed z-[9999] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        'max-w-[280px]',
      )}
      style={{ opacity: 0 }}
      role="status"
      aria-live="polite"
    >
      {/* Arrow */}
      <div
        className={cn(
          'absolute h-2.5 w-2.5 border bg-popover',
          ARROW_CLASS[actualSide] ?? ARROW_CLASS.bottom,
        )}
      />

      {/* Content */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold leading-tight mb-1">
            {t(hint.titleKey)}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(hint.descKey)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 -mt-0.5 -mr-1"
          onClick={handleDismiss}
          aria-label={t('onboarding.hints.dismiss')}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return createPortal(popover, document.body);
}
