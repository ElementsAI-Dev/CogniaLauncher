'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Search, X } from 'lucide-react';

interface ToolSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  className?: string;
}

export function ToolSearchBar({ value, onChange, resultCount, className }: ToolSearchBarProps) {
  const { t } = useLocale();

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('toolbox.search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 pr-20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onChange('')}
              aria-label={t('common.clear')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {t('toolbox.search.count', { count: resultCount })}
          </Badge>
        </div>
      </div>
    </div>
  );
}
