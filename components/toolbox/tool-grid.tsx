'use client';

import { useMemo } from 'react';
import { ToolCard } from '@/components/toolbox/tool-card';
import { cn } from '@/lib/utils';
import type { UnifiedTool } from '@/hooks/use-toolbox';

interface ToolGridProps {
  tools: UnifiedTool[];
  favorites: string[];
  viewMode: 'grid' | 'list';
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
  toolUseCounts?: Record<string, number>;
}

export function ToolGrid({ tools, favorites, viewMode, onToggleFavorite, onOpen, toolUseCounts }: ToolGridProps) {
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  return (
    <div
      data-testid="tool-grid-root"
      className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-1 content-start gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'flex flex-col gap-2 pb-4',
      )}
    >
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          isFavorite={favSet.has(tool.id)}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpen}
          viewMode={viewMode}
          useCount={toolUseCounts?.[tool.id] ?? 0}
        />
      ))}
    </div>
  );
}
