import type { GitConfigTemplateDefinition, GitConfigTemplatePreviewItem } from '@/types/git';
import type { GitConfigEntry } from '@/types/tauri';
import {
  GIT_SETTINGS_TEMPLATES,
  buildApplyPlanFromPreview,
  buildGitConfigMap,
  buildGitTemplatePreview,
  getGitSettingsTemplate,
  validateGitConfigEntry,
} from './git-settings-templates';

describe('git settings templates', () => {
  it('finds template by id and returns null for unknown id', () => {
    expect(getGitSettingsTemplate('safe-defaults')?.id).toBe('safe-defaults');
    expect(getGitSettingsTemplate('unknown-template')).toBeNull();
  });

  it('exports built-in template collection', () => {
    expect(GIT_SETTINGS_TEMPLATES.map((item) => item.id)).toEqual([
      'safe-defaults',
      'rebase-workflow',
      'cross-platform-line-endings',
    ]);
  });
});

describe('buildGitConfigMap', () => {
  it('builds key-value map from config entries', () => {
    const entries: GitConfigEntry[] = [
      { key: 'pull.rebase', value: 'false' },
      { key: 'user.email', value: 'demo@example.com' },
    ];
    expect(buildGitConfigMap(entries)).toEqual({
      'pull.rebase': 'false',
      'user.email': 'demo@example.com',
    });
  });
});

describe('validateGitConfigEntry', () => {
  it('validates required key/value and key format rules', () => {
    expect(validateGitConfigEntry('', 'x')).toBe('git.settings.validation.keyRequired');
    expect(validateGitConfigEntry('bad key', 'x')).toBe('git.settings.validation.invalidKey');
    expect(validateGitConfigEntry('pull.rebase', '')).toBe('git.settings.validation.valueRequired');
  });

  it('accepts unset mode values and checks emails/booleans/enums', () => {
    expect(validateGitConfigEntry('http.sslVerify', null)).toBeNull();
    expect(validateGitConfigEntry('user.email', 'not-an-email')).toBe('git.settings.validation.invalidEmail');
    expect(validateGitConfigEntry('http.sslVerify', 'yes')).toBe('git.settings.validation.invalidBoolean');
    expect(validateGitConfigEntry('pull.ff', 'maybe')).toBe('git.settings.validation.invalidEnum');
    expect(validateGitConfigEntry('pull.ff', 'only')).toBeNull();
  });
});

describe('buildGitTemplatePreview and apply plan', () => {
  const template: GitConfigTemplateDefinition = {
    id: 'preview-test',
    labelKey: 'label',
    descriptionKey: 'description',
    items: [
      { key: 'push.default', value: 'simple', mode: 'set' },
      { key: 'fetch.prune', value: 'true', mode: 'set_if_unset' },
      { key: 'color.ui', value: 'always', mode: 'set' },
      { key: 'http.sslVerify', value: null, mode: 'unset' },
      { key: 'user.email', value: 'invalid-email', mode: 'set' },
    ],
  };

  const current = {
    'push.default': 'matching',
    'color.ui': 'always',
    'http.sslVerify': 'false',
  };

  it('generates add/update/remove/unchanged preview actions with validation', () => {
    const preview = buildGitTemplatePreview(template, current);
    const byKey = Object.fromEntries(preview.map((item) => [item.key, item]));

    expect(byKey['push.default'].action).toBe('update');
    expect(byKey['push.default'].selected).toBe(true);

    expect(byKey['fetch.prune'].action).toBe('add');
    expect(byKey['fetch.prune'].selected).toBe(true);

    expect(byKey['color.ui'].action).toBe('unchanged');
    expect(byKey['color.ui'].selected).toBe(false);

    expect(byKey['http.sslVerify'].action).toBe('remove');
    expect(byKey['http.sslVerify'].validationMessageKey).toBeNull();

    expect(byKey['user.email'].validationMessageKey).toBe('git.settings.validation.invalidEmail');
  });

  it('maps preview items to apply plan without dropping selection flags', () => {
    const preview: GitConfigTemplatePreviewItem[] = buildGitTemplatePreview(template, current);
    const plan = buildApplyPlanFromPreview(preview);

    expect(plan).toEqual(
      preview.map((item) => ({
        key: item.key,
        mode: item.mode,
        value: item.nextValue,
        selected: item.selected,
      })),
    );
  });
});
