'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  GitBranch,
  ChevronDown,
  Copy,
  Tag,
  RotateCcw,
  CherryIcon,
  MoreHorizontal,
  GitFork,
  History,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { formatRelativeDate } from '@/lib/utils/git-date';
import { assignLanes } from '@/lib/utils/git';
import {
  LANE_COLORS,
  LANE_WIDTH,
  ROW_HEIGHT,
  NODE_RADIUS,
  GRAPH_LEFT_PADDING,
  MERGE_NODE_SIZE,
  OVERSCAN_COUNT,
  MAX_VISIBLE_REFS,
} from '@/lib/constants/git';
import type { GitGraphEntry } from '@/types/tauri';
import type { GitCommitGraphProps } from '@/types/git';

// ---------------------------------------------------------------------------
// SVG edge path builder — adaptive bezier curves
// ---------------------------------------------------------------------------

function buildEdgePath(
  cx: number, cy: number, px: number, py: number,
): string {
  if (cx === px) return `M ${cx} ${cy} L ${px} ${py}`;
  const dy = py - cy;
  const offset = Math.min(Math.abs(dy) * 0.4, ROW_HEIGHT * 2);
  return `M ${cx} ${cy} C ${cx} ${cy + offset}, ${px} ${py - offset}, ${px} ${py}`;
}

// ---------------------------------------------------------------------------
// Memoized row component
// ---------------------------------------------------------------------------

interface GraphRowProps {
  entry: GitGraphEntry;
  selected: boolean;
  onSelect?: (hash: string) => void;
  onContextAction?: (action: string, hash: string) => void;
  hasContextMenu: boolean;
}

const GraphRow = memo(function GraphRow({
  entry,
  selected,
  onSelect,
  onContextAction,
  hasContextMenu,
}: GraphRowProps) {
  const { t } = useLocale();
  const isMerge = entry.parents.length >= 2;
  const isRoot = entry.parents.length === 0;
  const extraRefs = entry.refs.length - MAX_VISIBLE_REFS;

  const row = (
    <div
      data-hash={entry.hash}
      className={`flex items-center gap-2 text-xs px-2 cursor-pointer hover:bg-muted/50 ${
        selected ? 'bg-muted' : ''
      }`}
      style={{ height: ROW_HEIGHT }}
      onClick={() => onSelect?.(entry.hash)}
    >
      {isMerge && (
        <GitFork className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      {isRoot && (
        <History className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <span className="flex-1 truncate">{entry.message}</span>
      {entry.refs.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {entry.refs.slice(0, MAX_VISIBLE_REFS).map((ref) => (
            <Badge
              key={ref}
              variant="outline"
              className="text-[9px] h-4 px-1 font-mono"
            >
              {ref.replace('HEAD -> ', '').replace('tag: ', '')}
            </Badge>
          ))}
          {extraRefs > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                    +{extraRefs}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <div className="flex flex-wrap gap-1">
                    {entry.refs.slice(MAX_VISIBLE_REFS).map((ref) => (
                      <span key={ref} className="font-mono text-[10px]">
                        {ref.replace('HEAD -> ', '').replace('tag: ', '')}
                      </span>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
      {hasContextMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover/row:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onContextAction?.('copy', entry.hash)}>
              <Copy className="h-3.5 w-3.5 mr-2" />
              {t('git.graph.copyHash')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onContextAction?.('branch', entry.hash)}>
              <GitBranch className="h-3.5 w-3.5 mr-2" />
              {t('git.graph.createBranch')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onContextAction?.('tag', entry.hash)}>
              <Tag className="h-3.5 w-3.5 mr-2" />
              {t('git.graph.createTag')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onContextAction?.('cherrypick', entry.hash)}>
              <CherryIcon className="h-3.5 w-3.5 mr-2" />
              {t('git.graph.cherryPick')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onContextAction?.('revert', entry.hash)}>
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              {t('git.graph.revert')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return <div className="group/row">{row}</div>;
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GitCommitGraph({
  onLoadGraph,
  onSelectCommit,
  selectedHash,
  branches,
  onCopyHash,
  onCreateBranch,
  onCreateTag,
  onRevert,
  onCherryPick,
}: GitCommitGraphProps) {
  const { t } = useLocale();
  const [entries, setEntries] = useState<GitGraphEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);
  const [allBranches, setAllBranches] = useState(true);
  const [firstParent, setFirstParent] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('__all__');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const hasContextMenu = !!(onCopyHash || onCreateBranch || onCreateTag || onRevert || onCherryPick);

  const loadData = useCallback(async (loadLimit: number, allBr: boolean, fp: boolean, br: string) => {
    setLoading(true);
    try {
      const branchArg = br === '__all__' ? undefined : br;
      const data = await onLoadGraph(loadLimit, allBr, fp, branchArg);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [onLoadGraph]);

  useEffect(() => {
    loadData(limit, allBranches, firstParent, selectedBranch);
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
  const totalHeight = entries.length * ROW_HEIGHT;

  // Virtualization
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
  const endIdx = Math.min(
    entries.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_COUNT,
  );
  const visibleEntries = useMemo(
    () => entries.slice(startIdx, endIdx),
    [entries, startIdx, endIdx],
  );

  // Collect edges that connect to visible rows (including edges from off-screen parents)
  const visibleEdges = useMemo(() => {
    const edges: Array<{
      key: string;
      cx: number; cy: number;
      px: number; py: number;
      color: string;
    }> = [];
    const expandedStart = Math.max(0, startIdx - 1);
    const expandedEnd = Math.min(entries.length, endIdx + 1);

    for (let rowIdx = expandedStart; rowIdx < expandedEnd; rowIdx++) {
      const entry = entries[rowIdx];
      const assignment = laneMap.get(entry.hash);
      if (!assignment) continue;
      const cx = GRAPH_LEFT_PADDING + assignment.lane * LANE_WIDTH + LANE_WIDTH / 2;
      const cy = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const color = LANE_COLORS[assignment.lane % LANE_COLORS.length];

      for (const parentHash of entry.parents) {
        const parentIdx = hashToIndex.get(parentHash);
        if (parentIdx === undefined) continue;
        const parentAssignment = laneMap.get(parentHash);
        if (!parentAssignment) continue;
        const px = GRAPH_LEFT_PADDING + parentAssignment.lane * LANE_WIDTH + LANE_WIDTH / 2;
        const py = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const parentColor = LANE_COLORS[parentAssignment.lane % LANE_COLORS.length];

        edges.push({
          key: `${entry.hash}-${parentHash}`,
          cx, cy, px, py,
          color: cx === px ? color : parentColor,
        });
      }
    }
    return edges;
  }, [entries, laneMap, hashToIndex, startIdx, endIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((es) => {
      for (const e of es) setViewportHeight(e.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const handleLoadMore = async () => {
    const newLimit = limit + 100;
    setLimit(newLimit);
    await loadData(newLimit, allBranches, firstParent, selectedBranch);
  };

  const handleToggleAllBranches = useCallback((v: boolean) => {
    setAllBranches(v);
    loadData(limit, v, firstParent, selectedBranch);
  }, [loadData, limit, firstParent, selectedBranch]);

  const handleToggleFirstParent = useCallback((v: boolean) => {
    setFirstParent(v);
    loadData(limit, allBranches, v, selectedBranch);
  }, [loadData, limit, allBranches, selectedBranch]);

  const handleBranchChange = useCallback((v: string) => {
    setSelectedBranch(v);
    const isAll = v === '__all__';
    setAllBranches(isAll);
    loadData(limit, isAll, firstParent, v);
  }, [loadData, limit, firstParent]);

  const handleContextAction = useCallback((action: string, hash: string) => {
    switch (action) {
      case 'copy': onCopyHash?.(hash); break;
      case 'branch': onCreateBranch?.(hash); break;
      case 'tag': onCreateTag?.(hash); break;
      case 'revert': onRevert?.(hash); break;
      case 'cherrypick': onCherryPick?.(hash); break;
    }
  }, [onCopyHash, onCreateBranch, onCreateTag, onRevert, onCherryPick]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (entries.length === 0) return;
    let nextIdx = focusedIdx;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        nextIdx = Math.min(focusedIdx + 1, entries.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIdx = Math.max(focusedIdx - 1, 0);
        break;
      case 'Home':
        e.preventDefault();
        nextIdx = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIdx = entries.length - 1;
        break;
      case 'Enter':
        if (focusedIdx >= 0 && focusedIdx < entries.length) {
          onSelectCommit?.(entries[focusedIdx].hash);
        }
        return;
      default:
        return;
    }
    setFocusedIdx(nextIdx);
    onSelectCommit?.(entries[nextIdx].hash);
    // Scroll focused row into view
    if (scrollRef.current) {
      const rowTop = nextIdx * ROW_HEIGHT;
      const rowBottom = rowTop + ROW_HEIGHT;
      const { scrollTop: st, clientHeight } = scrollRef.current;
      if (rowTop < st) scrollRef.current.scrollTop = rowTop;
      else if (rowBottom > st + clientHeight) scrollRef.current.scrollTop = rowBottom - clientHeight;
    }
  }, [entries, focusedIdx, onSelectCommit]);

  // Sync focusedIdx when selectedHash changes externally
  useEffect(() => {
    if (selectedHash) {
      const idx = hashToIndex.get(selectedHash);
      if (idx !== undefined) setFocusedIdx(idx);
    }
  }, [selectedHash, hashToIndex]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('git.graph.title')}
            <Badge variant="secondary">{entries.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {branches && branches.length > 0 && (
              <Select value={selectedBranch} onValueChange={handleBranchChange}>
                <SelectTrigger className="h-7 text-xs w-[140px]">
                  <SelectValue placeholder={t('git.graph.allBranches')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('git.graph.allBranches')}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5">
              <Switch
                id="first-parent"
                checked={firstParent}
                onCheckedChange={handleToggleFirstParent}
                className="scale-75"
              />
              <Label htmlFor="first-parent" className="text-[10px] text-muted-foreground cursor-pointer">
                {t('git.graph.firstParent')}
              </Label>
            </div>
            {!branches?.length && (
              <div className="flex items-center gap-1.5">
                <Switch
                  id="all-branches"
                  checked={allBranches}
                  onCheckedChange={handleToggleAllBranches}
                  className="scale-75"
                />
                <Label htmlFor="all-branches" className="text-[10px] text-muted-foreground cursor-pointer">
                  {t('git.graph.allBranches')}
                </Label>
              </div>
            )}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {t('git.graph.empty')}
          </p>
        ) : (
          <div
            ref={scrollRef}
            className="overflow-x-auto overflow-y-auto max-h-[600px] focus:outline-none"
            onScroll={handleScroll}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            role="listbox"
            aria-label={t('git.graph.title')}
          >
            <div style={{ height: totalHeight, position: 'relative' }} className="flex min-w-[600px]">
              {/* SVG graph column — only visible edges + nodes */}
              <svg
                width={svgWidth}
                height={totalHeight}
                className="shrink-0 absolute left-0 top-0 pointer-events-none"
                style={{ minWidth: svgWidth }}
              >
                {/* Edges */}
                {visibleEdges.map((edge) => (
                  <path
                    key={edge.key}
                    d={buildEdgePath(edge.cx, edge.cy, edge.px, edge.py)}
                    stroke={edge.color}
                    strokeWidth={1.5}
                    fill="none"
                    opacity={0.55}
                  />
                ))}
                {/* Nodes */}
                {visibleEntries.map((entry, i) => {
                  const rowIdx = startIdx + i;
                  const assignment = laneMap.get(entry.hash);
                  if (!assignment) return null;
                  const cx = GRAPH_LEFT_PADDING + assignment.lane * LANE_WIDTH + LANE_WIDTH / 2;
                  const cy = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const color = LANE_COLORS[assignment.lane % LANE_COLORS.length];
                  const isSelected = selectedHash === entry.hash;
                  const isMerge = entry.parents.length >= 2;

                  return (
                    <g key={entry.hash} style={{ pointerEvents: 'auto' }}>
                      <title>{`${entry.hash.slice(0, 7)} — ${entry.authorName}\n${entry.message}`}</title>
                      {isMerge ? (
                        <polygon
                          points={`${cx},${cy - MERGE_NODE_SIZE} ${cx + MERGE_NODE_SIZE},${cy} ${cx},${cy + MERGE_NODE_SIZE} ${cx - MERGE_NODE_SIZE},${cy}`}
                          fill={color}
                          stroke={isSelected ? 'var(--foreground)' : 'none'}
                          strokeWidth={1.5}
                          className="cursor-pointer"
                          onClick={() => onSelectCommit?.(entry.hash)}
                        />
                      ) : (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? NODE_RADIUS + 1.5 : NODE_RADIUS}
                          fill={color}
                          stroke={isSelected ? 'var(--foreground)' : 'none'}
                          strokeWidth={1.5}
                          className="cursor-pointer"
                          onClick={() => onSelectCommit?.(entry.hash)}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Commit info rows — virtualized */}
              <div
                className="flex-1 min-w-0 absolute top-0 right-0"
                style={{ left: svgWidth }}
              >
                {visibleEntries.map((entry, i) => {
                  const rowIdx = startIdx + i;
                  return (
                    <div
                      key={entry.hash}
                      style={{
                        position: 'absolute',
                        top: rowIdx * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                      }}
                      role="option"
                      aria-selected={selectedHash === entry.hash}
                    >
                      <GraphRow
                        entry={entry}
                        selected={selectedHash === entry.hash}
                        onSelect={onSelectCommit}
                        onContextAction={hasContextMenu ? handleContextAction : undefined}
                        hasContextMenu={hasContextMenu}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {entries.length >= limit && (
              <div className="p-2 sticky bottom-0 bg-card/80 backdrop-blur-sm">
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
