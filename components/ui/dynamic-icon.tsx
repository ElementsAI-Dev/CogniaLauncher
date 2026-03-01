'use client';

import * as LucideIcons from 'lucide-react';
import { Wrench } from 'lucide-react';

interface DynamicIconProps {
  name: string;
  className?: string;
  fallback?: React.ComponentType<{ className?: string }>;
}

export function DynamicIcon({ name, className, fallback: Fallback = Wrench }: DynamicIconProps) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const Resolved = icons[name];
  if (!Resolved) return <Fallback className={className} />;
  return <Resolved className={className} />;
}
