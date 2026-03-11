import { getBackupActionHint } from './backup-settings';

describe('backup-settings reason hints', () => {
  it('maps operation-in-progress reason to actionable guidance', () => {
    expect(getBackupActionHint('operation_in_progress')).toContain(
      'Another backup operation is running',
    );
  });

  it('maps restore safety fallback reason to actionable guidance', () => {
    expect(getBackupActionHint('restore_safety_backup_failed')).toContain(
      'safety backup step failed',
    );
  });

  it('maps permission and path reasons', () => {
    expect(getBackupActionHint('backup_create_permission_denied')).toContain(
      'insufficient file-system permissions',
    );
    expect(getBackupActionHint('backup_import_path_conflict')).toContain(
      'invalid, missing, or conflicts',
    );
  });

  it('returns null for unknown reason codes', () => {
    expect(getBackupActionHint('unknown_reason')).toBeNull();
    expect(getBackupActionHint()).toBeNull();
  });
});
