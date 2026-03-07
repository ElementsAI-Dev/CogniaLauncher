'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/use-toolbox';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Wrench, ArrowRight } from 'lucide-react';
import { getCategoryMeta } from '@/lib/constants/toolbox';
import { cn } from '@/lib/utils';
import type { ToolCategory } from '@/types/toolbox';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

export function ToolboxFavoritesWidget() {
  const { t } = useLocale();
  const router = useRouter();
  const { allTools, favorites, recentTools } = useToolbox();

  const favoriteTools = allTools.filter((tool) => favorites.includes(tool.id)).slice(0, 6);
  const recentUsed = recentTools
    .map((id) => allTools.find((t) => t.id === id))
    .filter(Boolean)
    .slice(0, 4);

  const hasContent = favoriteTools.length > 0 || recentUsed.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Wrench className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">{t('dashboard.widgets.toolboxEmpty')}</p>
        <Button
          variant="link"
          size="sm"
          className="mt-1 gap-1"
          onClick={() => router.push('/toolbox')}
        >
          {t('dashboard.widgets.toolboxBrowse')}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {favoriteTools.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {favoriteTools.map((tool) => {
            const cat = getCategoryMeta(tool.category as ToolCategory);
            return (
              <button
                key={tool.id}
                className="flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors hover:bg-accent/50 cursor-pointer"
                onClick={() => router.push(getToolboxDetailPath(tool.id))}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', cat?.color)}>
                  <DynamicIcon name={tool.icon} className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-medium truncate w-full">{tool.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {recentUsed.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t('toolbox.categories.recent')}</p>
          <div className="space-y-1">
            {recentUsed.map((tool) => tool && (
              <button
                key={tool.id}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 cursor-pointer"
                onClick={() => router.push(getToolboxDetailPath(tool.id))}
              >
                <DynamicIcon name={tool.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs truncate">{tool.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
