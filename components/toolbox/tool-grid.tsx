'use client';

import { ToolCard } from '@/components/toolbox/tool-card';
import { cn } from '@/lib/utils';
import type { UnifiedTool } from '@/hooks/use-toolbox';

interface ToolGridProps {
  tools: UnifiedTool[];
  favorites: string[];
  viewMode: 'grid' | 'list';
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
}

export function ToolGrid({ tools, favorites, viewMode, onToggleFavorite, onOpen }: ToolGridProps) {
  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'flex flex-col gap-2',
      )}
    >
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          isFavorite={favorites.includes(tool.id)}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpen}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
