import type { MouseEvent } from 'react';

export function scrollToHeading(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

export function handleAnchorClick(e: MouseEvent<HTMLAnchorElement>): void {
  const href = e.currentTarget.getAttribute('href');
  if (!href?.startsWith('#')) return;
  e.preventDefault();
  const id = href.slice(1);
  scrollToHeading(id);
}
