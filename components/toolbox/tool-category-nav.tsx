'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { TOOL_CATEGORIES } from '@/lib/constants/toolbox';
import { Star, Clock, LayoutGrid, TrendingUp } from 'lucide-react';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import type { ToolCategoryMeta, ToolCategoryFilter } from '@/types/toolbox';

interface ToolCategoryNavProps {
  selectedCategory: ToolCategoryFilter;
  onSelectCategory: (cat: ToolCategoryFilter) => void;
  categoryToolCounts: Map<string, number>;
  totalToolCount: number;
  favoritesCount: number;
  recentCount: number;
  mostUsedCount?: number;
  dynamicCategories?: ToolCategoryMeta[];
}

export function ToolCategoryNavContent({
  selectedCategory,
  onSelectCategory,
  categoryToolCounts,
  totalToolCount,
  favoritesCount,
  recentCount,
  mostUsedCount = 0,
  dynamicCategories = [],
}: ToolCategoryNavProps) {
  const { t } = useLocale();

  return (
    <nav className="space-y-1 pr-2 py-2" aria-label="Tool categories">
      <Button
        variant={selectedCategory === 'favorites' ? 'secondary' : 'ghost'}
        className="w-full justify-start gap-2 h-8 px-3"
        onClick={() => onSelectCategory('favorites')}
      >
        <Star className="h-4 w-4 text-yellow-500" />
        <span className="flex-1 text-left text-sm">{t('toolbox.categories.favorites')}</span>
        {favoritesCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
            {favoritesCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={selectedCategory === 'recent' ? 'secondary' : 'ghost'}
        className="w-full justify-start gap-2 h-8 px-3"
        onClick={() => onSelectCategory('recent')}
      >
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left text-sm">{t('toolbox.categories.recent')}</span>
        {recentCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
            {recentCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={selectedCategory === 'most-used' ? 'secondary' : 'ghost'}
        className="w-full justify-start gap-2 h-8 px-3"
        onClick={() => onSelectCategory('most-used')}
      >
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left text-sm">{t('toolbox.categories.mostUsed')}</span>
        {mostUsedCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
            {mostUsedCount}
          </Badge>
        )}
      </Button>

      <Separator className="my-2" />

      <Button
        variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
        className="w-full justify-start gap-2 h-8 px-3"
        onClick={() => onSelectCategory('all')}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="flex-1 text-left text-sm">{t('toolbox.categories.all')}</span>
        <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
          {totalToolCount}
        </Badge>
      </Button>

      <Separator className="my-2" />

      {TOOL_CATEGORIES.map((cat) => {
        const count = categoryToolCounts.get(cat.id) ?? 0;
        return (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
            className={cn('w-full justify-start gap-2 h-8 px-3', count === 0 && 'opacity-50')}
            onClick={() => onSelectCategory(cat.id)}
            disabled={count === 0}
          >
            <DynamicIcon name={cat.icon} className="h-4 w-4" fallback={LayoutGrid} />
            <span className="flex-1 text-left text-sm">{t(cat.nameKey)}</span>
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
              {count}
            </Badge>
          </Button>
        );
      })}

      {dynamicCategories.length > 0 && <Separator className="my-2" />}

      {dynamicCategories.map((cat) => {
        const count = categoryToolCounts.get(cat.id) ?? 0;
        return (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 h-8 px-3"
            onClick={() => onSelectCategory(cat.id as ToolCategoryFilter)}
          >
            <DynamicIcon name={cat.icon} className="h-4 w-4" fallback={LayoutGrid} />
            <span className="flex-1 text-left text-sm capitalize">{cat.nameKey}</span>
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
              {count}
            </Badge>
          </Button>
        );
      })}
    </nav>
  );
}

export function ToolCategoryNav(props: ToolCategoryNavProps) {
  return (
    <div data-testid="tool-category-nav-scroll" className="min-h-0 flex-1 overflow-y-auto">
      <ToolCategoryNavContent {...props} />
    </div>
  );
}
