'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/components/providers/locale-provider';
import { HEATMAP_CELL_SIZE, HEATMAP_CELL_GAP } from '@/lib/constants/git';
import { getHeatColor } from '@/lib/utils/git';
import type { GitDayActivity } from '@/types/tauri';
import type { GitActivityHeatmapProps } from '@/types/git';

export function GitActivityHeatmap({ onGetActivity }: GitActivityHeatmapProps) {
  const { t } = useLocale();
  const [activity, setActivity] = useState<GitDayActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState<string>('180');

  const loadData = useCallback(async (numDays: number) => {
    setLoading(true);
    try {
      const data = await onGetActivity(numDays);
      setActivity(data);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [onGetActivity]);

  const handleLoad = () => loadData(Number(days));

  const handleDaysChange = (value: string) => {
    setDays(value);
    if (loaded) loadData(Number(value));
  };

  const { grid, maxCount, totalCommits, weeks } = useMemo(() => {
    const numDays = Number(days);
    const activityMap = new Map<string, number>();
    let max = 0;
    let total = 0;
    for (const a of activity) {
      activityMap.set(a.date, a.commitCount);
      if (a.commitCount > max) max = a.commitCount;
      total += a.commitCount;
    }

    const today = new Date();
    const cells: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = [];
    const numWeeks = Math.ceil(numDays / 7);

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const weekIndex = Math.floor((numDays - 1 - i) / 7);
      cells.push({
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
        dayOfWeek,
        weekIndex,
      });
    }

    return { grid: cells, maxCount: max, totalCommits: total, weeks: numWeeks };
  }, [activity, days]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {t('git.activity.title')}
            {loaded && <Badge variant="secondary">{totalCommits} {t('git.history.commits')}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={handleDaysChange}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90 {t('git.activity.days')}</SelectItem>
                <SelectItem value="180">180 {t('git.activity.days')}</SelectItem>
                <SelectItem value="365">365 {t('git.activity.days')}</SelectItem>
              </SelectContent>
            </Select>
            {!loaded && (
              <Button size="sm" variant="outline" onClick={handleLoad} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('git.activity.load')}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!loaded && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {t('git.activity.hint')}
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="overflow-x-auto">
              <svg
                width={(weeks + 1) * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP)}
                height={7 * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP) + HEATMAP_CELL_GAP}
              >
                {grid.map((cell) => (
                  <Tooltip key={cell.date}>
                    <TooltipTrigger asChild>
                      <rect
                        x={cell.weekIndex * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP) + HEATMAP_CELL_GAP}
                        y={cell.dayOfWeek * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP) + HEATMAP_CELL_GAP}
                        width={HEATMAP_CELL_SIZE}
                        height={HEATMAP_CELL_SIZE}
                        rx={2}
                        fill={getHeatColor(cell.count, maxCount)}
                        className="cursor-pointer hover:stroke-foreground hover:stroke-1"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <span className="font-medium">{cell.count} {t('git.history.commits')}</span>
                      <span className="text-muted-foreground ml-1">{cell.date}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </svg>
            </div>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground justify-end">
              <span>{t('git.activity.less')}</span>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <div
                  key={ratio}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: getHeatColor(ratio * (maxCount || 1), maxCount || 1) }}
                />
              ))}
              <span>{t('git.activity.more')}</span>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
