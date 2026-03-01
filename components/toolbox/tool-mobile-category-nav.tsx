'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { SlidersHorizontal } from 'lucide-react';
import { ToolCategoryNavContent } from '@/components/toolbox/tool-category-nav';
import type { ToolCategoryMeta, ToolCategoryFilter } from '@/types/toolbox';

interface ToolMobileCategoryNavProps {
  selectedCategory: ToolCategoryFilter;
  onSelectCategory: (cat: ToolCategoryFilter) => void;
  categoryToolCounts: Map<string, number>;
  totalToolCount: number;
  favoritesCount: number;
  recentCount: number;
  mostUsedCount?: number;
  dynamicCategories?: ToolCategoryMeta[];
}

export function ToolMobileCategoryNav({
  selectedCategory,
  onSelectCategory,
  categoryToolCounts,
  totalToolCount,
  favoritesCount,
  recentCount,
  mostUsedCount = 0,
  dynamicCategories,
}: ToolMobileCategoryNavProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const handleSelect = (cat: ToolCategoryFilter) => {
    onSelectCategory(cat);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('toolbox.plugin.mobileMenu')}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm">{t('toolbox.plugin.mobileMenu')}</SheetTitle>
        </SheetHeader>
        <div className="p-2">
          <ToolCategoryNavContent
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelect}
            categoryToolCounts={categoryToolCounts}
            totalToolCount={totalToolCount}
            favoritesCount={favoritesCount}
            recentCount={recentCount}
            mostUsedCount={mostUsedCount}
            dynamicCategories={dynamicCategories}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
