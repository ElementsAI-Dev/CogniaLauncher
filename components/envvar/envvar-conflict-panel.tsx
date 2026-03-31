'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronUp, X, ArrowRight, ShieldAlert } from 'lucide-react';
import type { EnvVarScope, EnvVarConflict } from '@/types/tauri';

const DEFAULT_CONFLICT_IGNORED_KEYS = ['PATH', 'PATHEXT', 'TEMP', 'TMP', 'PSMODULEPATH'] as const;
const CONFLICT_CUSTOM_IGNORED_STORAGE_KEY = 'envvar.customIgnoredConflictKeys';

function normalizeEnvKey(key: string): string {
  return key.trim().toUpperCase();
}

function normalizeEnvKeyList(keys: string[]): string[] {
  return Array.from(new Set(keys.map(normalizeEnvKey).filter(Boolean)));
}

function parseEnvKeyInput(input: string): string[] {
  return normalizeEnvKeyList(input.split(/[\s,;]+/));
}

function readPersistedIgnoredKeys(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CONFLICT_CUSTOM_IGNORED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeEnvKeyList(parsed.filter((item): item is string => typeof item === 'string'));
    }
  } catch {
    // Ignore malformed persisted state
  }

  return [];
}

interface EnvVarConflictPanelProps {
  conflicts: EnvVarConflict[];
  onResolve: (key: string, sourceScope: EnvVarScope, targetScope: EnvVarScope) => void;
  busy?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvVarConflictPanel({
  conflicts,
  onResolve,
  busy = false,
  t,
}: EnvVarConflictPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [customIgnoredKeys, setCustomIgnoredKeys] = useState<string[]>(() => readPersistedIgnoredKeys());
  const [ignoreInput, setIgnoreInput] = useState('');

  useEffect(() => {
    const syncViewport = () => setCompactView(window.innerWidth < 768);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const defaultIgnoredKeys = useMemo(
    () => normalizeEnvKeyList([...DEFAULT_CONFLICT_IGNORED_KEYS]),
    [],
  );

  const allIgnoredKeySet = useMemo(
    () => new Set([...defaultIgnoredKeys, ...customIgnoredKeys]),
    [defaultIgnoredKeys, customIgnoredKeys],
  );

  const visibleConflicts = useMemo(
    () => conflicts.filter((c) => !allIgnoredKeySet.has(normalizeEnvKey(c.key))),
    [allIgnoredKeySet, conflicts],
  );

  const hiddenCount = conflicts.length - visibleConflicts.length;

  const persistIgnoredKeys = useCallback((nextKeys: string[]) => {
    const normalized = normalizeEnvKeyList(nextKeys);
    setCustomIgnoredKeys(normalized);
    try {
      window.localStorage.setItem(CONFLICT_CUSTOM_IGNORED_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleAddIgnoredKeys = useCallback(() => {
    const nextKeys = parseEnvKeyInput(ignoreInput);
    if (nextKeys.length === 0) return;
    const filtered = nextKeys.filter(
      (key) => !defaultIgnoredKeys.includes(key) && !customIgnoredKeys.includes(key),
    );
    if (filtered.length === 0) {
      setIgnoreInput('');
      return;
    }
    persistIgnoredKeys([...customIgnoredKeys, ...filtered]);
    setIgnoreInput('');
  }, [ignoreInput, customIgnoredKeys, defaultIgnoredKeys, persistIgnoredKeys]);

  const handleRemoveIgnoredKey = useCallback(
    (key: string) => {
      persistIgnoredKeys(customIgnoredKeys.filter((item) => item !== key));
    },
    [customIgnoredKeys, persistIgnoredKeys],
  );

  if (dismissed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setDismissed(false)}
        data-testid="envvar-conflicts-restore"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        {t('envvar.conflicts.restore')}
        {visibleConflicts.length > 0 && (
          <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
            {visibleConflicts.length}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="shrink-0 gap-0 py-0" data-testid="envvar-conflicts-summary">
      <Collapsible open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
        <CardHeader className="border-b px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm">{t('envvar.conflicts.title')}</CardTitle>
              {visibleConflicts.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]" data-testid="envvar-conflicts-count">
                  {visibleConflicts.length}
                </Badge>
              )}
              {visibleConflicts.length === 0 && conflicts.length === 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {t('envvar.conflicts.noConflicts')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {collapsed && visibleConflicts.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setCollapsed(false)}
                  data-testid="envvar-conflicts-review"
                >
                  {t('envvar.conflicts.review')}
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={collapsed ? t('envvar.conflicts.show') : t('envvar.conflicts.hide')}
                  data-testid="envvar-conflicts-toggle"
                >
                  {collapsed ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDismissed(true)}
                aria-label={t('envvar.conflicts.dismiss')}
                data-testid="envvar-conflicts-dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 px-3 py-3 sm:px-4">
            {/* Ignore settings */}
            <div
              className="space-y-2 rounded-md border bg-muted/30 p-2.5"
              data-testid="envvar-conflicts-ignore-settings"
            >
              <p className="text-xs text-muted-foreground">
                {t('envvar.conflicts.ignoreDefaults', { keys: defaultIgnoredKeys.join(', ') })}
              </p>
              {customIgnoredKeys.length > 0 && (
                <div
                  className="flex flex-wrap gap-1.5"
                  data-testid="envvar-conflicts-custom-ignore-list"
                >
                  {customIgnoredKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                    >
                      <span className="font-mono">{key}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-muted-foreground hover:text-foreground"
                        onClick={() => handleRemoveIgnoredKey(key)}
                        aria-label={`${t('common.delete')} ${key}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={ignoreInput}
                  onChange={(e) => setIgnoreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIgnoredKeys();
                    }
                  }}
                  placeholder={t('envvar.conflicts.ignorePlaceholder')}
                  className="h-8 text-xs"
                  data-testid="envvar-conflicts-ignore-input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  onClick={handleAddIgnoredKeys}
                  data-testid="envvar-conflicts-ignore-add"
                >
                  {t('envvar.conflicts.ignoreAdd')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  onClick={() => persistIgnoredKeys([])}
                  disabled={customIgnoredKeys.length === 0}
                  data-testid="envvar-conflicts-ignore-clear"
                >
                  {t('common.clear')}
                </Button>
              </div>
              {hiddenCount > 0 && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="envvar-conflicts-hidden-count"
                >
                  {t('envvar.conflicts.hiddenByIgnore', { count: hiddenCount })}
                </p>
              )}
            </div>

            {/* Conflict list */}
            {visibleConflicts.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {t('envvar.conflicts.noConflicts')}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t('envvar.conflicts.description', { count: visibleConflicts.length })}
                </p>
                <div
                  className="max-h-[32vh] overflow-y-auto pr-1"
                  data-testid="envvar-conflicts-scroll-area"
                >
                  {compactView ? (
                    <div className="space-y-2" data-testid="envvar-conflicts-compact-list">
                      {visibleConflicts.map((conflict) => (
                        <div
                          key={conflict.key}
                          className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs"
                          data-testid="envvar-conflict-item"
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span className="font-mono text-xs font-semibold">{conflict.key}</span>
                          </div>
                          <dl className="mt-2.5 space-y-2">
                            <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                              <dt className="text-muted-foreground">
                                {t('envvar.conflicts.userValue')}:
                              </dt>
                              <dd className="break-all font-mono">{conflict.userValue}</dd>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                              <dt className="text-muted-foreground">
                                {t('envvar.conflicts.systemValue')}:
                              </dt>
                              <dd className="break-all font-mono">{conflict.systemValue}</dd>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                              <dt className="font-medium text-foreground">
                                {t('envvar.conflicts.effectiveValue')}:
                              </dt>
                              <dd
                                className="break-all font-mono font-semibold"
                                data-testid="envvar-conflict-effective-value"
                              >
                                {conflict.effectiveValue}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 px-2 text-[11px]"
                              onClick={() => onResolve(conflict.key, 'user', 'system')}
                              disabled={busy}
                              data-testid={`envvar-conflict-user-to-system-${conflict.key}`}
                            >
                              <ArrowRight className="h-3 w-3" />
                              {t('envvar.conflicts.applyUserToSystem')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 px-2 text-[11px]"
                              onClick={() => onResolve(conflict.key, 'system', 'user')}
                              disabled={busy}
                              data-testid={`envvar-conflict-system-to-user-${conflict.key}`}
                            >
                              <ArrowRight className="h-3 w-3 rotate-180" />
                              {t('envvar.conflicts.applySystemToUser')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div data-testid="envvar-conflicts-table">
                      <Table className="table-fixed text-xs">
                        <TableHeader>
                          <TableRow className="text-muted-foreground hover:bg-transparent">
                            <TableHead className="w-32 pr-3">
                              {t('envvar.conflicts.key')}
                            </TableHead>
                            <TableHead className="pr-3">
                              {t('envvar.conflicts.userValue')}
                            </TableHead>
                            <TableHead className="pr-3">
                              {t('envvar.conflicts.systemValue')}
                            </TableHead>
                            <TableHead>
                              {t('envvar.conflicts.effectiveValue')}
                            </TableHead>
                            <TableHead className="w-44">
                              {t('envvar.conflicts.resolve')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleConflicts.map((conflict) => (
                            <TableRow
                              key={conflict.key}
                              className="align-top hover:bg-amber-500/5"
                            >
                              <TableCell className="pr-3">
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                                  <span className="font-mono font-medium">{conflict.key}</span>
                                </div>
                              </TableCell>
                              <TableCell className="break-all pr-3 font-mono text-muted-foreground">
                                {conflict.userValue}
                              </TableCell>
                              <TableCell className="break-all pr-3 font-mono text-muted-foreground">
                                {conflict.systemValue}
                              </TableCell>
                              <TableCell>
                                <span
                                  className="break-all font-mono font-semibold text-foreground"
                                  data-testid="envvar-conflict-effective-value"
                                >
                                  {conflict.effectiveValue}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 justify-start gap-1.5 px-2 text-[11px]"
                                    onClick={() =>
                                      onResolve(conflict.key, 'user', 'system')
                                    }
                                    disabled={busy}
                                    data-testid={`envvar-conflict-user-to-system-${conflict.key}`}
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                    {t('envvar.conflicts.applyUserToSystem')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 justify-start gap-1.5 px-2 text-[11px]"
                                    onClick={() =>
                                      onResolve(conflict.key, 'system', 'user')
                                    }
                                    disabled={busy}
                                    data-testid={`envvar-conflict-system-to-user-${conflict.key}`}
                                  >
                                    <ArrowRight className="h-3 w-3 rotate-180" />
                                    {t('envvar.conflicts.applySystemToUser')}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
