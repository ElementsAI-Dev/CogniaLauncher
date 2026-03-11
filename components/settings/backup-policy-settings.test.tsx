import { getBackupPolicyBoundaryNotes } from './backup-policy-settings';

describe('backup-policy-settings boundary notes', () => {
  it('describes unlimited and disabled boundary values', () => {
    const notes = getBackupPolicyBoundaryNotes({
      'backup.max_backups': '0',
      'backup.retention_days': '0',
      'backup.auto_backup_interval_hours': '0',
    });
    expect(notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unlimited manual backup count'),
        expect.stringContaining('no age limit'),
        expect.stringContaining('scheduled automatic backup loop is disabled'),
      ]),
    );
  });

  it('describes clamped values', () => {
    const notes = getBackupPolicyBoundaryNotes({
      'backup.max_backups': '1001',
      'backup.retention_days': '3651',
      'backup.auto_backup_interval_hours': '24',
    });
    expect(notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('clamped to 1000'),
        expect.stringContaining('clamped to 3650'),
      ]),
    );
  });
});
