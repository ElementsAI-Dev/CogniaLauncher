'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  MoreHorizontal,
  RotateCcw,
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
import { cn } from '@/lib/utils';
import type { SettingsSection } from '@/lib/constants/settings-registry';

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

interface CollapsibleSectionProps {
  id: SettingsSection;
  title: string;
  description: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  hasChanges?: boolean;
  onResetSection?: (sectionId: SettingsSection) => void;
  onOpenChange?: (sectionId: SettingsSection, open: boolean) => void;
  t: TranslateFunction;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  description,
  icon = 'Settings2',
  defaultOpen = true,
  children,
  hasChanges = false,
  onResetSection,
  onOpenChange,
  t,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = SECTION_ICONS[icon] || Settings2;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      onOpenChange?.(id, newOpen);
    },
    [id, onOpenChange]
  );

  const handleResetClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onResetSection?.(id);
    },
    [id, onResetSection]
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className={className}
    >
      <Card id={`section-${id}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {title}
                {hasChanges && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {t('settings.section.modified')}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {onResetSection && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t('settings.section.moreActions')}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleResetClick}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t('settings.section.resetToDefaults')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted-foreground transition-transform duration-200',
                    open && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
