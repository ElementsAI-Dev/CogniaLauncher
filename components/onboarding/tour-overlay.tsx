'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { TOUR_STEPS, type TourStepDef } from './tour-steps';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TourOverlayProps {
  active: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  onStop: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const POPOVER_OFFSET = 12;

export function TourOverlay({
  active,
  currentStep,
  onNext,
  onPrev,
  onComplete,
  onStop,
}: TourOverlayProps) {
  const { t } = useLocale();
  const router = useRouter();
  const targetRectRef = useRef<TargetRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const step: TourStepDef | undefined = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  // Navigate to the required route for the current step
  useEffect(() => {
    if (!active || !step?.route) return;
    router.push(step.route);
  }, [active, step, router]);

  // Find and track the target element, update DOM directly to avoid setState-in-effect lint
  useEffect(() => {
    if (!active || !step) {
      targetRectRef.current = null;
      return;
    }

    const updatePositions = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        targetRectRef.current = null;
        return;
      }

      const rect = el.getBoundingClientRect();
      const tr: TargetRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
      targetRectRef.current = tr;

      // Directly update DOM elements for spotlight and popover position
      const spotlight = document.getElementById('tour-spotlight-rect');
      const ring = document.getElementById('tour-spotlight-ring');
      if (spotlight) {
        spotlight.setAttribute('x', String(tr.left - PADDING));
        spotlight.setAttribute('y', String(tr.top - PADDING));
        spotlight.setAttribute('width', String(tr.width + PADDING * 2));
        spotlight.setAttribute('height', String(tr.height + PADDING * 2));
      }
      if (ring) {
        ring.style.top = `${tr.top - PADDING}px`;
        ring.style.left = `${tr.left - PADDING}px`;
        ring.style.width = `${tr.width + PADDING * 2}px`;
        ring.style.height = `${tr.height + PADDING * 2}px`;
        ring.style.display = 'block';
      }

      // Update popover position
      if (popoverRef.current) {
        const pStyle = popoverRef.current.style;
        pStyle.opacity = '1';
        // Reset all positioning
        pStyle.top = '';
        pStyle.left = '';
        pStyle.right = '';
        pStyle.bottom = '';
        pStyle.transform = '';

        switch (step.side) {
          case 'right':
            pStyle.top = `${tr.top + tr.height / 2}px`;
            pStyle.left = `${tr.left + tr.width + PADDING + POPOVER_OFFSET}px`;
            pStyle.transform = 'translateY(-50%)';
            break;
          case 'left':
            pStyle.top = `${tr.top + tr.height / 2}px`;
            pStyle.right = `${window.innerWidth - tr.left + PADDING + POPOVER_OFFSET}px`;
            pStyle.transform = 'translateY(-50%)';
            break;
          case 'bottom':
            pStyle.top = `${tr.top + tr.height + PADDING + POPOVER_OFFSET}px`;
            pStyle.left = `${tr.left + tr.width / 2}px`;
            pStyle.transform = 'translateX(-50%)';
            break;
          case 'top':
            pStyle.bottom = `${window.innerHeight - tr.top + PADDING + POPOVER_OFFSET}px`;
            pStyle.left = `${tr.left + tr.width / 2}px`;
            pStyle.transform = 'translateX(-50%)';
            break;
        }
      }
    };

    // Initial find with a small delay to allow route navigation
    const timer = setTimeout(updatePositions, 200);

    // Re-measure on scroll/resize
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [active, step, currentStep]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStop();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) onComplete();
        else onNext();
      } else if (e.key === 'ArrowLeft') {
        if (!isFirst) onPrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, isFirst, isLast, onNext, onPrev, onComplete, onStop]);

  if (!active || typeof document === 'undefined' || !step) return null;

  const overlay = (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[10000] transition-opacity duration-300"
        style={{ pointerEvents: 'none' }}
      >
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                id="tour-spotlight-rect"
                x="0"
                y="0"
                width="0"
                height="0"
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.5)"
            mask="url(#tour-spotlight-mask)"
            style={{ pointerEvents: 'auto' }}
            onClick={onStop}
          />
        </svg>

        {/* Spotlight ring */}
        <div
          id="tour-spotlight-ring"
          className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-300"
          style={{ display: 'none', pointerEvents: 'none' }}
        />
      </div>

      {/* Popover card */}
      <div
        ref={popoverRef}
        className="fixed z-[10002] rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        style={{ opacity: 0, maxWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-sm">{t(step.titleKey)}</h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-0.5"
            onClick={onStop}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {t(step.descKey)}
        </p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {currentStep + 1} / {TOUR_STEPS.length}
          </Badge>
          <div className="flex gap-1.5">
            {!isFirst && (
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={onPrev}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="h-7 px-3 gap-1" onClick={onComplete}>
                <Check className="h-3.5 w-3.5" />
                {t('onboarding.tourDone')}
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-3 gap-1" onClick={onNext}>
                {t('onboarding.tourNext')}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
