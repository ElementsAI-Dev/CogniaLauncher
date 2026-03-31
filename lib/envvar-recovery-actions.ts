export type EnvVarRecoveryAction =
  | 'persistent_set'
  | 'persistent_remove'
  | 'import_apply'
  | 'path_add'
  | 'path_remove'
  | 'path_reorder'
  | 'path_deduplicate'
  | 'path_repair_apply'
  | 'conflict_resolve'
  | 'snapshot_restore';

const UI_RECOVERY_ACTION_MAP: Record<string, EnvVarRecoveryAction> = {
  import: 'import_apply',
  'path-add': 'path_add',
  'path-remove': 'path_remove',
  'path-reorder': 'path_reorder',
  'path-deduplicate': 'path_deduplicate',
  'path-repair': 'path_repair_apply',
  'conflict-resolve': 'conflict_resolve',
  'snapshot-restore': 'snapshot_restore',
};

export function getCanonicalRecoveryAction(action: string): string {
  return UI_RECOVERY_ACTION_MAP[action] ?? action;
}
