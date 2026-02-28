'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  GitPullRequest,
  GitCompareArrows,
  KeyRound,
  Palette,
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import type { GitGlobalSettingsCardProps } from '@/types/git';

interface SettingValue {
  value: string | null;
  loading: boolean;
}

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

export function GitGlobalSettingsCard({
  onGetConfigValue,
  onSetConfig,
}: GitGlobalSettingsCardProps) {
  const { t } = useLocale();
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loadAllSettings = useCallback(async () => {
    const results: Record<string, SettingValue> = {};
    const promises = SETTING_KEYS.map(async (key) => {
      try {
        const value = await onGetConfigValue(key);
        results[key] = { value, loading: false };
      } catch {
        results[key] = { value: null, loading: false };
      }
    });
    await Promise.all(promises);
    if (mountedRef.current) {
      setSettings(results);
      setInitialized(true);
    }
  }, [onGetConfigValue]);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      // Defer to avoid synchronous setState in effect
      queueMicrotask(() => { loadAllSettings(); });
    }
  }, [loadAllSettings]);

  const getValue = (key: SettingKey): string => {
    return settings[key]?.value ?? '';
  };

  const getBoolValue = (key: SettingKey): boolean => {
    const v = settings[key]?.value;
    return v === 'true';
  };

  const handleChange = useCallback(async (key: SettingKey, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { value, loading: false },
    }));
    try {
      await onSetConfig(key, value);
    } catch {
      // revert on error
      loadAllSettings();
    }
  }, [onSetConfig, loadAllSettings]);

  const handleToggle = useCallback(async (key: SettingKey, checked: boolean) => {
    await handleChange(key, checked ? 'true' : 'false');
  }, [handleChange]);

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
          const newVal = e.target.value;
          const oldVal = settings[key]?.value ?? '';
          if (newVal !== oldVal) {
            handleChange(key, newVal);
          }
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

  if (!initialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t('git.settings.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          {t('git.settings.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
