'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Monitor, User, Settings, Globe, type LucideIcon } from 'lucide-react';

export type TerminalSection = 'shell-environment' | 'profiles' | 'configuration' | 'network';

export interface TerminalSectionDef {
  id: TerminalSection;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const TERMINAL_SECTIONS: Omit<TerminalSectionDef, 'label' | 'badge'>[] = [
  { id: 'shell-environment', icon: Monitor },
  { id: 'profiles', icon: User },
  { id: 'configuration', icon: Settings },
  { id: 'network', icon: Globe },
];

interface TerminalNavProps {
  activeSection: TerminalSection;
  onSectionClick: (section: TerminalSection) => void;
  sections: TerminalSectionDef[];
  children?: React.ReactNode;
  className?: string;
}

export function TerminalNav({
  activeSection,
  onSectionClick,
  sections,
  children,
  className,
}: TerminalNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeItemRef.current && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const itemRect = activeItemRef.current.getBoundingClientRect();
      if (itemRect.top < navRect.top || itemRect.bottom > navRect.bottom) {
        activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeSection]);

  return (
    <div className={cn('flex w-[210px] shrink-0 flex-col', className)}>
      <ScrollArea ref={navRef} className="flex-1">
        <nav className="space-y-0.5 p-2">
          {sections.map((section) => {
            const isActive = section.id === activeSection;
            const Icon = section.icon;

            return (
              <Button
                key={section.id}
                ref={isActive ? activeItemRef : undefined}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 font-normal',
                  isActive && 'font-medium',
                )}
                onClick={() => onSectionClick(section.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{section.label}</span>
                {section.badge != null && section.badge > 0 && (
                  <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1 text-xs">
                    {section.badge}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>
      {children}
    </div>
  );
}
