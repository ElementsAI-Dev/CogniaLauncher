'use client';

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileCode,
  Copy,
  Check,
  Plus,
  Minus,
  Columns2,
  Rows3,
  ChevronDown,
  ChevronRight,
  FileText,
  FilePlus2,
  FileX,
  ArrowRightLeft,
  Binary,
  ALargeSmall,
  List,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import {
  parseUnifiedDiff,
  computeWordDiff,
  pairChangesForSplit,
} from '@/lib/utils/git';
import type { GitDiffViewerProps, DiffFileDiff, DiffHunk, DiffChange, DiffViewMode } from '@/types/git';
import type { WordDiffSegment, SplitLine } from '@/lib/utils/git';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LineNo({ value }: { value?: number }) {
  return (
    <span className="text-muted-foreground/40 select-none w-[3.5ch] inline-block text-right tabular-nums shrink-0">
      {value ?? ''}
    </span>
  );
}

function WordDiffContent({ segments, type }: { segments: WordDiffSegment[]; type: 'del' | 'add' }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'equal') return <span key={i}>{seg.value}</span>;
        if (seg.type === type) {
          const cls = type === 'del'
            ? 'bg-red-500/25 rounded-[2px]'
            : 'bg-green-500/25 rounded-[2px]';
          return <span key={i} className={cls}>{seg.value}</span>;
        }
        return null;
      })}
    </>
  );
}

function changeRowClass(type: 'add' | 'del' | 'ctx'): string {
  switch (type) {
    case 'add': return 'bg-green-500/8 text-green-800 dark:text-green-300';
    case 'del': return 'bg-red-500/8 text-red-800 dark:text-red-300';
    default: return 'text-foreground/80';
  }
}

function gutterClass(type: 'add' | 'del' | 'ctx'): string {
  switch (type) {
    case 'add': return 'bg-green-500/15 text-green-700 dark:text-green-400';
    case 'del': return 'bg-red-500/15 text-red-700 dark:text-red-400';
    default: return 'bg-muted/30';
  }
}

function FileIcon({ file }: { file: DiffFileDiff }) {
  if (file.isBinary) return <Binary className="h-3.5 w-3.5 text-muted-foreground" />;
  if (file.isNew) return <FilePlus2 className="h-3.5 w-3.5 text-green-600" />;
  if (file.isDeleted) return <FileX className="h-3.5 w-3.5 text-red-600" />;
  if (file.isRenamed) return <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />;
  return <FileText className="h-3.5 w-3.5 text-yellow-600" />;
}

function ChangesBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions;
  if (total === 0) return null;
  const blocks = Math.min(total, 5);
  const addBlocks = Math.round((additions / total) * blocks);
  const delBlocks = blocks - addBlocks;
  return (
    <span className="inline-flex gap-px ml-1">
      {Array.from({ length: addBlocks }).map((_, i) => (
        <span key={`a${i}`} className="w-1.5 h-1.5 rounded-[1px] bg-green-500" />
      ))}
      {Array.from({ length: delBlocks }).map((_, i) => (
        <span key={`d${i}`} className="w-1.5 h-1.5 rounded-[1px] bg-red-500" />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Unified view renderer
// ---------------------------------------------------------------------------

function UnifiedHunk({ hunk, wordDiff }: { hunk: DiffHunk; wordDiff: boolean }) {
  const wordDiffMap = useMemo(() => {
    if (!wordDiff) return new Map<number, WordDiffSegment[]>();
    const map = new Map<number, WordDiffSegment[]>();
    const changes = hunk.changes;
    let i = 0;
    while (i < changes.length) {
      if (changes[i].type === 'del') {
        const delStart = i;
        while (i < changes.length && changes[i].type === 'del') i++;
        const addStart = i;
        while (i < changes.length && changes[i].type === 'add') i++;
        const dels = changes.slice(delStart, addStart);
        const adds = changes.slice(addStart, i);
        const paired = Math.min(dels.length, adds.length);
        for (let j = 0; j < paired; j++) {
          const segs = computeWordDiff(dels[j].content, adds[j].content);
          map.set(delStart + j, segs);
          map.set(addStart + j, segs);
        }
      } else {
        i++;
      }
    }
    return map;
  }, [hunk.changes, wordDiff]);

  return (
    <>
      <div className="bg-blue-500/8 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[11px] font-semibold font-mono border-t border-border/50 flex gap-1">
        <span className="select-none">{hunk.header}</span>
      </div>
      {hunk.changes.map((change, ci) => {
        const segs = wordDiffMap.get(ci);
        return (
          <div key={ci} className={`flex font-mono text-[11px] leading-5 ${changeRowClass(change.type)}`}>
            <span className={`flex gap-0.5 px-1 border-r border-border/30 ${gutterClass(change.type)}`}>
              <LineNo value={change.oldLineNo} />
              <LineNo value={change.newLineNo} />
            </span>
            <span className="select-none w-4 text-center shrink-0">
              {change.type === 'add' ? '+' : change.type === 'del' ? '-' : ' '}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-all px-1">
              {segs && change.type !== 'ctx'
                ? <WordDiffContent segments={segs} type={change.type as 'del' | 'add'} />
                : change.content}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Split view renderer
// ---------------------------------------------------------------------------

function SplitHunk({ hunk, wordDiff }: { hunk: DiffHunk; wordDiff: boolean }) {
  const paired = useMemo(() => pairChangesForSplit(hunk.changes), [hunk.changes]);

  const wordDiffPairMap = useMemo(() => {
    if (!wordDiff) return new Map<number, WordDiffSegment[]>();
    const map = new Map<number, WordDiffSegment[]>();
    paired.forEach((row, idx) => {
      if (row.left?.type === 'del' && row.right?.type === 'add') {
        map.set(idx, computeWordDiff(row.left.content, row.right.content));
      }
    });
    return map;
  }, [paired, wordDiff]);

  return (
    <>
      <div className="bg-blue-500/8 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[11px] font-semibold font-mono border-t border-border/50" style={{ gridColumn: '1 / -1' }}>
        {hunk.header}
      </div>
      {paired.map((row: SplitLine, ri: number) => {
        const segs = wordDiffPairMap.get(ri);
        return (
          <React.Fragment key={ri}>
            {/* Left side */}
            <SplitCell change={row.left} side="old" segs={row.left?.type === 'del' ? segs : undefined} />
            {/* Right side */}
            <SplitCell change={row.right} side="new" segs={row.right?.type === 'add' ? segs : undefined} />
          </React.Fragment>
        );
      })}
    </>
  );
}

function SplitCell({ change, side, segs }: { change?: DiffChange; side: 'old' | 'new'; segs?: WordDiffSegment[] }) {
  if (!change) {
    return (
      <div className="flex font-mono text-[11px] leading-5 bg-muted/20 border-r border-border/20 last:border-r-0">
        <span className="px-1 w-[3.5ch] bg-muted/30 border-r border-border/30 select-none" />
        <span className="flex-1 px-1" />
      </div>
    );
  }

  const lineNo = side === 'old' ? change.oldLineNo : change.newLineNo;
  const lineType = change.type;

  return (
    <div className={`flex font-mono text-[11px] leading-5 border-r border-border/20 last:border-r-0 ${changeRowClass(lineType)}`}>
      <span className={`px-1 border-r border-border/30 select-none ${gutterClass(lineType)}`}>
        <LineNo value={lineNo} />
      </span>
      <span className="select-none w-3 text-center shrink-0">
        {lineType === 'add' ? '+' : lineType === 'del' ? '-' : ' '}
      </span>
      <span className="flex-1 whitespace-pre-wrap break-all px-1">
        {segs ? <WordDiffContent segments={segs} type={lineType as 'del' | 'add'} /> : change.content}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File section
// ---------------------------------------------------------------------------

function DiffFileSection({
  file,
  viewMode,
  wordDiff,
  defaultExpanded,
}: {
  file: DiffFileDiff;
  viewMode: DiffViewMode;
  wordDiff: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t } = useLocale();

  const displayName = file.isRenamed && file.oldName !== file.newName
    ? `${file.oldName} → ${file.newName}`
    : file.newName || file.oldName;

  return (
    <div className="border border-border/60 rounded-md overflow-hidden">
      {/* File header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <FileIcon file={file} />
        <span className="text-xs font-mono truncate flex-1">{displayName}</span>
        {file.isBinary ? (
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {t('git.diffView.binary')}
          </Badge>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] shrink-0">
            <span className="text-green-600">+{file.stats.additions}</span>
            <span className="text-red-600">-{file.stats.deletions}</span>
            <ChangesBar additions={file.stats.additions} deletions={file.stats.deletions} />
          </span>
        )}
      </button>

      {/* File content */}
      {expanded && (
        <div className="overflow-x-auto">
          {file.isBinary ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('git.diffView.binaryNotShown')}
            </p>
          ) : file.hunks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('git.diffView.noChanges')}
            </p>
          ) : viewMode === 'split' ? (
            <div className="grid grid-cols-2">
              {file.hunks.map((hunk, hi) => (
                <SplitHunk key={hi} hunk={hunk} wordDiff={wordDiff} />
              ))}
            </div>
          ) : (
            <div>
              {file.hunks.map((hunk, hi) => (
                <UnifiedHunk key={hi} hunk={hunk} wordDiff={wordDiff} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GitDiffViewer({
  diff,
  loading,
  title,
  defaultViewMode = 'unified',
  enableWordDiff = true,
}: GitDiffViewerProps) {
  const { t } = useLocale();
  const [viewMode, setViewMode] = useState<DiffViewMode>(defaultViewMode);
  const [wordDiff, setWordDiff] = useState(enableWordDiff);
  const [copied, setCopied] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);
  const [expandKey, setExpandKey] = useState(0);
  const [showFileNav, setShowFileNav] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const parsed = useMemo(() => (diff ? parseUnifiedDiff(diff) : null), [diff]);

  const handleCopy = useCallback(async () => {
    if (!diff) return;
    try {
      await navigator.clipboard.writeText(diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [diff]);

  const toggleExpandAll = useCallback(() => {
    setAllExpanded(prev => !prev);
    setExpandKey(k => k + 1);
  }, []);

  const scrollToFile = useCallback((index: number) => {
    const el = fileRefs.current.get(index);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const setFileRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      fileRefs.current.set(index, el);
    } else {
      fileRefs.current.delete(index);
    }
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            {title || t('git.diffView.title')}
          </CardTitle>
          {parsed && parsed.files.length > 0 && (
            <div className="flex items-center gap-1">
              {/* File nav toggle */}
              {parsed.files.length > 1 && (
                <Button
                  variant={showFileNav ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowFileNav(!showFileNav)}
                  title={t('git.diffView.fileList')}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* View mode toggle */}
              <Button
                variant={viewMode === 'unified' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setViewMode('unified')}
                title={t('git.diffView.unified')}
              >
                <Rows3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setViewMode('split')}
                title={t('git.diffView.split')}
              >
                <Columns2 className="h-3.5 w-3.5" />
              </Button>

              <span className="w-px h-4 bg-border mx-0.5" />

              {/* Word diff toggle */}
              <Button
                variant={wordDiff ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setWordDiff(!wordDiff)}
                title={t('git.diffView.wordDiff')}
              >
                <ALargeSmall className="h-3.5 w-3.5" />
              </Button>

              {/* Expand/collapse all */}
              {parsed.files.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={toggleExpandAll}
                  title={allExpanded ? t('git.diffView.collapseAll') : t('git.diffView.expandAll')}
                >
                  {allExpanded
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
              )}

              {/* Copy */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
                title={t('git.diffView.copy')}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>

        {/* Stats summary */}
        {parsed && parsed.files.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>
              {parsed.stats.filesChanged} {parsed.stats.filesChanged === 1 ? t('git.diffView.file') : t('git.diffView.files')}
            </span>
            <span className="text-green-600 flex items-center gap-0.5">
              <Plus className="h-3 w-3" />
              {parsed.stats.additions}
            </span>
            <span className="text-red-600 flex items-center gap-0.5">
              <Minus className="h-3 w-3" />
              {parsed.stats.deletions}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !diff || !parsed || parsed.files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {t('git.diffView.noChanges')}
          </p>
        ) : (
          <>
            {/* File navigation list */}
            {showFileNav && parsed.files.length > 1 && (
              <div className="mb-2 border border-border/60 rounded-md p-2 bg-muted/20 max-h-[200px] overflow-y-auto">
                {parsed.files.map((file, fi) => {
                  const displayName = file.isRenamed && file.oldName !== file.newName
                    ? `${file.oldName} → ${file.newName}`
                    : file.newName || file.oldName;
                  return (
                    <button
                      key={fi}
                      type="button"
                      className="flex items-center gap-2 w-full px-2 py-1 rounded text-xs hover:bg-muted/60 text-left"
                      onClick={() => scrollToFile(fi)}
                    >
                      <FileIcon file={file} />
                      <span className="font-mono truncate flex-1">{displayName}</span>
                      <span className="text-green-600 shrink-0">+{file.stats.additions}</span>
                      <span className="text-red-600 shrink-0">-{file.stats.deletions}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div ref={scrollContainerRef} className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {parsed.files.map((file, fi) => (
                <div key={`${file.newName}-${fi}-${expandKey}`} ref={(el) => setFileRef(fi, el)}>
                  <DiffFileSection
                    file={file}
                    viewMode={viewMode}
                    wordDiff={wordDiff}
                    defaultExpanded={allExpanded}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
