import { useState, useEffect, useCallback, useRef } from 'react';
import { scrollToHeading } from '@/lib/docs/scroll';

interface UseActiveHeadingOptions {
  enabled?: boolean;
}

interface UseActiveHeadingReturn {
  activeId: string;
  scrollToId: (id: string) => void;
}

export function useActiveHeading(
  headingIds: string[],
  options: UseActiveHeadingOptions = {}
): UseActiveHeadingReturn {
  const { enabled = true } = options;
  const [activeId, setActiveId] = useState<string>('');
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (isScrollingRef.current) return;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '-80px 0px -70% 0px',
      threshold: 0,
    });

    for (const id of headingIds) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [headingIds, handleObserver, enabled]);

  const scrollToId = useCallback((id: string) => {
    // Suppress observer updates during programmatic scroll
    isScrollingRef.current = true;
    setActiveId(id);
    scrollToHeading(id);

    // Re-enable observer after scroll settles
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 1000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  return { activeId, scrollToId };
}
