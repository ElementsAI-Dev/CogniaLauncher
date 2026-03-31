import type { EnvVarRow } from '@/lib/envvar';
import type { EnvVarSupportSnapshot } from '@/types/tauri';
import {
  getActionLabel,
  getBackupProtectionBadgeVariant,
  getCanonicalRecoveryAction,
  getDetectionStatusText,
  getFilteredRowCount,
  getSupportForAction,
  resolveRefreshScope,
} from './page-helpers';

const t = (key: string) => key;

function makeSupportSnapshot(
  actions: NonNullable<EnvVarSupportSnapshot['actions']>,
): EnvVarSupportSnapshot {
  return {
    state: 'ready',
    reasonCode: 'ready',
    reason: 'ready',
    platform: 'linux',
    detectedShells: 1,
    primaryShellTarget: '/home/user/.bashrc',
    actions,
  };
}

function makeRow(key: string, value: string): EnvVarRow {
  return {
    key,
    value,
    scope: 'process',
    masked: false,
    revealedValue: null,
    isSensitive: false,
  };
}

describe('page helpers', () => {
  describe('getSupportForAction', () => {
    it('returns null when support snapshot is unavailable', () => {
      expect(getSupportForAction(null, 'refresh', 'all')).toBeNull();
    });

    it('returns exact action match for requested scope', () => {
      const snapshot = makeSupportSnapshot([
        {
          action: 'refresh',
          scope: 'process',
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'ready',
          nextSteps: [],
        },
      ]);

      expect(getSupportForAction(snapshot, 'refresh', 'process')).toMatchObject({
        scope: 'process',
        supported: true,
      });
    });

    it('prefers unsupported all-scope entries when exact all-scope action is missing', () => {
      const snapshot = makeSupportSnapshot([
        {
          action: 'refresh',
          scope: 'user',
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'ready',
          nextSteps: [],
        },
        {
          action: 'refresh',
          scope: 'system',
          supported: false,
          state: 'blocked',
          reasonCode: 'blocked',
          reason: 'blocked',
          nextSteps: ['retry'],
        },
      ]);

      expect(getSupportForAction(snapshot, 'refresh', 'all')).toMatchObject({
        scope: 'system',
        supported: false,
        state: 'blocked',
      });
    });

    it('falls back to any matching action for all scope when no blocked match exists', () => {
      const snapshot = makeSupportSnapshot([
        {
          action: 'refresh',
          scope: 'user',
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'ready',
          nextSteps: [],
        },
      ]);

      expect(getSupportForAction(snapshot, 'refresh', 'all')).toMatchObject({
        scope: 'user',
        supported: true,
      });
    });

    it('falls back to global action support when scoped entry is absent', () => {
      const snapshot = makeSupportSnapshot([
        {
          action: 'refresh',
          scope: null,
          supported: true,
          state: 'ready',
          reasonCode: 'ready',
          reason: 'ready',
          nextSteps: [],
        },
      ]);

      expect(getSupportForAction(snapshot, 'refresh', 'user')).toMatchObject({
        scope: null,
        supported: true,
      });
    });
  });

  describe('resolveRefreshScope', () => {
    it('returns all when the current filter is all', () => {
      expect(resolveRefreshScope('all', 'user')).toBe('all');
    });

    it('returns the mutation scope when the current filter is scoped', () => {
      expect(resolveRefreshScope('user', 'system')).toBe('system');
    });
  });

  describe('getActionLabel', () => {
    it.each([
      ['refresh', 'envvar.actions.refresh'],
      ['add', 'envvar.actions.add'],
      ['edit', 'envvar.actions.edit'],
      ['delete', 'envvar.actions.delete'],
      ['import', 'envvar.importExport.import'],
      ['import-preview', 'envvar.importExport.preview'],
      ['export', 'envvar.importExport.export'],
      ['conflict-resolve', 'envvar.conflicts.resolve'],
      ['path-add', 'envvar.pathEditor.add'],
      ['path-remove', 'envvar.pathEditor.remove'],
      ['path-reorder', 'envvar.pathEditor.title'],
      ['path-deduplicate', 'envvar.pathEditor.deduplicate'],
      ['path-repair', 'envvar.pathEditor.applyRepair'],
      ['snapshot-restore', 'envvar.snapshots.restore'],
    ] satisfies Array<[Parameters<typeof getActionLabel>[0], string]>)(
      'maps %s to the expected translation key',
      (action, translationKey) => {
        expect(getActionLabel(action, t)).toBe(translationKey);
      },
    );

    it('falls back to the generic error label for unknown actions', () => {
      expect(getActionLabel('unknown-action' as never, t)).toBe('common.error');
    });
  });

  describe('getCanonicalRecoveryAction', () => {
    it('maps UI aliases to backend recovery action ids', () => {
      expect(getCanonicalRecoveryAction('conflict-resolve')).toBe('conflict_resolve');
      expect(getCanonicalRecoveryAction('path-repair')).toBe('path_repair_apply');
      expect(getCanonicalRecoveryAction('snapshot-restore')).toBe('snapshot_restore');
    });

    it('passes through already canonical actions', () => {
      expect(getCanonicalRecoveryAction('import_apply')).toBe('import_apply');
      expect(getCanonicalRecoveryAction('path_add')).toBe('path_add');
      expect(getCanonicalRecoveryAction('persistent_remove')).toBe('persistent_remove');
    });
  });

  describe('getBackupProtectionBadgeVariant', () => {
    it('maps blocked protection to destructive badges', () => {
      expect(getBackupProtectionBadgeVariant({
        action: 'import_apply',
        scope: 'user',
        state: 'blocked',
        reasonCode: 'permission_denied',
        reason: 'blocked',
        nextSteps: [],
        snapshot: null,
      })).toBe('destructive');
    });

    it('maps unprotected protection to outline badges', () => {
      expect(getBackupProtectionBadgeVariant({
        action: 'import_apply',
        scope: 'user',
        state: 'unprotected',
        reasonCode: 'unprotected',
        reason: 'unprotected',
        nextSteps: [],
        snapshot: null,
      })).toBe('outline');
    });

    it('defaults to secondary badges for reusable or missing protection state', () => {
      expect(getBackupProtectionBadgeVariant({
        action: 'import_apply',
        scope: 'user',
        state: 'will_reuse',
        reasonCode: 'compatible_snapshot_available',
        reason: 'protected',
        nextSteps: [],
        snapshot: null,
      })).toBe('secondary');
      expect(getBackupProtectionBadgeVariant(null)).toBe('secondary');
    });
  });

  describe('getDetectionStatusText', () => {
    it.each([
      ['loading-no-cache', false, 'envvar.detection.loading'],
      ['showing-cache-refreshing', true, 'envvar.detection.cacheRefreshing'],
      ['showing-fresh', false, 'envvar.detection.fresh'],
      ['empty', false, 'envvar.detection.empty'],
      ['error', true, 'envvar.detection.errorWithCache'],
      ['error', false, 'envvar.detection.error'],
      ['idle', false, 'envvar.detection.idle'],
    ] as const)(
      'maps detection state %s to %s',
      (state, fromCache, translationKey) => {
        expect(getDetectionStatusText(state, fromCache, t)).toBe(translationKey);
      },
    );
  });

  describe('getFilteredRowCount', () => {
    const rows = [
      makeRow('PATH', '/usr/bin'),
      makeRow('JAVA_HOME', '/opt/jdk'),
      makeRow('NODE_HOME', '/opt/node'),
    ];

    it('returns the total row count when the search query is empty', () => {
      expect(getFilteredRowCount(rows, '')).toBe(3);
    });

    it('matches against keys case-insensitively', () => {
      expect(getFilteredRowCount(rows, 'java')).toBe(1);
    });

    it('matches against values case-insensitively', () => {
      expect(getFilteredRowCount(rows, '/OPT')).toBe(2);
    });

    it('returns zero when no rows match', () => {
      expect(getFilteredRowCount(rows, 'missing')).toBe(0);
    });
  });
});
