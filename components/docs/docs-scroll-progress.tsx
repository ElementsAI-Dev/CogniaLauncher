'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DocsScrollProgressProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function DocsScrollProgress({ containerRef, className }: DocsScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = containerRef?.current;
    if (!el) {
      // Fallback to window scroll
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
      return;
    }
    // For ScrollArea, the scrollable viewport is the first child with data-radix-scroll-area-viewport
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = viewport ?? el;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight - target.clientHeight;
    setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef?.current;
    const viewport = el?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = viewport ?? el ?? window;

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  return (
    <div
      className={cn('h-0.5 bg-primary/20 w-full', className)}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
