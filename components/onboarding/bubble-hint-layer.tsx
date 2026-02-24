'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useOnboardingStore } from '@/lib/stores/onboarding';
import { BubbleHint } from './bubble-hint';
import { BUBBLE_HINTS } from './bubble-hints';

interface BubbleHintLayerProps {
  /** Maximum number of hints to show simultaneously */
  maxConcurrent?: number;
}

export function BubbleHintLayer({ maxConcurrent = 1 }: BubbleHintLayerProps) {
  const pathname = usePathname();
  const {
    completed,
    skipped,
    wizardOpen,
    tourActive,
    dismissedHints,
    hintsEnabled,
    dismissHint,
  } = useOnboardingStore();

  const hasBeenThrough = completed || skipped;

  // Filter hints for the current context
  const activeHints = useMemo(() => {
    // Don't show hints if disabled, wizard is open, or tour is active
    if (!hintsEnabled || wizardOpen || tourActive) return [];

    return BUBBLE_HINTS.filter((hint) => {
      // Skip already dismissed hints
      if (dismissedHints.includes(hint.id)) return false;

      // Check onboarding requirement
      if (hint.showAfterOnboarding && !hasBeenThrough) return false;

      // Check route match (startsWith for sub-routes)
      if (hint.route) {
        // Exact match for root route
        if (hint.route === '/') {
          if (pathname !== '/') return false;
        } else if (!pathname.startsWith(hint.route)) {
          return false;
        }
      }

      return true;
    }).slice(0, maxConcurrent);
  }, [pathname, dismissedHints, hintsEnabled, wizardOpen, tourActive, hasBeenThrough, maxConcurrent]);

  if (activeHints.length === 0) return null;

  return (
    <>
      {activeHints.map((hint) => (
        <BubbleHint
          key={hint.id}
          hint={hint}
          onDismiss={dismissHint}
        />
      ))}
    </>
  );
}
