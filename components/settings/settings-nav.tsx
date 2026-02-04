'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsSection } from '@/lib/constants/settings-registry';

type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

const SECTION_ICONS: Record<string, LucideIcon> = {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Info,
};

interface SettingsNavProps {
  activeSection: SettingsSection | null;
  onSectionClick: (section: SettingsSection) => void;
  matchingSections?: Set<SettingsSection>;
  isSearching?: boolean;
  collapsedSections?: Set<SettingsSection>;
  sectionHasChanges?: (section: SettingsSection) => boolean;
  t: TranslateFunction;
  className?: string;
}

export function SettingsNav({
  activeSection,
  onSectionClick,
  matchingSections,
  isSearching = false,
  collapsedSections,
  sectionHasChanges,
  t,
  className,
}: SettingsNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const itemRect = activeItemRef.current.getBoundingClientRect();

      if (itemRect.top < navRect.top || itemRect.bottom > navRect.bottom) {
        activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSection]);

  const sortedSections = [...SETTINGS_SECTIONS].sort((a, b) => a.order - b.order);

  return (
    <nav
      ref={navRef}
      className={cn('sticky top-6', className)}
      aria-label={t('settings.nav.label')}
    >
      <div className="mb-3 px-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t('settings.nav.title')}
        </h2>
      </div>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-1 pr-2">
          {sortedSections.map((section) => {
            const Icon = SECTION_ICONS[section.icon] || Settings2;
            const isActive = activeSection === section.id;
            const isMatch = isSearching && matchingSections?.has(section.id);
            const isCollapsed = collapsedSections?.has(section.id);
            const hasChanges = sectionHasChanges?.(section.id);

            // During search, dim non-matching sections
            const isDimmed = isSearching && !isMatch;

            return (
              <Button
                key={section.id}
                ref={isActive ? activeItemRef : undefined}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start gap-2 text-left',
                  isDimmed && 'opacity-40',
                  isMatch && 'ring-2 ring-primary/20'
                )}
                onClick={() => onSectionClick(section.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate flex-1">{t(section.labelKey)}</span>
                <div className="flex items-center gap-1">
                  {hasChanges && (
                    <span
                      className="h-2 w-2 rounded-full bg-amber-500"
                      title={t('settings.nav.hasChanges')}
                      aria-label={t('settings.nav.hasChanges')}
                    />
                  )}
                  {isCollapsed && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {t('settings.nav.collapsed')}
                    </Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Keyboard navigation hint */}
      <div className="mt-4 border-t pt-3 px-2">
        <p className="text-xs text-muted-foreground">
          {t('settings.nav.hint')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium">
            /
          </kbd>
          <span className="text-xs text-muted-foreground">{t('settings.nav.hintSearch')}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium">
            ↑↓
          </kbd>
          <span className="text-xs text-muted-foreground">{t('settings.nav.hintNavigate')}</span>
        </div>
      </div>
    </nav>
  );
}
