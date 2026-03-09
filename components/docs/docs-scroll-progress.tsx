'use client';

import { useEffect, useState, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
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
      const next = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setProgress(Math.max(0, Math.min(100, next)));
      return;
    }
    // For ScrollArea, the scrollable viewport is the first child with data-radix-scroll-area-viewport
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = viewport ?? el;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight - target.clientHeight;
    const next = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    setProgress(Math.max(0, Math.min(100, next)));
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef?.current;
    const viewport = el?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = viewport ?? el ?? window;

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  return <Progress value={progress} max={100} aria-label="Reading progress" className={cn('h-1 w-full rounded-none bg-primary/15', className)} />;
}
