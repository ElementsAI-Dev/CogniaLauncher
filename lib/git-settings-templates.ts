import type {
  GitConfigApplyMode,
  GitConfigApplyPlanItem,
  GitConfigTemplateDefinition,
  GitConfigTemplatePreviewItem,
  GitConfigTemplateItem,
} from '@/types/git';
import type { GitConfigEntry } from '@/types/tauri';

const BOOLEAN_KEYS = new Set<string>([
  'commit.gpgsign',
  'core.filemode',
  'core.longpaths',
  'core.symlinks',
  'push.autoSetupRemote',
  'push.followTags',
  'fetch.prune',
  'http.sslVerify',
]);

const ENUM_RULES: Record<string, Set<string>> = {
  'core.autocrlf': new Set(['true', 'false', 'input']),
  'pull.rebase': new Set(['true', 'false', 'merges', 'interactive']),
  'pull.ff': new Set(['true', 'false', 'only']),
  'push.default': new Set(['simple', 'current', 'matching', 'upstream']),
  'color.ui': new Set(['auto', 'always', 'never']),
  'gpg.format': new Set(['openpgp', 'ssh']),
};

export const GIT_SETTINGS_TEMPLATES: GitConfigTemplateDefinition[] = [
  {
    id: 'safe-defaults',
    labelKey: 'git.settings.templates.safeDefaults.label',
    descriptionKey: 'git.settings.templates.safeDefaults.description',
    items: [
      { key: 'init.defaultBranch', value: 'main', mode: 'set_if_unset' },
      { key: 'push.default', value: 'simple', mode: 'set_if_unset' },
      { key: 'push.autoSetupRemote', value: 'true', mode: 'set_if_unset' },
      { key: 'fetch.prune', value: 'true', mode: 'set_if_unset' },
    ],
  },
  {
    id: 'rebase-workflow',
    labelKey: 'git.settings.templates.rebaseWorkflow.label',
    descriptionKey: 'git.settings.templates.rebaseWorkflow.description',
    items: [
      { key: 'pull.rebase', value: 'true', mode: 'set' },
      { key: 'pull.ff', value: 'only', mode: 'set' },
      { key: 'rebase.autoStash', value: 'true', mode: 'set_if_unset' },
      { key: 'fetch.prune', value: 'true', mode: 'set' },
    ],
  },
  {
    id: 'cross-platform-line-endings',
    labelKey: 'git.settings.templates.crossPlatformLineEndings.label',
    descriptionKey: 'git.settings.templates.crossPlatformLineEndings.description',
    items: [
      { key: 'core.autocrlf', value: 'input', mode: 'set' },
      { key: 'core.eol', value: 'lf', mode: 'set' },
      { key: 'core.safecrlf', value: 'warn', mode: 'set_if_unset' },
    ],
  },
];

export function getGitSettingsTemplate(templateId: string): GitConfigTemplateDefinition | null {
  return GIT_SETTINGS_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function buildGitConfigMap(entries: GitConfigEntry[]): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

function getPreviewAction(item: GitConfigTemplateItem, currentValue: string | null): GitConfigTemplatePreviewItem['action'] {
  if (item.mode === 'unset') return currentValue === null ? 'unchanged' : 'remove';
  if (currentValue === null) return 'add';
  if (currentValue === (item.value ?? '')) return 'unchanged';
  return 'update';
}

export function validateGitConfigEntry(key: string, value: string | null): string | null {
  const trimmedKey = key.trim();
  if (!trimmedKey) return 'git.settings.validation.keyRequired';
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(trimmedKey)) {
    return 'git.settings.validation.invalidKey';
  }

  if (value === null) return null;
  const trimmedValue = value.trim();
  if (!trimmedValue) return 'git.settings.validation.valueRequired';

  if (trimmedKey === 'user.email') {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedValue)) {
      return 'git.settings.validation.invalidEmail';
    }
  }

  if (BOOLEAN_KEYS.has(trimmedKey) && !['true', 'false'].includes(trimmedValue)) {
    return 'git.settings.validation.invalidBoolean';
  }

  const enumRule = ENUM_RULES[trimmedKey];
  if (enumRule && !enumRule.has(trimmedValue)) {
    return 'git.settings.validation.invalidEnum';
  }

  return null;
}

export function buildGitTemplatePreview(
  template: GitConfigTemplateDefinition,
  currentConfig: Record<string, string>,
): GitConfigTemplatePreviewItem[] {
  return template.items.map((item) => {
    const currentValue = currentConfig[item.key] ?? null;
    const action = getPreviewAction(item, currentValue);
    const validationMessageKey = item.mode === 'unset'
      ? null
      : validateGitConfigEntry(item.key, item.value);

    return {
      key: item.key,
      mode: item.mode,
      currentValue,
      nextValue: item.value,
      action,
      selected: action !== 'unchanged',
      validationMessageKey,
    };
  });
}

export function buildApplyPlanFromPreview(
  previewItems: GitConfigTemplatePreviewItem[],
): GitConfigApplyPlanItem[] {
  return previewItems.map((item) => ({
    key: item.key,
    mode: item.mode as GitConfigApplyMode,
    value: item.nextValue,
    selected: item.selected,
  }));
}
