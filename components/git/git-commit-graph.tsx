'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitBranch, ChevronDown } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import { assignLanes } from '@/lib/utils/git';
import { LANE_COLORS, LANE_WIDTH, ROW_HEIGHT, NODE_RADIUS, GRAPH_LEFT_PADDING } from '@/lib/constants/git';
import type { GitGraphEntry } from '@/types/tauri';
import type { GitCommitGraphProps } from '@/types/git';

export function GitCommitGraph({ onLoadGraph, onSelectCommit, selectedHash }: GitCommitGraphProps) {
  const { t } = useLocale();
  const [entries, setEntries] = useState<GitGraphEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);

  const loadData = useCallback(async (loadLimit: number) => {
    setLoading(true);
    try {
      const data = await onLoadGraph(loadLimit, true);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [onLoadGraph]);

  useEffect(() => {
    loadData(limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const laneMap = useMemo(() => assignLanes(entries), [entries]);
  const hashToIndex = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e, i) => map.set(e.hash, i));
    return map;
  }, [entries]);

  const maxLane = useMemo(() => {
    let max = 0;
    for (const a of laneMap.values()) {
      if (a.lane > max) max = a.lane;
    }
    return max;
  }, [laneMap]);

  const svgWidth = (maxLane + 2) * LANE_WIDTH + GRAPH_LEFT_PADDING;
  const svgHeight = entries.length * ROW_HEIGHT;

  const handleLoadMore = async () => {
    const newLimit = limit + 100;
    setLimit(newLimit);
    await loadData(newLimit);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('git.graph.title')}
            <Badge variant="secondary">{entries.length}</Badge>
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {t('git.graph.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <div className="flex min-w-[600px]">
              <svg
                width={svgWidth}
                height={svgHeight}
                className="shrink-0"
                style={{ minWidth: svgWidth }}
              >
                {entries.map((entry, rowIdx) => {
                  const assignment = laneMap.get(entry.hash);
                  if (!assignment) return null;
                  const cx = GRAPH_LEFT_PADDING + assignment.lane * LANE_WIDTH + LANE_WIDTH / 2;
                  const cy = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const color = LANE_COLORS[assignment.lane % LANE_COLORS.length];

                  return (
                    <g key={entry.hash}>
                      {entry.parents.map((parentHash) => {
                        const parentIdx = hashToIndex.get(parentHash);
                        if (parentIdx === undefined) return null;
                        const parentAssignment = laneMap.get(parentHash);
                        if (!parentAssignment) return null;
                        const px = GRAPH_LEFT_PADDING + parentAssignment.lane * LANE_WIDTH + LANE_WIDTH / 2;
                        const py = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const parentColor = LANE_COLORS[parentAssignment.lane % LANE_COLORS.length];

                        if (cx === px) {
                          return (
                            <line
                              key={`${entry.hash}-${parentHash}`}
                              x1={cx} y1={cy}
                              x2={px} y2={py}
                              stroke={color}
                              strokeWidth={1.5}
                              opacity={0.6}
                            />
                          );
                        }
                        const midY = cy + ROW_HEIGHT;
                        return (
                          <path
                            key={`${entry.hash}-${parentHash}`}
                            d={`M ${cx} ${cy} C ${cx} ${midY}, ${px} ${midY - ROW_HEIGHT}, ${px} ${py}`}
                            stroke={parentColor}
                            strokeWidth={1.5}
                            fill="none"
                            opacity={0.5}
                          />
                        );
                      })}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selectedHash === entry.hash ? NODE_RADIUS + 1.5 : NODE_RADIUS}
                        fill={color}
                        stroke={selectedHash === entry.hash ? 'var(--foreground)' : 'none'}
                        strokeWidth={1.5}
                        className="cursor-pointer"
                        onClick={() => onSelectCommit?.(entry.hash)}
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="flex-1 min-w-0">
                {entries.map((entry) => (
                  <div
                    key={entry.hash}
                    className={`flex items-center gap-2 text-xs px-2 cursor-pointer hover:bg-muted/50 ${
                      selectedHash === entry.hash ? 'bg-muted' : ''
                    }`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onSelectCommit?.(entry.hash)}
                  >
                    <span className="flex-1 truncate">{entry.message}</span>
                    {entry.refs.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.refs.slice(0, 3).map((ref) => (
                          <Badge
                            key={ref}
                            variant="outline"
                            className="text-[9px] h-4 px-1 font-mono"
                          >
                            {ref.replace('HEAD -> ', '').replace('tag: ', '')}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-muted-foreground shrink-0 hidden lg:block w-24 truncate">
                      {entry.authorName}
                    </span>
                    <span className="text-muted-foreground shrink-0 w-14 text-right">
                      {formatRelativeDate(entry.date)}
                    </span>
                    <code className="font-mono text-muted-foreground shrink-0 w-14">
                      {entry.hash.slice(0, 7)}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {entries.length >= limit && (
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  {t('git.graph.loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
