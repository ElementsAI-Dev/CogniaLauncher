'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  User,
  GitCommitHorizontal,
  Settings2,
  RefreshCw,
  GitPullRequest,
  GitCompareArrows,
  KeyRound,
  Palette,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { toast } from 'sonner';
import type {
  GitConfigApplyPlanItem,
  GitConfigApplySummary,
  GitConfigReadFailure,
  GitConfigTemplatePreviewItem,
  GitGlobalSettingsCardProps,
} from '@/types/git';
import {
  buildApplyPlanFromPreview,
  buildGitTemplatePreview,
  getGitSettingsTemplate,
  GIT_SETTINGS_TEMPLATES,
  validateGitConfigEntry,
} from '@/lib/git-settings-templates';

interface SettingValue {
  value: string | null;
  loading: boolean;
}

type SettingsLoadState = 'loading' | 'partial' | 'ready' | 'retrying';

const SETTING_KEYS = [
  'user.name', 'user.email', 'user.signingkey',
  'commit.gpgsign', 'commit.template', 'init.defaultBranch',
  'core.editor', 'core.autocrlf', 'core.filemode', 'core.longpaths',
  'core.symlinks', 'core.pager', 'core.excludesfile',
  'pull.rebase', 'pull.ff', 'push.default', 'push.autoSetupRemote',
  'push.followTags', 'fetch.prune',
  'diff.tool', 'merge.tool', 'merge.conflictstyle', 'diff.colorMoved',
  'credential.helper', 'http.proxy', 'https.proxy', 'http.sslVerify',
  'color.ui', 'gpg.program', 'gpg.format',
] as const;

type SettingKey = typeof SETTING_KEYS[number];

const FALLBACK_READ_CONCURRENCY = 4;
const SNAPSHOT_READ_TIMEOUT_MS = 8_000;
const FALLBACK_READ_TIMEOUT_MS = 8_000;
const FALLBACK_REQUIRED_KEYS: SettingKey[] = [
  'user.name',
  'user.email',
  'core.editor',
  'pull.rebase',
  'push.default',
  'credential.helper',
];

function createInitialSettingsState(): Record<string, SettingValue> {
  return SETTING_KEYS.reduce((acc, key) => {
    acc[key] = { value: null, loading: false };
    return acc;
  }, {} as Record<string, SettingValue>);
}

function mergeFailures(failures: GitConfigReadFailure[]): GitConfigReadFailure[] {
  const map = new Map<string, GitConfigReadFailure>();
  for (const failure of failures) {
    const id = `${failure.key ?? 'global'}::${failure.category}::${failure.message}`;
    if (!map.has(id)) {
      map.set(id, failure);
    }
  }
  return Array.from(map.values());
}

function normalizeFailure(message: string, key: string | null): GitConfigReadFailure {
  const lower = message.toLowerCase();
  if (lower.includes('[git:timeout]') || lower.includes('timeout') || lower.includes('timed out')) {
    return {
      key,
      category: 'timeout',
      message,
      recoverable: true,
      nextSteps: ['Retry reading failed keys.'],
    };
  }
  if (lower.includes('parse') || lower.includes('invalid') || lower.includes('malformed')) {
    return {
      key,
      category: 'parse_failed',
      message,
      recoverable: true,
      nextSteps: ['Fix invalid git config content and retry.'],
    };
  }
  if (lower.includes('[git:execution]') || lower.includes('provider error') || lower.includes('git:')) {
    return {
      key,
      category: 'execution_failed',
      message,
      recoverable: true,
      nextSteps: ['Retry or open config file location for manual inspection.'],
    };
  }
  return {
    key,
    category: 'unknown',
    message,
    recoverable: false,
    nextSteps: ['Retry and inspect logs if the issue persists.'],
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function GitGlobalSettingsCard({
  onGetConfigSnapshot,
  onGetConfigValuesBatch,
  onGetConfigFilePath,
  onOpenConfigLocation,
  onSetConfig,
  onSetConfigIfUnset,
  onApplyConfigPlan,
}: GitGlobalSettingsCardProps) {
  const { t } = useLocale();
  const [settings, setSettings] = useState<Record<string, SettingValue>>(createInitialSettingsState);
  const [loadState, setLoadState] = useState<SettingsLoadState>('loading');
  const [loadFailures, setLoadFailures] = useState<GitConfigReadFailure[]>([]);
  const [failedKeys, setFailedKeys] = useState<SettingKey[]>([]);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(GIT_SETTINGS_TEMPLATES[0]?.id ?? '');
  const [templatePreview, setTemplatePreview] = useState<GitConfigTemplatePreviewItem[]>([]);
  const [lastApplySummary, setLastApplySummary] = useState<GitConfigApplySummary | null>(null);
  const initRef = useRef(false);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const failedKeysRef = useRef<SettingKey[]>([]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loadSettings = useCallback(async (mode: 'full' | 'retryFailed' = 'full') => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoadState(mode === 'retryFailed' ? 'retrying' : 'loading');
    if (mode === 'full') {
      setLoadFailures([]);
      setFailedKeys([]);
      failedKeysRef.current = [];
    }

    const resolvedValues: Record<string, string | null> = {};
    for (const key of SETTING_KEYS) {
      resolvedValues[key] = null;
    }

    let snapshotValues: Record<string, string | null> = {};
    let snapshotFailures: GitConfigReadFailure[] = [];
    try {
      const snapshot = await withTimeout(
        onGetConfigSnapshot(),
        SNAPSHOT_READ_TIMEOUT_MS,
        'Snapshot read timed out',
      );
      snapshotValues = snapshot.values;
      snapshotFailures = snapshot.failures;
    } catch (e) {
      snapshotFailures = [normalizeFailure(String(e), null)];
    }
    if (!mountedRef.current || requestId !== loadRequestRef.current) {
      return;
    }

    for (const key of SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(snapshotValues, key)) {
        resolvedValues[key] = snapshotValues[key];
      }
    }

    setSettings((prev) => {
      const next = { ...prev };
      for (const key of SETTING_KEYS) {
        next[key] = {
          value: resolvedValues[key],
          loading: false,
        };
      }
      return next;
    });

    const baseFailedKeys = snapshotFailures
      .map((failure) => failure.key)
      .filter((key): key is SettingKey => key !== null && SETTING_KEYS.includes(key as SettingKey));
    failedKeysRef.current = Array.from(new Set(baseFailedKeys));
    setFailedKeys(failedKeysRef.current);
    setLoadFailures(mergeFailures(snapshotFailures));

    const targetKeys = mode === 'retryFailed'
      ? failedKeysRef.current
      : snapshotFailures.length > 0
        ? FALLBACK_REQUIRED_KEYS
        : [];
    const missingKeys = targetKeys.filter((key) => resolvedValues[key] === null);

    let fallbackFailures: GitConfigReadFailure[] = [];
    if (missingKeys.length > 0) {
      if (mode !== 'retryFailed') {
        setLoadState('partial');
      }
      try {
        const fallback = await withTimeout(
          onGetConfigValuesBatch(missingKeys, {
            concurrency: FALLBACK_READ_CONCURRENCY,
          }),
          FALLBACK_READ_TIMEOUT_MS,
          'Fallback read timed out',
        );
        if (!mountedRef.current || requestId !== loadRequestRef.current) {
          return;
        }

        fallbackFailures = fallback.failures;
        for (const key of missingKeys) {
          if (Object.prototype.hasOwnProperty.call(fallback.values, key)) {
            resolvedValues[key] = fallback.values[key];
          }
        }
      } catch (e) {
        fallbackFailures = [normalizeFailure(String(e), null)];
      }

      if (!mountedRef.current || requestId !== loadRequestRef.current) {
        return;
      }

      setSettings((prev) => {
        const next = { ...prev };
        for (const key of missingKeys) {
          next[key] = {
            value: resolvedValues[key],
            loading: false,
          };
        }
        return next;
      });
    }

    const mergedFailures = mergeFailures([...snapshotFailures, ...fallbackFailures]);
    const nextFailedKeys = mergedFailures
      .map((failure) => failure.key)
      .filter((key): key is SettingKey => key !== null && SETTING_KEYS.includes(key as SettingKey));

    failedKeysRef.current = Array.from(new Set(nextFailedKeys));
    setFailedKeys(failedKeysRef.current);
    setLoadFailures(mergedFailures);
    setLoadState(mergedFailures.length === 0 ? 'ready' : 'partial');
  }, [onGetConfigSnapshot, onGetConfigValuesBatch]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      // Defer to avoid synchronous setState in effect
      queueMicrotask(() => { void loadSettings('full'); });
    }
  }, [loadSettings]);

  useEffect(() => {
    let cancelled = false;
    if (!onGetConfigFilePath) return;
    void onGetConfigFilePath()
      .then((path) => {
        if (!cancelled) {
          setConfigPath(path);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigPath(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onGetConfigFilePath]);

  const getValue = (key: SettingKey): string => {
    return settings[key]?.value ?? '';
  };

  const getBoolValue = (key: SettingKey): boolean => {
    const v = settings[key]?.value;
    return v === 'true';
  };

  const currentConfigMap = useMemo(() => {
    const next: Record<string, string> = {};
    for (const key of SETTING_KEYS) {
      const value = settings[key]?.value;
      if (value !== null && value !== undefined && value !== '') {
        next[key] = value;
      }
    }
    return next;
  }, [settings]);
  const selectedTemplateCount = useMemo(
    () => templatePreview.filter((item) => item.selected).length,
    [templatePreview],
  );

  const handleChange = useCallback(async (key: SettingKey, value: string) => {
    const validationMessageKey = validateGitConfigEntry(key, value);
    if (validationMessageKey) {
      toast.error(t(validationMessageKey));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      [key]: { value, loading: false },
    }));
    try {
      await onSetConfig(key, value);
    } catch {
      // revert on error
      void loadSettings('full');
    }
  }, [onSetConfig, loadSettings, t]);

  const handleToggle = useCallback(async (key: SettingKey, checked: boolean) => {
    await handleChange(key, checked ? 'true' : 'false');
  }, [handleChange]);

  const applyPlanWithLegacyActions = useCallback(async (
    items: GitConfigApplyPlanItem[],
  ): Promise<GitConfigApplySummary> => {
    const actionableItems = items.filter((item) => item.selected);
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const results: GitConfigApplySummary['results'] = [];

    for (const item of actionableItems) {
      try {
        if (item.mode === 'set_if_unset' && onSetConfigIfUnset) {
          const wasSet = await onSetConfigIfUnset(item.key, item.value ?? '');
          succeeded += 1;
          if (!wasSet) skipped += 1;
          results.push({
            key: item.key,
            mode: item.mode,
            success: true,
            applied: wasSet,
            message: wasSet ? 'Applied' : 'Skipped (already set)',
          });
          continue;
        }

        if (item.mode === 'unset') {
          await onSetConfig(item.key, '');
          succeeded += 1;
          results.push({
            key: item.key,
            mode: item.mode,
            success: true,
            applied: true,
            message: 'Removed',
          });
          continue;
        }

        await onSetConfig(item.key, item.value ?? '');
        succeeded += 1;
        results.push({
          key: item.key,
          mode: item.mode,
          success: true,
          applied: true,
          message: 'Applied',
        });
      } catch (e) {
        failed += 1;
        results.push({
          key: item.key,
          mode: item.mode,
          success: false,
          applied: false,
          message: String(e),
        });
      }
    }

    return {
      total: actionableItems.length,
      succeeded,
      failed,
      skipped,
      results,
    };
  }, [onSetConfig, onSetConfigIfUnset]);

  const handleApplyTemplate = useCallback(async () => {
    const selectedItems = templatePreview.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      toast.error(t('git.settings.templateSelectAtLeastOne'));
      return;
    }

    const invalidItem = selectedItems.find((item) => item.validationMessageKey);
    if (invalidItem?.validationMessageKey) {
      toast.error(t(invalidItem.validationMessageKey));
      return;
    }

    setApplyingTemplate(true);
    try {
      const plan = buildApplyPlanFromPreview(templatePreview);
      const summary = onApplyConfigPlan
        ? await onApplyConfigPlan(plan)
        : await applyPlanWithLegacyActions(plan);
      setLastApplySummary(summary);
      await loadSettings('full');
      toast.success(t('git.settings.templateApplied', { count: String(summary.succeeded) }));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setApplyingTemplate(false);
    }
  }, [applyPlanWithLegacyActions, loadSettings, onApplyConfigPlan, t, templatePreview]);

  useEffect(() => {
    const template = getGitSettingsTemplate(selectedTemplateId);
    if (!template) {
      setTemplatePreview([]);
      return;
    }
    setTemplatePreview(buildGitTemplatePreview(template, currentConfigMap));
  }, [currentConfigMap, selectedTemplateId]);

  const handleToggleTemplateItem = useCallback((key: string, checked: boolean) => {
    setTemplatePreview((prev) =>
      prev.map((item) => (item.key === key ? { ...item, selected: checked } : item)),
    );
  }, []);

  const handleRefreshAllSettings = useCallback(() => {
    void loadSettings('full');
  }, [loadSettings]);

  const handleRetryFailedKeys = useCallback(() => {
    if (failedKeysRef.current.length === 0) return;
    void loadSettings('retryFailed');
  }, [loadSettings]);

  const renderTextSetting = (key: SettingKey, placeholder?: string, type?: string) => (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3">
      <Label className="text-sm font-medium">{t(`git.settings.${key.replace(/\./g, '_')}`)}</Label>
      <Input
        value={getValue(key)}
        onChange={(e) => {
          setSettings((prev) => ({
            ...prev,
            [key]: { value: e.target.value, loading: false },
          }));
        }}
        onBlur={(e) => {
          void handleChange(key, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        type={type}
        className="h-8 text-sm"
      />
    </div>
  );

  const renderSelectSetting = (key: SettingKey, options: { value: string; label: string }[]) => (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3">
      <Label className="text-sm font-medium">{t(`git.settings.${key.replace(/\./g, '_')}`)}</Label>
      <Select
        value={getValue(key) || '__unset__'}
        onValueChange={(v) => handleChange(key, v === '__unset__' ? '' : v)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={t('git.settings.notSet')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__">{t('git.settings.notSet')}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderToggleSetting = (key: SettingKey) => (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3">
      <Label className="text-sm font-medium">{t(`git.settings.${key.replace(/\./g, '_')}`)}</Label>
      <div className="flex items-center gap-2">
        <Switch
          checked={getBoolValue(key)}
          onCheckedChange={(checked) => handleToggle(key, checked)}
        />
        <span className="text-xs text-muted-foreground">
          {getBoolValue(key) ? t('git.settings.enabled') : t('git.settings.disabled')}
        </span>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t('git.settings.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRefreshAllSettings}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {t('git.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleRefreshAllSettings}
            >
              {loadState === 'loading' ? 'Loading settings...' : 'Refresh settings'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={failedKeys.length === 0 || loadState === 'retrying'}
              onClick={handleRetryFailedKeys}
            >
              {loadState === 'retrying' ? 'Retrying failed keys...' : `Retry failed keys (${failedKeys.length})`}
            </Button>
            {onOpenConfigLocation && configPath && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  void onOpenConfigLocation();
                }}
              >
                Open config location
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Load state: {loadState}
          </p>
          {loadFailures.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
              {loadFailures.map((failure, index) => (
                <p key={`${failure.key ?? 'global'}-${index}`}>
                  [{failure.category}] {failure.key ? `${failure.key}: ` : ''}{failure.message}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="mb-4 space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-[180px_1fr] items-center gap-3">
            <Label className="text-sm font-medium">{t('git.settings.templateTitle')}</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t('git.settings.templatePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {GIT_SETTINGS_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {t(template.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTemplateId && (
            <p className="text-xs text-muted-foreground">
              {t(getGitSettingsTemplate(selectedTemplateId)?.descriptionKey ?? 'git.settings.templatePlaceholder')}
            </p>
          )}
          {templatePreview.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-2">
              {templatePreview.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => handleToggleTemplateItem(item.key, e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono break-all">{item.key}</p>
                    <p className="text-muted-foreground">
                      {item.currentValue ?? '∅'} → {item.nextValue ?? '∅'} ({t(`git.settings.templateAction.${item.action}`)})
                    </p>
                    {item.validationMessageKey && (
                      <p className="text-destructive">{t(item.validationMessageKey)}</p>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={applyingTemplate || selectedTemplateCount === 0}
                onClick={() => {
                  void handleApplyTemplate();
                }}
              >
                {t('git.settings.templateApply')}
              </Button>
            </div>
          )}
          {lastApplySummary && (
            <div className="rounded-md border bg-muted/20 p-2 text-xs">
              <p>
                {t('git.settings.templateSummary', {
                  success: String(lastApplySummary.succeeded),
                  failed: String(lastApplySummary.failed),
                  skipped: String(lastApplySummary.skipped),
                })}
              </p>
              {lastApplySummary.results.filter((item) => !item.success).length > 0 && (
                <div className="mt-1 space-y-1 text-destructive">
                  {lastApplySummary.results
                    .filter((item) => !item.success)
                    .map((item) => (
                      <p key={`failed-${item.key}`}>{item.key}: {item.message}</p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        <Accordion type="multiple" defaultValue={['identity', 'commit', 'core']} className="w-full">
          {/* Identity */}
          <AccordionItem value="identity">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('git.settings.group.identity')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderTextSetting('user.name', 'John Doe')}
              {renderTextSetting('user.email', 'john@example.com', 'email')}
              {renderTextSetting('user.signingkey', 'GPG Key ID')}
            </AccordionContent>
          </AccordionItem>

          {/* Commit */}
          <AccordionItem value="commit">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4" />
                {t('git.settings.group.commit')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderToggleSetting('commit.gpgsign')}
              {renderTextSetting('commit.template', '~/.gitmessage')}
              {renderTextSetting('init.defaultBranch', 'main')}
            </AccordionContent>
          </AccordionItem>

          {/* Core */}
          <AccordionItem value="core">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                {t('git.settings.group.core')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderSelectSetting('core.editor', [
                { value: 'vim', label: 'Vim' },
                { value: 'nano', label: 'Nano' },
                { value: 'code --wait', label: 'VS Code' },
                { value: 'notepad', label: 'Notepad' },
                { value: 'notepad++', label: 'Notepad++' },
                { value: 'emacs', label: 'Emacs' },
              ])}
              {renderSelectSetting('core.autocrlf', [
                { value: 'true', label: 'true (Windows)' },
                { value: 'input', label: 'input (macOS/Linux)' },
                { value: 'false', label: 'false' },
              ])}
              {renderToggleSetting('core.filemode')}
              {renderToggleSetting('core.longpaths')}
              {renderToggleSetting('core.symlinks')}
              {renderTextSetting('core.pager', 'less')}
              {renderTextSetting('core.excludesfile', '~/.gitignore_global')}
            </AccordionContent>
          </AccordionItem>

          {/* Pull & Push */}
          <AccordionItem value="pullpush">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4" />
                {t('git.settings.group.pullPush')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderSelectSetting('pull.rebase', [
                { value: 'false', label: 'false (merge)' },
                { value: 'true', label: 'true (rebase)' },
                { value: 'merges', label: 'merges' },
              ])}
              {renderSelectSetting('pull.ff', [
                { value: 'true', label: 'true' },
                { value: 'false', label: 'false' },
                { value: 'only', label: 'only' },
              ])}
              {renderSelectSetting('push.default', [
                { value: 'simple', label: 'simple' },
                { value: 'current', label: 'current' },
                { value: 'matching', label: 'matching' },
                { value: 'upstream', label: 'upstream' },
              ])}
              {renderToggleSetting('push.autoSetupRemote')}
              {renderToggleSetting('push.followTags')}
              {renderToggleSetting('fetch.prune')}
            </AccordionContent>
          </AccordionItem>

          {/* Diff & Merge */}
          <AccordionItem value="diffmerge">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4" />
                {t('git.settings.group.diffMerge')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderSelectSetting('diff.tool', [
                { value: 'vimdiff', label: 'vimdiff' },
                { value: 'meld', label: 'Meld' },
                { value: 'vscode', label: 'VS Code' },
                { value: 'p4merge', label: 'P4Merge' },
                { value: 'kdiff3', label: 'KDiff3' },
                { value: 'beyond compare', label: 'Beyond Compare' },
              ])}
              {renderSelectSetting('merge.tool', [
                { value: 'vimdiff', label: 'vimdiff' },
                { value: 'meld', label: 'Meld' },
                { value: 'vscode', label: 'VS Code' },
                { value: 'p4merge', label: 'P4Merge' },
                { value: 'kdiff3', label: 'KDiff3' },
                { value: 'beyond compare', label: 'Beyond Compare' },
              ])}
              {renderSelectSetting('merge.conflictstyle', [
                { value: 'merge', label: 'merge' },
                { value: 'diff3', label: 'diff3' },
                { value: 'zdiff3', label: 'zdiff3' },
              ])}
              {renderSelectSetting('diff.colorMoved', [
                { value: 'no', label: 'no' },
                { value: 'default', label: 'default' },
                { value: 'plain', label: 'plain' },
                { value: 'blocks', label: 'blocks' },
                { value: 'zebra', label: 'zebra' },
                { value: 'dimmed-zebra', label: 'dimmed-zebra' },
              ])}
            </AccordionContent>
          </AccordionItem>

          {/* Credential & Network */}
          <AccordionItem value="credential">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {t('git.settings.group.credential')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderSelectSetting('credential.helper', [
                { value: 'manager', label: 'Git Credential Manager' },
                { value: 'store', label: 'store (plaintext)' },
                { value: 'cache', label: 'cache (in-memory)' },
                { value: 'osxkeychain', label: 'macOS Keychain' },
                { value: 'wincred', label: 'Windows Credential' },
              ])}
              {renderTextSetting('http.proxy', 'http://proxy:8080')}
              {renderTextSetting('https.proxy', 'http://proxy:8080')}
              {renderToggleSetting('http.sslVerify')}
            </AccordionContent>
          </AccordionItem>

          {/* Color & GPG */}
          <AccordionItem value="color">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('git.settings.group.colorGpg')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {renderSelectSetting('color.ui', [
                { value: 'auto', label: 'auto' },
                { value: 'always', label: 'always' },
                { value: 'never', label: 'never' },
              ])}
              {renderTextSetting('gpg.program', 'gpg')}
              {renderSelectSetting('gpg.format', [
                { value: 'openpgp', label: 'OpenPGP' },
                { value: 'ssh', label: 'SSH' },
              ])}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
