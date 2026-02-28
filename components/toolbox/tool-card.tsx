'use client';

import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { getCategoryMeta } from '@/lib/constants/toolbox';
import { Star, Sparkles, Wrench, Plug } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { UnifiedTool } from '@/hooks/use-toolbox';

interface ToolCardProps {
  tool: UnifiedTool;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
  viewMode: 'grid' | 'list';
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const Resolved = icons[name];
  if (!Resolved) return <Wrench className={className} />;
  return <Resolved className={className} />;
}

export function ToolCard({ tool, isFavorite, onToggleFavorite, onOpen, viewMode }: ToolCardProps) {
  const { t } = useLocale();
  const category = getCategoryMeta(tool.category as import('@/types/toolbox').ToolCategory);

  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite(tool.id);
    },
    [tool.id, onToggleFavorite],
  );

  if (viewMode === 'list') {
    return (
      <Card
        className="cursor-pointer transition-colors hover:bg-accent/50"
        onClick={() => onOpen(tool.id)}
      >
        <CardContent className="flex items-center gap-4 p-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', category?.color)}>
            <DynamicIcon name={tool.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{tool.name}</span>
              {tool.isNew && (
                <Badge variant="secondary" className="shrink-0 gap-0.5 text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 dark:text-green-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('toolbox.badges.new')}
                </Badge>
              )}
              {tool.isBeta && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  {t('toolbox.badges.beta')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleFavoriteClick}
              >
                <Star className={cn('h-4 w-4', isFavorite && 'fill-yellow-400 text-yellow-400')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {isFavorite ? t('toolbox.actions.unfavorite') : t('toolbox.actions.favorite')}
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group/card cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
      onClick={() => onOpen(tool.id)}
    >
      <CardContent className="relative flex flex-col items-center gap-3 p-5 text-center">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/card:opacity-100 transition-opacity',
            isFavorite && 'opacity-100',
          )}
          onClick={handleFavoriteClick}
        >
          <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-yellow-400 text-yellow-400')} />
        </Button>

        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', category?.color)}>
          <DynamicIcon name={tool.icon} className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-medium text-sm">{tool.name}</span>
            {tool.isNew && (
              <Badge variant="secondary" className="gap-0.5 text-[10px] px-1 py-0 bg-green-500/10 text-green-600 dark:text-green-400">
                <Sparkles className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {tool.description}
          </p>
          {!tool.isBuiltIn && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
              <Plug className="h-2.5 w-2.5" />
              {t('toolbox.plugin.external')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
